import type { Game } from '../game';
import { cellKey, playerDungeon } from '../dungeon';
import type { ExplorationView } from './model';
import { getLevel } from './atlas';
import { activeLightSources } from './visibility';

export function explorationView(
  g: Game,
  pj: boolean,
  requested?: string,
): ExplorationView | undefined {
  if (!g.atlas) return;
  const a = g.atlas;
  const level = getLevel(a, pj ? requested : undefined);
  const known = new Set(level.memory.revealed);
  return {
    ...(a.lighting
      ? {
          lighting: {
            ...a.lighting,
            activeLights: activeLightSources(g).length,
          },
        }
      : {}),
    ...(a.battle ? { battle: a.battle } : {}),
    enabled: !!a.location,
    ...(pj && level.map.access?.entrance
      ? { entrance: level.map.access.entrance }
      : {}),
    leaderId: a.leaderId,
    order: a.order,
    radius: a.radius,
    location: a.location,
    levelId: level.id,
    levelName:
      pj || known.size || a.location?.levelId === level.id
        ? level.name
        : 'Neprozkoumané patro',
    levels: a.levels
      .filter(
        (l) => pj || l.memory.revealed.length || l.id === a.location?.levelId,
      )
      .map(({ id, name }) => ({ id, name })),
    visible: level.visible,
    playerMap: playerDungeon(level.memory),
    stairs: a.stairs.flatMap((s) => {
      const here =
        s.a.levelId === level.id
          ? s.a
          : s.b.levelId === level.id
            ? s.b
            : undefined;
      if (!here || (!pj && !known.has(cellKey(here.x, here.y)))) return [];
      const destination = here === s.a ? s.b : s.a;
      return [
        {
          id: s.id,
          x: here.x,
          y: here.y,
          ...(pj
            ? {
                destination,
                destinationName: getLevel(a, destination.levelId).name,
              }
            : {}),
        },
      ];
    }),
  };
}
