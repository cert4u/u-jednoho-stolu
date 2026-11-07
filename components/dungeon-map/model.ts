import type {SurfaceBrush} from '../../lib/surfaces';
import { MAP_WIDTH as W, MAP_HEIGHT as H, type Point } from '../../lib/dungeon';
export { W, H };
export const SIZE = 36,
  PAD = 25,
  PAPER_MARGIN = 4000,
  WIDTH = W * SIZE + PAD * 2,
  HEIGHT = H * SIZE + PAD * 2;
export type Marker = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  role: string;
  hp: number;
  maxHp: number;
};
export type Tool =
  | 'entrance'
  | 'exit'
  | 'move'
  | 'wall'
  | 'room'
  | 'floor'
  | 'door'
  | 'erase'
  | 'subtract'
  | 'reveal'
  | 'hide'
  | 'hand'
  | 'place'
  | 'openDoor'
  | 'stairsUp'
  | 'stairsDown'
  | 'stairsBoth'
  | 'monster'
  | 'note'
  | 'inspect'
  | 'scenery';
export type Stroke = {
  surface?:SurfaceBrush;
  pointer: number;
  start: Point;
  end: Point;
  points: Point[];
  edges: string[];
  cells: Point[];
  edge: string;
  token?: string;
  monster?: string;
  note?: string;
  pan?: { x: number; y: number; left: number; top: number };
};
export function edgeVertices(key: string): [Point, Point] {
  const [axis, xs, ys] = key.split(':');
  const x = Number(xs),
    y = Number(ys);
  return axis === 'h'
    ? [
        [x, y],
        [x + 1, y],
      ]
    : [
        [x, y],
        [x, y + 1],
      ];
}
