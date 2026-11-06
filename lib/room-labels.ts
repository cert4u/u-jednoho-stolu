import type { Dungeon, Point } from './dungeon';
import type { GeneratedRoom } from './generator-types';

/** Actual room floor, ordered from the center with a stable tie-break. */
export function roomFloorPoints(room: GeneratedRoom, map: Dungeon): Point[] {
  const occupied = new Set(Object.keys(map.stairMarks ?? {}));
  for (const point of Object.values(map.access ?? {})) {
    if (point) occupied.add(point.join(','));
  }
  const cells = room.cells ?? Array.from(
    { length: room.width * room.height },
    (_, i) => `${room.x + i % room.width},${room.y + Math.floor(i / room.width)}`,
  );
  const floor = new Set(map.floors);
  const distance = ([x, y]: Point) => Math.hypot(x - room.center[0], y - room.center[1]);
  return cells
    .filter(key => floor.has(key) && !occupied.has(key))
    .map(key => key.split(',').map(Number) as Point)
    .sort((a, b) => distance(a) - distance(b) || a[1] - b[1] || a[0] - b[0]);
}

/** Keep room numbers on room floor, away from stairs and access symbols. */
export function roomLabelPoint(room: GeneratedRoom, map: Dungeon): Point {
  return roomFloorPoints(room, map)[0] ?? room.center;
}
