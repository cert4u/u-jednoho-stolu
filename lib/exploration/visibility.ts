import type { Game } from '../game';
import type { Point } from '../dungeon';
import {
  DEFAULT_LIGHT_RADIUS,
  lightVisibility,
  type LightSource,
} from '../lighting';
import { ensureAtlas } from './atlas';
import { sight } from './geometry';
import { remember } from './memory';

export function activeLightSources(g: Game): LightSource[] {
  const a = g.atlas;
  if (!a?.location) return [];
  const heroes = g.members.filter((m) => m.role === 'player' && !m.archived),
    leader = heroes.find((m) => m.id === a.leaderId) || heroes[0];
  return (g.journey?.lights || []).flatMap((light) => {
    if (!light.lit || light.remaining === 0) return [];
    const carrier = light.carrierId
      ? heroes.find((m) => m.id === light.carrierId)
      : leader;
    if (light.carrierId && !carrier) return [];
    return [
      {
        point:
          a.battle && carrier
            ? ([carrier.x, carrier.y] as Point)
            : ([a.location!.x, a.location!.y] as Point),
        radius: light.radius ?? DEFAULT_LIGHT_RADIUS,
      },
    ];
  });
}

export function refreshSight(g: Game) {
  const a = ensureAtlas(g);
  for (const level of a.levels) {
    const active = a.location?.levelId === level.id;
    const origins: Point[] =
      a.battle && a.battle.levelId === level.id
        ? g.members
            .filter((m) => m.role === 'player' && !m.archived)
            .map((m) => [m.x, m.y] as Point)
        : active
          ? [[a.location!.x, a.location!.y]]
          : [];
    if (active && !origins.length) origins.push([a.location!.x, a.location!.y]);
    level.visible =
      a.lighting?.enabled && active
        ? lightVisibility(
            level.map,
            origins,
            activeLightSources(g),
            a.radius,
            a.lighting.darkRadius,
            sight,
          )
        : [
            ...new Set(
              origins.flatMap((from) => sight(level.map, from, a.radius)),
            ),
          ];
    // Persist only light-limited visibility, including each step of a group move.
    if (level.visible.length) remember(level, level.visible);
  }
  if (a.location && !a.battle)
    for (const member of g.members.filter(
      (m) => m.role === 'player' && !m.archived,
    )) {
      member.x = a.location.x;
      member.y = a.location.y;
    }
}
