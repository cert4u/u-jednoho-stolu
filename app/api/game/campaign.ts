import { prepareActionCatalog } from '../../../lib/catalogs/game-content';
import { validateCampaignImages } from '../../../lib/catalogs/image-snapshot';
import { initialGame, type Game } from '../../../lib/game';
import { makeBackup, readBackup, validateBackup } from '../../../lib/backup';
import { startAdventure } from '../../../lib/start-adventure';
import { issueRecovery } from '../../../lib/access';
import { refreshSight } from '../../../lib/exploration';
import { reconcileInitiative } from '../../../lib/initiative';
import { packGameView } from '../../../lib/game-view-wire';
import { admitRoom } from './admission';
import { assertCampaignFits, serializeCampaign } from './room-store';
import { fail, gameHeaders as headers } from './responses';
import { gameView } from './view';

export async function createRoom(
  body: Record<string, unknown>,
  shared: boolean,
) {
  const code = crypto
    .randomUUID()
    .replaceAll('-', '')
    .slice(0, 10)
    .toUpperCase();
  let game: Game;
  try {
    game =
      body.action === 'restore'
        ? readBackup(body.backup)
        : initialGame(
            String(body.name || 'Pán jeskyně').slice(0, 30),
            crypto.randomUUID(),
          );
    if (body.action === 'restore')
      await validateCampaignImages(game.contentLibrary);
    if (body.action === 'create' && body.adventureId !== undefined) {
      const owner = game.members[0];
      const library = await prepareActionCatalog(game, owner, body);
      startAdventure(game, owner, body.adventureId, library);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Neplatná záloha.');
  }
  reconcileInitiative(game);
  if (game.atlas?.lighting?.enabled) refreshSight(game);
  const owner = game.members.find((m) => m.role === 'pj')!;
  const recoveryCode = await issueRecovery(owner, code);
  const serialized = serializeCampaign(game);
  const response = Response.json({
    room: code,
    token: owner.token,
    recoveryCode,
    game: packGameView(gameView(game, owner.id), shared),
  });
  const denied = await admitRoom(code, serialized);
  return denied ?? response;
}

export async function downloadCampaign(game: Game) {
  const backup = makeBackup(game);
  try {
    // Exercise import normalization and storage overhead without issuing real credentials.
    const campaign = validateBackup(backup);
    const restored: Game = {
      ...campaign,
      members: campaign.members.map((member) => ({
        ...member,
        token: '0'.repeat(36),
      })),
    };
    restored.members.find((member) => member.role === 'pj')!.recoveryHash =
      '0'.repeat(64);
    reconcileInitiative(restored);
    if (restored.atlas?.lighting?.enabled) refreshSight(restored);
    assertCampaignFits(restored);
    await validateCampaignImages(game.contentLibrary);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : 'Záloha není obnovitelná.',
      409,
    );
  }
  return Response.json(backup, {
    headers: {
      ...headers,
      'Content-Disposition': 'attachment; filename="kampan-zaloha.json"',
    },
  });
}
