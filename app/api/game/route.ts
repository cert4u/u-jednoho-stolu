import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import { rooms } from '../../../db/schema';
import { initialGame, type Game } from '../../../lib/game';
import { makeBackup, readBackup } from '../../../lib/backup';
import { startAdventure } from '../../../lib/start-adventure';
import { issueRecovery, claimRecovery } from '../../../lib/access';
import { pendingCombat } from '../../../lib/mechanics';
import { refreshSight } from '../../../lib/exploration';
import { reconcileInitiative } from '../../../lib/initiative';
import { reconcileGenerationMetadata } from '../../../lib/generator-provenance';
import { applyGameAction } from './actions';
import { gameView } from './view';
import { fail, gameHeaders as headers } from './responses';

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
    if (u.searchParams.get('download') === 'backup') {
      if (me.role !== 'pj') return fail('Úplnou zálohu stahuje pouze PJ.', 403);
      pendingCombat(g, me.id);
      return Response.json(makeBackup(g), {
        headers: {
          ...headers,
          'Content-Disposition': 'attachment; filename="kampan-zaloha.json"',
        },
      });
    }
    return Response.json(
      gameView(g, me.id, row.version, u.searchParams.get('level') || undefined),
      { headers },
    );
  } catch {
    return fail('Spojení se stolem se nepodařilo. Zkus to znovu.', 503);
  }
}
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 3_100_000)
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
        if (b.action === 'create' && b.adventureId !== undefined) {
          const owner = game.members[0];
          startAdventure(game, owner, b.adventureId);
        }
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Neplatná záloha.');
      }
      reconcileInitiative(game);
      if (game.atlas?.lighting?.enabled) refreshSight(game);
      const owner = game.members.find((m) => m.role === 'pj')!;
      const recoveryCode = await issueRecovery(owner, code);
      await db.insert(rooms).values({ id: code, data: JSON.stringify(game) });
      return Response.json({
        room: code,
        token: owner.token,
        recoveryCode,
        game: gameView(game, owner.id),
      });
    }
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
      me.seen = Date.now();
      const result = await applyGameAction(g, me, row.id, b);
      if (result instanceof Response) return result;
      recoveryCode = result.recoveryCode ?? recoveryCode;
      const { generatedLevels } = result;
      reconcileGenerationMetadata(g);
      reconcileInitiative(g);
      if (g.atlas?.battle || g.atlas?.lighting?.enabled) refreshSight(g);
      // A concurrent write invalidates this revision; retry with the latest room.
      const updated = await db
        .update(rooms)
        .set({ data: JSON.stringify(g), version: row.version + 1 })
        .where(and(eq(rooms.id, row.id), eq(rooms.version, row.version)))
        .returning({ id: rooms.id });
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
    return fail('Stůl je zaneprázdněný, zopakuj akci.', 409);
  } catch {
    return fail('Akci se nepodařilo uložit. Zkontroluj spojení.', 503);
  }
}
