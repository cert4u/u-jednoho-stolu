import type { Game } from '../game';
import type { Atlas } from './model';
import { dungeonFor, playerDungeon } from '../dungeon';

export function ensureAtlas(g: Game): Atlas {
  if (!g.atlas) {
    const map = structuredClone(dungeonFor(g));
    g.atlas = {
      levels: [
        {
          id: 'ground',
          name: 'Přízemí',
          map,
          history: g.mapHistory || [],
          memory: playerDungeon(map),
          visible: [],
        },
      ],
      leaderId: '',
      order: [],
      radius: 5,
      stairs: [],
      operations: [],
    };
  }
  const a = g.atlas;
  const ids = g.members
    .filter((m) => m.role === 'player' && !m.archived)
    .map((m) => m.id);
  a.order = [
    ...a.order.filter((id) => ids.includes(id)),
    ...ids.filter((id) => !a.order.includes(id)),
  ];
  if (a.leaderId && !ids.includes(a.leaderId)) a.leaderId = '';
  return a;
}

export function getLevel(a: Atlas, id?: unknown) {
  const level =
    a.levels.find((l) => l.id === (id || a.location?.levelId)) ||
    (!id ? a.levels[0] : undefined);
  if (!level) throw new Error('Patro neexistuje.');
  return level;
}
