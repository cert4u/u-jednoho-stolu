import { resolvedScenery } from '../../../lib/catalogs/visuals';
import { RoomStorageSizeError } from '../../../lib/room-storage-limit';
import {
  messageReplay,
  MessageReplayError,
} from '../../../lib/message-operations';
import {
  prepareActionCatalog,
  portraitForCatalog,
} from '../../../lib/catalogs/game-content';
import { loadCatalogs } from '../../../lib/catalogs/runtime';
import type { Game, Msg } from '../../../lib/game';
import { CampaignSizeError, readGameRequest } from '../../../lib/backup-limits';
import { pendingCombat } from '../../../lib/mechanics';
import { refreshSight } from '../../../lib/exploration';
import { reconcileInitiative } from '../../../lib/initiative';
import { reconcileGenerationMetadata } from '../../../lib/generator-provenance';
import {
  packGameView,
  sharedPortraitFormat,
  sharedPortraitHeader,
} from '../../../lib/game-view-wire';
import { applyGameAction } from './actions';
import { createRoom, downloadCampaign } from './campaign';
import {
  authenticatedMember,
  repairLegacyMemberPositions,
  resolveActionMember,
} from './room-access';
import { readRoom, serializeCampaign, writeRoom } from './room-store';
import { gameView, missingViewLevel } from './view';
import { publicAccounts, pjAccount } from './public-accounts';
import { playDate } from '../../../server/play-calendar.mjs';
import { playMarker } from './play-activity';
import { conditionalView } from './conditional-view';
import { fail, gameHeaders as headers } from './responses';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const wantsBackup = url.searchParams.get('download') === 'backup';
    const row = await readRoom(
      url.searchParams.get('room') || '',
      wantsBackup && publicAccounts(),
    );
    if (!row) return fail('Místnost neexistuje.', 404);
    const game = repairLegacyMemberPositions(JSON.parse(row.data) as Game);
    const member = authenticatedMember(game, request);
    if (!member) return fail('Připoj se k místnosti.', 401);
    if (
      publicAccounts() &&
      member.role === 'pj' &&
      row.ownerId &&
      pjAccount(request) !== row.ownerId
    )
      return fail('Přihlas se ke svému účtu PJ.', 401);
    if (
      row.archivedAt !== null &&
      (member.role !== 'pj' ||
        !row.ownerId ||
        pjAccount(request) !== row.ownerId)
    )
      return fail('Místnost neexistuje.', 404);
    const managedInvites = publicAccounts() && Boolean(row.ownerId);
    if (url.searchParams.get('invite') === 'settings') {
      if (!managedInvites || member.role !== 'pj')
        return fail('Pozvánku spravuje pouze PJ.', 403);
      return Response.json(
        { token: row.inviteToken, paused: row.invitesPaused },
        { headers },
      );
    }
    const catalog = url.searchParams.get('catalog');
    if (catalog === 'bestiary') {
      if (member.role !== 'pj')
        return fail('Bestiář je dostupný pouze PJ.', 403);
      const library = await loadCatalogs(game.contentLibrary);
      return Response.json(
        library.list('bestiary').map((e) => ({
          ...e.data,
          portrait: portraitForCatalog(library, e.ref, game.contentLibrary),
          catalogSource: {
            id: e.catalogId,
            name: library.source(e.ref)?.bundle.manifest.name ?? e.catalogId,
            version: e.version,
            digest: e.digest,
          },
        })),
        { headers },
      );
    }
    if (catalog === 'preparation') {
      if (member.role !== 'pj')
        return fail('Přípravu katalogů používá pouze PJ.', 403);
      const library = await loadCatalogs(game.contentLibrary);
      return Response.json(
        {
          scenery: resolvedScenery(library),
          presets: library.list('dungeon-presets').map((e) => e.data),
        },
        { headers },
      );
    }
    if (wantsBackup) {
      if (member.role !== 'pj')
        return fail('Úplnou zálohu stahuje pouze PJ.', 403);
      pendingCombat(game, member.id);
      return await downloadCampaign(game);
    }
    const level = url.searchParams.get('level') || undefined;
    if (missingViewLevel(game, member, level)) return fail('Patro neexistuje.');
    const shared =
      request.headers.get(sharedPortraitHeader) === sharedPortraitFormat;
    const viewKey = JSON.stringify([
      member.id,
      member.role === 'pj' ? level : undefined,
      shared,
    ]);
    return conditionalView(request, row, viewKey, () =>
      packGameView(
        gameView(game, member.id, row.version, level, managedInvites),
        shared,
      ),
    );
  } catch {
    return fail('Spojení se stolem se nepodařilo. Zkus to znovu.', 503);
  }
}

export async function POST(request: Request) {
  try {
    const raw = await readGameRequest(request);
    if (raw === null) return fail('Požadavek je příliš velký.', 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail('Neplatný požadavek.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return fail('Neplatný požadavek.');
    const shared =
      request.headers.get(sharedPortraitHeader) === sharedPortraitFormat;
    const owner = pjAccount(request);
    if (body.action === 'create' || body.action === 'restore') {
      if (publicAccounts() && !owner)
        return fail(
          'Stůl může založit nebo importovat pouze schválený PJ.',
          403,
        );
      return await createRoom(body, shared, owner);
    }
    const roomId = String(body.room || '');
    const receivedAt = Date.now();
    let preparedMessage: Msg | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      const row = await readRoom(roomId);
      if (!row) return fail('Tento kód místnosti neznáme.', 404);
      const managedInvites = publicAccounts() && Boolean(row.ownerId);
      if (body.action === 'join' && managedInvites) {
        if (row.invitesPaused)
          return fail('PJ pozastavil vstup nových hráčů.', 403);
        if (row.inviteToken && body.invite !== row.inviteToken)
          return fail(
            body.invite
              ? 'Pozvánka už neplatí. Požádej PJ o nový odkaz.'
              : 'K tomuto stolu potřebuješ celý odkaz od PJ.',
            403,
          );
      }
      const game = repairLegacyMemberPositions(JSON.parse(row.data) as Game);
      const access = await resolveActionMember(game, row.id, request, body);
      if (access instanceof Response) return access;
      const { member, token } = access;
      if (
        publicAccounts() &&
        member.role === 'pj' &&
        row.ownerId &&
        owner !== row.ownerId
      )
        return fail('Přihlas se ke svému účtu PJ.', 401);
      const requestedLevel =
        typeof body.levelId === 'string' ? body.levelId : undefined;
      try {
        if (await messageReplay(game, member, body))
          return Response.json(
            {
              game: packGameView(
                gameView(
                  game,
                  member.id,
                  row.version,
                  missingViewLevel(game, member, requestedLevel)
                    ? undefined
                    : requestedLevel,
                  managedInvites,
                ),
                shared,
              ),
            },
            { headers },
          );
      } catch (error) {
        return fail(
          error instanceof Error ? error.message : 'Neplatná zpráva.',
          error instanceof MessageReplayError ? 409 : 400,
        );
      }
      const playBefore =
        row.ownerId && publicAccounts()
          ? playMarker(game, member, body)
          : undefined;
      member.seen = Date.now();
      let library;
      try {
        library = await prepareActionCatalog(game, member, body);
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Katalog není dostupný.');
      }
      const result = await applyGameAction(
        game,
        member,
        row.id,
        body,
        library,
        preparedMessage,
      );
      if (result instanceof Response) return result;
      if (['chat', 'roll'].includes(String(body.action)))
        preparedMessage ??= game.messages.at(-1);
      const recoveryCode = result.recoveryCode ?? access.recoveryCode;
      const { generatedLevels } = result;
      reconcileGenerationMetadata(game);
      reconcileInitiative(game);
      if (game.atlas?.battle || game.atlas?.lighting?.enabled)
        refreshSight(game);
      const followsParty =
        body.action === 'explore' &&
        (body.op === 'travel' || body.op === 'place');
      const level =
        generatedLevels?.[0] ?? (followsParty ? undefined : requestedLevel);
      if (missingViewLevel(game, member, level))
        return fail('Patro neexistuje.');

      // Capture stored data before projection normalizes its view, then prepare the response before writing.
      const serialized = serializeCampaign(game);
      const response = Response.json(
        {
          game: packGameView(
            gameView(game, member.id, row.version + 1, level, managedInvites),
            shared,
          ),
          ...(generatedLevels ? { generatedLevels } : {}),
          ...(token ? { token, room: row.id } : {}),
          ...(recoveryCode ? { recoveryCode } : {}),
        },
        { headers },
      );
      const activity = !['join', 'recover', 'access-key'].includes(
        String(body.action),
      );
      const playedOn =
        playBefore !== undefined &&
        playBefore !== playMarker(game, member, body)
          ? playDate(receivedAt)
          : undefined;
      const write = await writeRoom(
        row,
        serialized,
        activity,
        member.role === 'pj' ? owner : undefined,
        playedOn,
      );
      if (write.status === 'owner-capacity')
        return fail(
          'Kampaně dosáhly limitu dat pro účet PJ. Uvolni místo nebo požádej správce o navýšení.',
          409,
        );
      if (write.status === 'capacity')
        return Response.json(
          {
            error: 'Instalace nemá kapacitu pro další data. Kontaktuj správce.',
          },
          { status: 503, headers: { ...headers, 'Retry-After': '60' } },
        );
      if (write.status === 'retry') continue; // Read the latest revision and reapply the action.
      return response;
    }
    return fail(
      'Stůl je zaneprázdněný nebo instalace nemá kapacitu pro další data. Zkus to znovu, případně kontaktuj správce.',
      409,
    );
  } catch (error) {
    if (
      error instanceof CampaignSizeError ||
      error instanceof RoomStorageSizeError
    )
      return fail(error.message, 413);
    console.error('game_write_failed');
    return fail('Akci se nepodařilo uložit. Zkontroluj spojení.', 503);
  }
}
