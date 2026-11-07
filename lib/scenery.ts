import { z } from 'zod';
import type { Dungeon } from './dungeon';
import { EditConflict } from './sheets';

export const sceneryKinds = ['crate', 'barrel', 'table', 'bench', 'shelf', 'pillar', 'rubble', 'boulder', 'mushrooms', 'roots', 'cart', 'support'] as const;
export type SceneryKind = typeof sceneryKinds[number];
export const sceneryCatalog: { kind: SceneryKind; name: string; environments: string[] }[] = [
  { kind: 'crate', name: 'Bedna', environments: ['castle','mine'] },
  { kind: 'barrel', name: 'Sud', environments: ['castle','mine'] },
  { kind: 'table', name: 'Stůl', environments: ['castle'] },
  { kind: 'bench', name: 'Lavice', environments: ['castle'] },
  { kind: 'shelf', name: 'Police', environments: ['castle'] },
  { kind: 'pillar', name: 'Sloup', environments: ['castle'] },
  { kind: 'rubble', name: 'Suť', environments: ['castle','mine','cave'] },
  { kind: 'boulder', name: 'Balvan', environments: ['mine','cave'] },
  { kind: 'mushrooms', name: 'Houby', environments: ['cave'] },
  { kind: 'roots', name: 'Kořeny', environments: ['castle','cave'] },
  { kind: 'cart', name: 'Důlní vozík', environments: ['mine'] },
  { kind: 'support', name: 'Dřevěná podpěra', environments: ['mine'] },
];
export const scenerySchema = z.object({
  id: z.string().uuid(), kind: z.enum(sceneryKinds),
  x: z.number().int().min(0).max(27), y: z.number().int().min(0).max(19),
  rotation: z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]),
  size: z.enum(['small','medium','large']),
  note: z.string().max(1000).optional(), hidden: z.boolean().optional(),
  revision: z.union([z.string().uuid(), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)]).optional(),
}).strict();
export type Scenery = z.infer<typeof scenerySchema>;
export const sceneryListSchema = z.array(scenerySchema).max(560).refine(items => new Set(items.map(item => item.id)).size === items.length && new Set(items.map(item => `${item.x},${item.y}`)).size === items.length);
export const sceneryName = (kind: SceneryKind) => sceneryCatalog.find(item => item.kind === kind)!.name;
const cell = (x: number, y: number) => `${x},${y}`;

/** Outside marks belong to adjacent known floor, never to distant hidden terrain. */
export function sceneryCells(item: Scenery, map: Pick<Dungeon,'floors'>): string[] {
  const key = cell(item.x,item.y);
  if (map.floors.includes(key)) return [key];
  return [[item.x-1,item.y],[item.x+1,item.y],[item.x,item.y-1],[item.x,item.y+1]]
    .map(([x,y]) => cell(x,y)).filter(key => map.floors.includes(key));
}
export function publicScenery(items: Scenery[] = []): Scenery[] {
  return items.filter(item => !item.hidden).map(({ id, kind, x, y, rotation, size }) => ({ id, kind, x, y, rotation, size }));
}
export function observedScenery(map: Dungeon, seen: ReadonlySet<string>): Scenery[] {
  return publicScenery(map.scenery).filter(item => sceneryCells(item,map).some(key => seen.has(key)));
}
export function rememberScenery(memory: Dungeon, source: Dungeon, visible: ReadonlySet<string>): Scenery[] {
  const current = observedScenery(source,visible), ids = new Set(current.map(item => item.id)), positions = new Set(current.map(item => cell(item.x,item.y)));
  return [...publicScenery(memory.scenery).filter(item => !ids.has(item.id) && !positions.has(cell(item.x,item.y)) && !sceneryCells(item,memory).some(key => visible.has(key))), ...current];
}

/** Called on the cloned map inside the ordinary map/undo transaction. */
export function editScenery(map: Dungeon, input: Record<string,unknown>) {
  const items = map.scenery ?? [];
  const previous = items.find(item => item.id === input.sceneryId);
  if (input.sceneryId && !previous || input.expectedRevision !== (previous ? previous.revision ?? 0 : null))
    throw new EditConflict('Stafáž se mezitím změnila. Otevři prvek znovu; rozepsané údaje zůstávají zachované.');
  if (input.op === 'remove') {
    if (!previous) throw new Error('Vyber existující prvek stafáže.');
    map.scenery = items.filter(item => item.id !== previous.id);
    return;
  }
  if (input.op !== 'save') throw new Error('Neznámá úprava stafáže.');
  const result = scenerySchema.safeParse({
    id: previous?.id ?? crypto.randomUUID(), kind: input.kind, x: input.x, y: input.y,
    rotation: input.rotation, size: input.size, note: input.note, hidden: input.hidden,
    // A fresh token prevents stale edits after undo restores an older snapshot (ABA).
    revision: crypto.randomUUID(),
  });
  if (!result.success) throw new Error('Vyber platný prvek, políčko, otočení a velikost; poznámka smí mít nejvýše 1000 znaků.');
  if (!previous && items.length >= 200) throw new Error('Na patře může být nejvýše 200 prvků stafáže.');
  if (items.some(item => item.id !== previous?.id && item.x === result.data.x && item.y === result.data.y))
    throw new Error('Na tomto políčku už stafáž je. Vyber ji pro úpravu.');
  map.scenery = previous ? items.map(item => item.id === previous.id ? result.data : item) : [...items, result.data];
}
