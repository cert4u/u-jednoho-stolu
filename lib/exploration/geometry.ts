import { cellKey, hiddenDoor, type Dungeon, type Point } from '../dungeon';
import type { Level } from './model';

export function between(a: Point, b: Point) {
  return a[0] === b[0]
    ? `h:${a[0]}:${Math.max(a[1], b[1])}`
    : `v:${Math.max(a[0], b[0])}:${a[1]}`;
}

function pass(map: Dungeon, a: Point, b: Point) {
  const edge = between(a, b);
  return (
    !map.edges[edge] ||
    (map.edges[edge] === 'door' &&
      !hiddenDoor(map, edge) &&
      !map.doorSettings?.[edge]?.locked &&
      map.openDoors?.includes(edge))
  );
}

function ray(map: Dungeon, from: Point, to: Point, floor: Set<string>) {
  let [x, y] = from;
  const dx = to[0] - x,
    dy = to[1] - y,
    sx = Math.sign(dx),
    sy = Math.sign(dy);
  let tx = dx === 0 ? Infinity : 0.5 / Math.abs(dx),
    ty = dy === 0 ? Infinity : 0.5 / Math.abs(dy);
  while (x !== to[0] || y !== to[1]) {
    const p: Point = [x, y];
    // A diagonal ray must pass both sides of the corner, not peek through walls.
    if (Math.abs(tx - ty) < 1e-9) {
      const h: Point = [x + sx, y],
        v: Point = [x, y + sy],
        next: Point = [x + sx, y + sy];
      if (
        !floor.has(cellKey(...h)) ||
        !floor.has(cellKey(...v)) ||
        !pass(map, p, h) ||
        !pass(map, p, v) ||
        !pass(map, h, next) ||
        !pass(map, v, next)
      )
        return false;
      x += sx;
      y += sy;
      tx += 1 / Math.abs(dx);
      ty += 1 / Math.abs(dy);
    } else if (tx < ty) {
      const next: Point = [x + sx, y];
      if (!pass(map, p, next)) return false;
      x += sx;
      tx += 1 / Math.abs(dx);
    } else {
      const next: Point = [x, y + sy];
      if (!pass(map, p, next)) return false;
      y += sy;
      ty += 1 / Math.abs(dy);
    }
    if (!floor.has(cellKey(x, y))) return false;
  }
  return true;
}

export function sight(map: Dungeon, from: Point, radius: number) {
  const floor = new Set(map.floors);
  if (!floor.has(cellKey(...from))) return [];
  return map.floors.filter((key) => {
    const p = key.split(',').map(Number) as Point;
    return (
      Math.hypot(p[0] - from[0], p[1] - from[1]) <= radius &&
      ray(map, from, p, floor)
    );
  });
}

export function knownPath(
  level: Level,
  start: Point,
  to: Point,
  failureMessage = 'Do cíle nevede známá průchozí cesta.',
): Point[] {
  const known = new Set(level.memory.floors),
    floor = new Set(level.map.floors),
    queue: Point[] = [start],
    parents = new Map<string, Point | null>([[cellKey(...start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (p.join() === to.join()) break;
    // Keep neighbor order stable: it also determines the chosen shortest path.
    for (const n of [
      [p[0] + 1, p[1]],
      [p[0] - 1, p[1]],
      [p[0], p[1] + 1],
      [p[0], p[1] - 1],
    ] as Point[]) {
      const key = cellKey(...n);
      if (
        known.has(key) &&
        floor.has(key) &&
        !parents.has(key) &&
        pass(level.map, p, n)
      ) {
        parents.set(key, p);
        queue.push(n);
      }
    }
  }
  if (!parents.has(cellKey(...to))) throw new Error(failureMessage);
  const out: Point[] = [];
  let p: Point | null = to;
  while (p) {
    out.push(p);
    p = parents.get(cellKey(...p)) ?? null;
  }
  return out.reverse();
}
