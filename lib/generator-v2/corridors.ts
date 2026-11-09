import { cellKey, type Point } from '../dungeon';
import type {
  GeneratorOptions,
  LogicalRoom,
  RoomConnection,
} from '../generator-types';
import type { planGraph } from './layout';
import {
  DIRS,
  edge,
  point,
  shuffle,
  type Random,
  type Slot,
} from './primitives';

function ports(
  room: LogicalRoom,
  dx: number,
  dy: number,
): { inside: Point; outside: Point }[] {
  const set = new Set(room.cells);
  return room.cells.flatMap((key) => {
    const inside = point(key),
      outside: Point = [inside[0] + dx, inside[1] + dy];
    return !set.has(cellKey(...outside)) ? [{ inside, outside }] : [];
  });
}
// Direction-aware A*: immutable room interiors and reserved corridor cells are obstacles.
function route(
  start: Point,
  end: Point,
  region: { x0: number; y0: number; x1: number; y1: number },
  blocked: Set<string>,
  noise: Map<string, number>,
  options: GeneratorOptions,
): Point[] | null {
  type State = {
    p: Point;
    direction: number;
    g: number;
    f: number;
    parent?: State;
  };
  const distance = (p: Point) =>
    Math.abs(p[0] - end[0]) + Math.abs(p[1] - end[1]);
  const open: State[] = [{ p: start, direction: 4, g: 0, f: distance(start) }],
    best = new Map<string, number>();
  let steps = 0;
  while (open.length && steps++ < 12000) {
    let index = 0;
    for (let i = 1; i < open.length; i++)
      if (open[i].f < open[index].f) index = i;
    const current = open.splice(index, 1)[0],
      state = cellKey(...current.p) + ':' + current.direction;
    if ((best.get(state) ?? Infinity) < current.g) continue;
    if (current.p[0] === end[0] && current.p[1] === end[1]) {
      const path: Point[] = [];
      let item: State | undefined = current;
      while (item) {
        path.push(item.p);
        item = item.parent;
      }
      return path.reverse();
    }
    for (let direction = 0; direction < DIRS.length; direction++) {
      const d = DIRS[direction],
        p: Point = [current.p[0] + d[0], current.p[1] + d[1]],
        key = cellKey(...p);
      if (
        p[0] < region.x0 ||
        p[0] > region.x1 ||
        p[1] < region.y0 ||
        p[1] > region.y1 ||
        blocked.has(key)
      )
        continue;
      const turn =
        current.direction !== 4 && current.direction !== direction
          ? options.style === 'castle'
            ? 0.65
            : 0.12
          : 0;
      const jitter =
          (noise.get(key) ?? 0) *
          (options.corridors === 'winding'
            ? options.style === 'cave'
              ? 3
              : 2
            : 0.1),
        g = current.g + 1 + turn + jitter,
        next = key + ':' + direction;
      if (g >= (best.get(next) ?? Infinity)) continue;
      best.set(next, g);
      open.push({ p, direction, g, f: g + distance(p), parent: current });
    }
  }
  return null;
}

// Corridor order is part of V2: each path reserves cells for the next one.
export function connectRooms(
  rooms: LogicalRoom[],
  slots: Slot[],
  graph: ReturnType<typeof planGraph>,
  allowed: Set<string>,
  options: GeneratorOptions,
  level: number,
  random: Random,
) {
  const blocked = new Set(rooms.flatMap((r) => r.cells));
  const corridors = new Set<string>();
  const connections: RoomConnection[] = [];
  const mainPairs = new Set(
    graph.main
      .slice(1)
      .map((n, i) => [n, graph.main[i]].sort((a, b) => a - b).join(':')),
  );
  const noise = new Map<string, number>();
  for (let y = 1; y < 19; y++)
    for (let x = 1; x < 27; x++) noise.set(cellKey(x, y), random());
  for (const [a, b] of graph.links) {
    const roomA = rooms[a],
      roomB = rooms[b],
      slotA = slots[a],
      slotB = slots[b],
      dx = Math.sign(slotB.col - slotA.col),
      dy = Math.sign(slotB.row - slotA.row),
      pa = shuffle(ports(roomA, dx, dy), random),
      pb = shuffle(ports(roomB, -dx, -dy), random);
    const pairs = pa
      .flatMap((from) =>
        pb.map((to) => ({
          from,
          to,
          distance:
            Math.abs(from.outside[0] - to.outside[0]) +
            Math.abs(from.outside[1] - to.outside[1]) +
            random() * 2,
        })),
      )
      .sort((x, y) => x.distance - y.distance);
    const region = {
      x0: Math.min(slotA.x, slotB.x),
      y0: Math.min(slotA.y, slotB.y),
      x1: Math.max(slotA.x + slotA.width, slotB.x + slotB.width) - 1,
      y1: Math.max(slotA.y + slotA.height, slotB.y + slotB.height) - 1,
    };
    let full: Point[] | null = null;
    for (const pair of pairs) {
      if (
        blocked.has(cellKey(...pair.from.outside)) ||
        blocked.has(cellKey(...pair.to.outside))
      )
        continue;
      const path = route(
        pair.from.outside,
        pair.to.outside,
        region,
        blocked,
        noise,
        options,
      );
      if (path) {
        full = [pair.from.inside, ...path, pair.to.inside];
        break;
      }
    }
    if (!full)
      throw Error('Chodbu nelze bezpečně vést mimo ostatní místnosti.');
    const doors =
      options.style === 'castle' ||
      (options.style === 'mine' && random() < 0.65)
        ? [edge(full[0], full[1]), edge(full.at(-2)!, full.at(-1)!)]
        : [];
    for (const p of full.slice(1, -1)) {
      const key = cellKey(...p);
      blocked.add(key);
      corridors.add(key);
    }
    for (let i = 1; i < full.length; i++)
      allowed.add(edge(full[i - 1], full[i]));
    connections.push({
      id: `v2-l${level}-c${connections.length}`,
      from: roomA.id,
      to: roomB.id,
      path: full,
      doors,
      mainPath: mainPairs.has([a, b].sort((x, y) => x - y).join(':')),
    });
  }
  return { corridors, connections };
}
