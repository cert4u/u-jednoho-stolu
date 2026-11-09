import { MAP_WIDTH, MAP_HEIGHT } from '../../../lib/map-limits';
import { appendMessage } from '../../../lib/message-operations';
import type { CatalogResolver } from '../../../lib/catalogs/resolver';
import { guardPatch } from '../../../lib/sheets';
import type { Game, Member, Msg } from '../../../lib/game';
import { fail } from './responses';
import { applyDomainAction, type ActionResult } from './actions/domain';
import { applyMapAction, applyExplorationAction } from './actions/map';
import { applyMemberAction } from './actions/members';

// Dispatch against one revision; the route can reapply the action if the write loses a race.
export async function applyGameAction(
  game: Game,
  member: Member,
  roomId: string,
  body: Record<string, unknown>,
  library?: CatalogResolver,
  preparedMessage?: Msg,
): Promise<ActionResult | Response> {
  const pj = member.role === 'pj';
  switch (body.action) {
    case 'recover':
    case 'join':
      break;
    case 'chat':
    case 'roll':
      try {
        await appendMessage(game, member, body, preparedMessage);
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Zprávu nelze odeslat.');
      }
      break;
    case 'map':
      if (!pj) return fail('Mapu připravuje a odkrývá pouze Pán jeskyně.', 403);
      return applyMapAction(game, body, library) ?? {};
    case 'cell':
      return fail('Použij nový editor mapy.', pj ? 400 : 403);
    case 'explore':
      return applyExplorationAction(game, member, body) ?? {};
    case 'move':
      {
        if (game.atlas?.location)
          return fail('Použij společný pohyb družiny.', 403);
        const target = game.members.find((m) => m.id === body.id);
        const x = Number(body.x),
          y = Number(body.y);
        if (!target || (!pj && target.id !== member.id))
          return fail('Tuto postavu nelze posunout.', 403);
        if (
          !Number.isInteger(x) ||
          !Number.isInteger(y) ||
          x < 0 ||
          x >= MAP_WIDTH ||
          y < 0 ||
          y >= MAP_HEIGHT
        )
          return fail('Mimo mapu.');
        target.x = x;
        target.y = y;
      }
      break;
    case 'access-key':
    case 'member-archive':
    case 'member-restore':
      return applyMemberAction(game, member, roomId, body);
    case 'notes':
      if (!pj) return fail('Poznámky jsou pouze pro PJ.', 403);
      try {
        guardPatch(body, { notes: game.notes, scene: game.scene, title: game.title });
        if (body.notes !== undefined) game.notes = String(body.notes).slice(0, 20000);
        if (body.scene !== undefined) game.scene = String(body.scene).slice(0, 100);
        if (body.title !== undefined) game.title = String(body.title).slice(0, 100);
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Neplatná příprava.', 409);
      }
      break;
    default:
      return applyDomainAction({ game, member, body, library });
  }
  return {};
}
