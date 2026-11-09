import type { Point } from '../dungeon';

// Iteration order breaks ties in routing and footprint traversal.
export const DIRS: Point[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const PRESETS = {
  small: { min: 2, max: 4 },
  medium: { min: 3, max: 6 },
  large: { min: 5, max: 9 },
};
export type Slot = {
  x: number;
  y: number;
  width: number;
  height: number;
  col: number;
  row: number;
};
export type Random = () => number;
export function seededRandom(seed: string): Random {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++)
    state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export const edge = (a: Point, b: Point) =>
  a[0] === b[0]
    ? `h:${a[0]}:${Math.max(a[1], b[1])}`
    : `v:${Math.max(a[0], b[0])}:${a[1]}`;
export const point = (key: string) => key.split(',').map(Number) as Point;
export const orderCells = (cells: Iterable<string>) =>
  [...cells].sort((a, b) => {
    const p = point(a),
      q = point(b);
    return p[1] - q[1] || p[0] - q[0];
  });
export function shuffle<T>(items: T[], random: Random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
