import { env } from 'cloudflare:workers';
import { assertRoomStorage, RoomStorageSizeError } from '../../../lib/room-storage-limit';
import { messageReplay, MessageReplayError } from '../../../lib/message-operations';
import {prepareActionCatalog,portraitForCatalog,resolvedScenery} from '../../../lib/catalogs/game-content';
import {loadCatalogs} from '../../../lib/catalogs/runtime';
import {validateCampaignImages} from '../../../lib/catalogs/image-snapshot';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { rooms } from '../../../db/schema';
import { initialGame, type Game, type Msg } from '../../../lib/game';
import { makeBackup, readBackup, validateBackup } from '../../../lib/backup';
import { assertBackupSize, CampaignSizeError, readGameRequest } from '../../../lib/backup-limits';
import { startAdventure } from '../../../lib/start-adventure';
import { issueRecovery, claimRecovery } from '../../../lib/access';
import { pendingCombat } from '../../../lib/mechanics';
import { refreshSight } from '../../../lib/exploration';
import { reconcileInitiative } from '../../../lib/initiative';
import { reconcileGenerationMetadata } from '../../../lib/generator-provenance';
import { applyGameAction } from './actions';
import { gameView } from './view';
import { admitRoom, roomBytesLimit } from './admission';
import { conditionalView } from './conditional-view';
import { fail, gameHeaders as headers } from './responses';

const nativeNode = (env as unknown as { STUL_NATIVE_NODE?: unknown }).STUL_NATIVE_NODE === true;

function readToken(request: Request) {
  return request.headers.get('Authorization')?.replace('Bearer ', '');
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const code = u.searchParams.get('room') || '';
    const row = await getDb()
      .select()
      .from(rooms)
      .where(eq(rooms.id, code))
      .get();
    if (!row) return fail('Místnost neexistuje.', 404);
    const g = JSON.parse(row.data) as Game;
    const me = g.members.find((m) => !m.archived && m.token === readToken(req));
    if (!me) return fail('Připoj se k místnosti.', 401);
    if (u.searchParams.get('catalog') === 'bestiary') {
      if (me.role !== 'pj') return fail('Bestiář je dostupný pouze PJ.', 403);
      const library=await loadCatalogs(g.contentLibrary);
      return Response.json(library.list('bestiary').map(e=>({...e.data,portrait:portraitForCatalog(library,e.ref,g.contentLibrary),catalogSource:{id:e.catalogId,name:library.source(e.ref)?.bundle.manifest.name??e.catalogId,version:e.version,digest:e.digest}})),{headers});
    }
    if(u.searchParams.get('catalog')==='preparation'){
      if(me.role!=='pj')return fail('Přípravu katalogů používá pouze PJ.',403);
      const library=await loadCatalogs(g.contentLibrary);
      return Response.json({scenery:resolvedScenery(library),presets:library.list('dungeon-presets').map(e=>e.data)},{headers});
    }
    if (u.searchParams.get('download') === 'backup') {
      if (me.role !== 'pj') return fail('Úplnou zálohu stahuje pouze PJ.', 403);
      pendingCombat(g, me.id);
      const backup = makeBackup(g);
      try {
        // Exercise import normalization and storage overhead without issuing real credentials.
        const campaign = validateBackup(backup);
        const restored: Game = {
          ...campaign,
          members: campaign.members.map(member => ({ ...member, token: '0'.repeat(36) })),
        };
        restored.members.find(member => member.role === 'pj')!.recoveryHash = '0'.repeat(64);
        reconcileInitiative(restored);
        if (restored.atlas?.lighting?.enabled) refreshSight(restored);
        assertBackupSize(makeBackup(restored));
        assertRoomStorage(restored, nativeNode);
        await validateCampaignImages(g.contentLibrary);
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Záloha není obnovitelná.', 409);
      }
      return Response.json(backup, {
        headers: {
          ...headers,
          'Content-Disposition': 'attachment; filename="kampan-zaloha.json"',
        },
      });
    }
    return conditionalView(req, gameView(g, me.id, row.version, u.searchParams.get('level') || undefined));
  } catch {
    return fail('Spojení se stolem se nepodařilo. Zkus to znovu.', 503);
  }
}
export async function POST(req: Request) {
  try {
    const raw = await readGameRequest(req);
    if (raw === null)
      return fail('Požadavek je příliš velký.', 413);
    let b: Record<string, unknown>;
    try {
      b = JSON.parse(raw);
    } catch {
      return fail('Neplatný požadavek.');
    }
    if (!b || typeof b !== 'object' || Array.isArray(b))
      return fail('Neplatný požadavek.');
    const db = getDb();
    if (b.action === 'create' || b.action === 'restore') {
      const code = crypto
        .randomUUID()
        .replaceAll('-', '')
        .slice(0, 10)
        .toUpperCase();
      let game: Game;
      try {
        game =
          b.action === 'restore'
            ? readBackup(b.backup)
            : initialGame(
                String(b.name || 'Pán jeskyně').slice(0, 30),
                crypto.randomUUID(),
              );
        if(b.action==='restore')await validateCampaignImages(game.contentLibrary);
        if (b.action === 'create' && b.adventureId !== undefined) {
          const owner = game.members[0];
          const library=await prepareActionCatalog(game,owner,b);
          startAdventure(game, owner, b.adventureId,library);
        }
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Neplatná záloha.');
      }
      reconcileInitiative(game);
      if (game.atlas?.lighting?.enabled) refreshSight(game);
      const owner = game.members.find((m) => m.role === 'pj')!;
      const recoveryCode = await issueRecovery(owner, code);
      assertBackupSize(makeBackup(game));
      assertRoomStorage(game, nativeNode);
      const denied = await admitRoom(code, JSON.stringify(game));
      if (denied) return denied;
      return Response.json({
        room: code,
        token: owner.token,
        recoveryCode,
        game: gameView(game, owner.id),
      });
    }
    let preparedMessage: Msg | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      const row = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, String(b.room || '')))
        .get();
      if (!row) return fail('Tento kód místnosti neznáme.', 404);
      const g = JSON.parse(row.data) as Game;
      let me = g.members.find((m) => !m.archived && m.token === readToken(req));
      let token: string | undefined;
      let recoveryCode: string | undefined;
      if (b.action === 'recover') {
        try {
          const claim = await claimRecovery(
            g,
            row.id,
            b.recoveryCode,
            b.requestId,
          );
          me = claim.member;
          recoveryCode = claim.recoveryCode;
          token = me.token;
        } catch (e) {
          return fail(e instanceof Error ? e.message : 'Neplatný klíč.', 401);
        }
      }
      if (b.action === 'join') {
        if (g.members.length >= 200)
          return fail(
            'Místnost má příliš mnoho archivovaných postav. Založ další kampaň.',
          );
        if (g.members.filter((m) => !m.archived).length >= 12)
          return fail('Stůl už má 12 hráčů.');
        token = crypto.randomUUID();
        me = {
          ...initialGame(String(b.name || 'Dobrodruh').slice(0, 30), token)
            .members[0],
          role: 'player',
          color: ['#698675', '#7789a8', '#b28c47', '#a67887'][
            g.members.length % 4
          ],
          x: 5 + g.members.length,
          y: 6,
        };
        if (g.atlas?.location) {
          me.x = g.atlas.location.x;
          me.y = g.atlas.location.y;
        }
        g.members.push(me);
        recoveryCode = await issueRecovery(me, row.id);
      }
      if (!me) return fail('Připoj se k místnosti.', 401);
      try {
        if (await messageReplay(g, me, b)) return Response.json({ game: gameView(g, me.id, row.version, typeof b.levelId === 'string' ? b.levelId : undefined) }, { headers });
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Neplatná zpráva.', error instanceof MessageReplayError ? 409 : 400);
      }
      me.seen = Date.now();
      let library;
      try{library=await prepareActionCatalog(g,me,b);}catch(e){return fail(e instanceof Error?e.message:'Katalog není dostupný.');}
      const result = await applyGameAction(g, me, row.id, b,library,preparedMessage);
      if (result instanceof Response) return result;
      if (['chat', 'roll'].includes(String(b.action))) preparedMessage ??= g.messages.at(-1);
      recoveryCode = result.recoveryCode ?? recoveryCode;
      const { generatedLevels } = result;
      reconcileGenerationMetadata(g);
      reconcileInitiative(g);
      if (g.atlas?.battle || g.atlas?.lighting?.enabled) refreshSight(g);
      assertBackupSize(makeBackup(g));
      assertRoomStorage(g, nativeNode);
      // A concurrent write invalidates this revision; retry with the latest room.
      const serialized = JSON.stringify(g);
      const dataBytes = new TextEncoder().encode(serialized).length;
      const storageLimit = roomBytesLimit();
      const updated = await db
        .update(rooms)
        .set({ data: serialized, version: row.version + 1 })
        .where(and(eq(rooms.id, row.id), eq(rooms.version, row.version),
          sql`(${dataBytes} <= length(CAST(${rooms.data} AS BLOB)) OR
            (SELECT coalesce(sum(length(CAST(data AS BLOB))),0) FROM rooms WHERE id != ${row.id}) + ${dataBytes} <= ${storageLimit})`))
        .returning({ id: rooms.id });
      if (!updated.length && dataBytes > new TextEncoder().encode(row.data).length) {
        const total = await db.select({ bytes: sql<number>`coalesce(sum(length(CAST(data AS BLOB))),0)` }).from(rooms).get();
        if (Number(total?.bytes) - new TextEncoder().encode(row.data).length + dataBytes > storageLimit)
          return Response.json({ error: 'Instalace nemá kapacitu pro další data. Kontaktuj správce.' }, { status: 503, headers: { ...headers, 'Retry-After': '60' } });
      }
      if (updated.length)
        return Response.json(
          {
            game: gameView(
              g,
              me.id,
              row.version + 1,
              generatedLevels?.[0] ||
                (b.action === 'explore' &&
                ['travel', 'place'].includes(String(b.op))
                  ? undefined
                  : typeof b.levelId === 'string'
                    ? b.levelId
                    : undefined),
            ),
            ...(generatedLevels ? { generatedLevels } : {}),
            ...(token ? { token, room: row.id } : {}),
            ...(recoveryCode ? { recoveryCode } : {}),
          },
          { headers },
        );
    }
    return fail('Stůl je zaneprázdněný nebo instalace nemá kapacitu pro další data. Zkus to znovu, případně kontaktuj správce.', 409);
  } catch (error) {
    if (error instanceof CampaignSizeError || error instanceof RoomStorageSizeError) return fail(error.message, 413);
    console.error('game_write_failed');
    return fail('Akci se nepodařilo uložit. Zkontroluj spojení.', 503);
  }
}
