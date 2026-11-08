import { rememberSurfaces } from '../surfaces';
import { rememberScenery } from '../scenery';
import { observableDungeon, cellKey, edgeCells } from '../dungeon';
import type { Level } from './model';

// Refresh observed cells and their adjacent edges; keep other remembered areas intact.
export function remember(level: Level, keys: string[]) {
  const source = observableDungeon(level.map);
  const seen = new Set([...level.memory.revealed, ...keys]);
  const visible = new Set(keys),
    floors = new Set(level.memory.floors);
  for (const key of keys) {
    if (source.floors.includes(key)) floors.add(key);
    else floors.delete(key);
  }
  const edges = { ...level.memory.edges };
  for (const key of Object.keys(edges))
    if (edgeCells(key).some((k) => visible.has(k))) delete edges[key];
  for (const [key, value] of Object.entries(source.edges))
    if (edgeCells(key).some((k) => visible.has(k))) edges[key] = value;
  const open = new Set(level.memory.openDoors || []);
  for (const key of Object.keys({ ...level.memory.edges, ...source.edges }))
    if (edgeCells(key).some((k) => visible.has(k))) {
      if (source.openDoors?.includes(key)) open.add(key);
      else open.delete(key);
    }
  const marks = { ...level.memory.stairMarks };
  for (const key of keys) {
    delete marks[key];
    if (source.stairMarks?.[key]) marks[key] = source.stairMarks[key];
  }
  const access = { ...level.memory.access };
  for (const kind of ['entrance', 'exit'] as const) {
    const old = access[kind],
      current = source.access?.[kind];
    if (old && visible.has(cellKey(...old))) delete access[kind];
    if (current && visible.has(cellKey(...current)))
      access[kind] = [...current];
  }
  level.memory = {
    ...(source.surfaces || level.memory.surfaces
      ? { surfaces: rememberSurfaces(level.memory, source, visible) }
      : {}),
    ...(source.scenery || level.memory.scenery
      ? { scenery: rememberScenery(level.memory, source, visible) }
      : {}),
    ...(source.access || level.memory.access ? { access } : {}),
    floors: [...floors],
    edges,
    revealed: [...seen],
    openDoors: [...open],
    stairMarks: marks,
  };
  level.map.revealed = [...seen];
}
