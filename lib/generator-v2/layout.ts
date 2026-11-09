import { cellKey, type Point } from '../dungeon';
import type { GeneratorOptions, LogicalRoom } from '../generator-types';
import {
  DIRS,
  PRESETS,
  orderCells,
  shuffle,
  type Random,
  type Slot,
} from './primitives';

function partition(total: number, count: number, min: number, random: Random) {
  const parts = Array<number>(count).fill(min);
  for (let left = total - count * min; left > 0; left--)
    parts[Math.floor(random() * count)]++;
  return parts;
}
export function planSlots(options: GeneratorOptions, random: Random): Slot[] {
  const min = PRESETS[options.size].min + 2,
    choices: { cols: number; rows: number; score: number }[] = [];
  for (let cols = 1; cols <= Math.floor(26 / min); cols++)
    for (let rows = 1; rows <= Math.floor(18 / min); rows++)
      if (cols * rows >= options.rooms && cols * rows <= options.rooms + 2)
        choices.push({
          cols,
          rows,
          score:
            (cols * rows - options.rooms) * 3 +
            Math.abs(26 / cols / (18 / rows) - 1) +
            random() * 0.8,
        });
  choices.sort((a, b) => a.score - b.score);
  const grid = choices[0];
  if (!grid)
    throw Error(
      'Tolik místností se v této velikosti nevejde na papír 28 × 20.',
    );
  const widths = partition(26, grid.cols, min, random),
    heights = partition(18, grid.rows, min, random),
    slots: Slot[] = [];
  let y = 1;
  for (let row = 0; row < grid.rows; row++) {
    let x = 1;
    for (let col = 0; col < grid.cols; col++) {
      slots.push({ x, y, width: widths[col], height: heights[row], col, row });
      x += widths[col];
    }
    y += heights[row];
  }
  // Choose a connected polyomino before any room shape is drawn.
  const corners = slots.filter(
    (s) =>
      (s.col === 0 || s.col === grid.cols - 1) &&
      (s.row === 0 || s.row === grid.rows - 1),
  );
  const chosen = [corners[Math.floor(random() * corners.length)]],
    selected = new Set(chosen),
    stack = [chosen[0]];
  const adjacent = (a: Slot, b: Slot) =>
    Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
  while (chosen.length < options.rooms) {
    let next: Slot | undefined;
    if (options.style === 'mine') {
      while (stack.length && !next) {
        next = shuffle(
          slots.filter((s) => !selected.has(s) && adjacent(stack.at(-1)!, s)),
          random,
        )[0];
        if (!next) stack.pop();
      }
      if (next) stack.push(next);
    } else {
      const frontier = shuffle(
        slots.filter(
          (s) => !selected.has(s) && chosen.some((c) => adjacent(c, s)),
        ),
        random,
      );
      if (options.style === 'cave')
        frontier.sort(
          (a, b) =>
            chosen.filter((c) => adjacent(b, c)).length -
            chosen.filter((c) => adjacent(a, c)).length,
        );
      next = frontier[0];
    }
    if (!next) throw Error('Nelze naplánovat souvislé rozložení místností.');
    selected.add(next);
    chosen.push(next);
  }
  return chosen;
}
export function planGraph(
  slots: Slot[],
  options: GeneratorOptions,
  random: Random,
) {
  const available: [number, number][] = [];
  for (let a = 0; a < slots.length; a++)
    for (let b = a + 1; b < slots.length; b++)
      if (
        Math.abs(slots[a].col - slots[b].col) +
          Math.abs(slots[a].row - slots[b].row) ===
        1
      )
        available.push([a, b]);
  const links: [number, number][] = [],
    visited = new Set([0]),
    stack = [0];
  while (visited.size < slots.length) {
    let selected: [number, number] | undefined;
    if (options.style === 'mine') {
      while (stack.length && !selected) {
        const a = stack.at(-1)!;
        selected = shuffle(
          available.filter(
            ([x, y]) =>
              (x === a && !visited.has(y)) || (y === a && !visited.has(x)),
          ),
          random,
        )[0];
        if (!selected) stack.pop();
      }
      if (selected)
        stack.push(visited.has(selected[0]) ? selected[1] : selected[0]);
    } else {
      let choices = shuffle(
        available.filter(([a, b]) => visited.has(a) !== visited.has(b)),
        random,
      );
      if (options.style === 'cave')
        choices = choices.sort(
          (a, b) =>
            links.filter((p) => p.includes(b.find((n) => visited.has(n))!))
              .length -
            links.filter((p) => p.includes(a.find((n) => visited.has(n))!))
              .length,
        );
      selected = choices[0];
    }
    if (!selected) throw Error('Graf místností není souvislý.');
    links.push(selected);
    visited.add(selected[0]);
    visited.add(selected[1]);
  }
  const extras = shuffle(
    available.filter(([a, b]) => !links.some(([x, y]) => x === a && y === b)),
    random,
  );
  links.push(
    ...extras.slice(
      0,
      Math.floor(random() * (Math.min(options.connections, extras.length) + 1)),
    ),
  );
  const neighbors = slots.map((_, i) =>
    links.flatMap(([a, b]) => (a === i ? [b] : b === i ? [a] : [])),
  );
  const queue = [0],
    parents = new Map<number, number | null>([[0, null]]);
  for (let i = 0; i < queue.length; i++)
    for (const next of neighbors[queue[i]])
      if (!parents.has(next)) {
        parents.set(next, queue[i]);
        queue.push(next);
      }
  const goal = queue.at(-1)!,
    main: number[] = [];
  let cursor: number | null = goal;
  while (cursor !== null) {
    main.push(cursor);
    cursor = parents.get(cursor) ?? null;
  }
  main.reverse();
  return { links, neighbors, goal, main };
}
export function drawRoom(
  slot: Slot,
  index: number,
  level: number,
  options: GeneratorOptions,
  random: Random,
): LogicalRoom {
  const preset = PRESETS[options.size],
    pick = (min: number, max: number) =>
      min + Math.floor(random() * (max - min + 1));
  let width = pick(preset.min, Math.min(preset.max, slot.width - 2)),
    height = pick(preset.min, Math.min(preset.max, slot.height - 2));
  if (options.style === 'mine') {
    if (random() < 0.55) {
      width = Math.min(slot.width - 2, Math.max(width, preset.min + 1));
      height = Math.min(height, 2 + Math.floor(random() * 2));
    } else {
      height = Math.min(slot.height - 2, Math.max(height, preset.min + 1));
      width = Math.min(width, 2 + Math.floor(random() * 2));
    }
  }
  const x = pick(slot.x + 1, slot.x + slot.width - width - 1),
    y = pick(slot.y + 1, slot.y + slot.height - height - 1),
    center: Point = [x + Math.floor(width / 2), y + Math.floor(height / 2)],
    cells = new Set<string>();
  for (let dy = 0; dy < height; dy++)
    for (let dx = 0; dx < width; dx++) {
      let fill = true;
      if (options.style === 'cave') {
        const nx = (dx - (width - 1) / 2) / (width / 2),
          ny = (dy - (height - 1) / 2) / (height / 2);
        fill =
          dx === Math.floor(width / 2) ||
          dy === Math.floor(height / 2) ||
          nx * nx + ny * ny < 0.75 + random() * 0.4;
      }
      if (fill) cells.add(cellKey(x + dx, y + dy));
    }
  // Organic rooms retain a connected central cross and deliberately irregular outline.
  if (options.style === 'cave' && width > 1 && height > 1)
    cells.delete(cellKey(x, y));
  const connected = new Set<string>([cellKey(...center)]),
    queue = [center];
  for (let i = 0; i < queue.length; i++)
    for (const [dx, dy] of DIRS) {
      const p: Point = [queue[i][0] + dx, queue[i][1] + dy],
        key = cellKey(...p);
      if (cells.has(key) && !connected.has(key)) {
        connected.add(key);
        queue.push(p);
      }
    }
  return {
    id: `v2-l${level}-r${index}`,
    x,
    y,
    width,
    height,
    center,
    cells: orderCells(connected),
    role: index === 0 ? 'entrance' : 'room',
    neighbors: [],
    mainPath: false,
  };
}
