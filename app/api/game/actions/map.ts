import type { Game, Member } from '../../../../lib/game';
import type { CatalogResolver } from '../../../../lib/catalogs/resolver';
import { resolvedScenery } from '../../../../lib/catalogs/visuals';
import { sceneryFillBlocked } from '../../../../lib/scenery-fill';
import {
  ensureAtlas,
  getLevel,
  refreshSight,
  remember,
  explorationAction,
} from '../../../../lib/exploration';
import { applyMap, playerDungeon, cellKey } from '../../../../lib/dungeon';
import { EditConflict } from '../../../../lib/sheets';
import { fail } from '../responses';

function mapCommand(game: Game, levelId: string, body: Record<string, unknown>) {
  return body.tool === 'scenery-fill'
    ? { ...body, fillBlocked: sceneryFillBlocked(game, levelId) }
    : body;
}

// Commit edited geometry only after checking occupied party and battle cells.
export function applyMapAction(
  game: Game,
  body: Record<string, unknown>,
  library?: CatalogResolver,
) {
  try {
    if (game.atlas) {
      const atlas = ensureAtlas(game);
      const level = getLevel(atlas, body.levelId);
      const draft = { ...game, dungeon: level.map, mapHistory: level.history };
      applyMap(draft, mapCommand(game, level.id, body), resolvedScenery(library));
      if (
        atlas.battle?.levelId === level.id &&
        game.members.some(
          (m) =>
            m.role === 'player' &&
            !m.archived &&
            !draft.dungeon!.floors.includes(cellKey(m.x, m.y)),
        )
      )
        return fail('Nejdřív přemísti postavy z upravovaného políčka.');
      if (
        atlas.location?.levelId === level.id &&
        !draft.dungeon!.floors.includes(cellKey(atlas.location.x, atlas.location.y))
      )
        return fail('Nejdřív přemísti družinu z upravovaného políčka.');
      level.map = draft.dungeon!;
      level.history = draft.mapHistory || [];
      game.mapOperations = draft.mapOperations;
      if (body.tool === 'reveal') remember(level, level.map.revealed);
      else if (body.tool === 'hide' || body.tool === 'undo')
        level.memory = playerDungeon({
          ...level.memory,
          revealed: level.map.revealed,
        });
      if (!atlas.location) remember(level, level.map.revealed);
      refreshSight(game);
    } else {
      applyMap(game, mapCommand(game, 'ground', body), resolvedScenery(library));
    }
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : 'Tah mapy se nepodařil.',
      error instanceof EditConflict ? 409 : 400,
    );
  }
}

export function applyExplorationAction(
  game: Game,
  member: Member,
  body: Record<string, unknown>,
) {
  if (
    member.role !== 'pj' &&
    [
      'enable',
      'level-add',
      'level-rename',
      'settings',
      'place',
      'stairs-add',
      'stairs-remove',
      'battle-start',
      'battle-end',
      'lighting',
    ].includes(String(body.op))
  )
    return fail('Tuto změnu může provést pouze PJ.', 403);
  if (
    member.role !== 'pj' &&
    ['move', 'door', 'travel'].includes(String(body.op)) &&
    game.atlas?.leaderId !== member.id
  )
    return fail('Družinu ovládá pouze vedoucí nebo PJ.', 403);
  try {
    explorationAction(game, member, body);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : 'Akce průzkumu se nepodařila.',
    );
  }
}
