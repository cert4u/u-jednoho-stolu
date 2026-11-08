import type { Point } from '../../lib/dungeon';
import { W, H, WIDTH, HEIGHT, SIZE, PAD } from './model';
export function mapPointerGeometry(
  e: { clientX: number; clientY: number },
  box: { left: number; top: number; width: number; height: number },
) {
  const x = Math.max(
      0,
      Math.min(
        W,
        ((e.clientX - box.left) * WIDTH) / box.width / SIZE - PAD / SIZE,
      ),
    ),
    y = Math.max(
      0,
      Math.min(
        H,
        ((e.clientY - box.top) * HEIGHT) / box.height / SIZE - PAD / SIZE,
      ),
    );
  const cell: Point = [
      Math.min(W - 1, Math.floor(x)),
      Math.min(H - 1, Math.floor(y)),
    ],
    vertex: Point = [Math.round(x), Math.round(y)];
  const horizontal = Math.abs(y - Math.round(y)) <= Math.abs(x - Math.round(x));
  const edge = horizontal
    ? `h:${Math.min(W - 1, Math.floor(x))}:${Math.round(y)}`
    : `v:${Math.round(x)}:${Math.min(H - 1, Math.floor(y))}`;
  return {
    cell,
    vertex,
    edge,
    nearEdge:
      Math.min(Math.abs(y - Math.round(y)), Math.abs(x - Math.round(x))) < 0.24,
  };
}
