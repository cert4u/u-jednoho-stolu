import type { Dungeon } from '../../lib/dungeon';
import { edgeVertices, PAD, SIZE, WIDTH, HEIGHT } from './model';

export const KEEPSAKE_WIDTH = 330;
export const KEEPSAKE_HEIGHT = 160;
type Box = { left: number; top: number; width: number; height: number };

/** Only pass the map already selected for this viewer, never the private atlas. */
export function keepsakeFootprint(shown: Pick<Dungeon, 'floors' | 'edges'>) {
  const floor = shown.floors
    .map((key) => {
      const [x, y] = key.split(',').map(Number);
      return `M${PAD + x * SIZE} ${PAD + y * SIZE}h${SIZE}v${SIZE}h${-SIZE}Z`;
    })
    .join('');
  const edges = Object.keys(shown.edges)
    .map((key) => {
      const [from, to] = edgeVertices(key);
      return `M${PAD + from[0] * SIZE} ${PAD + from[1] * SIZE}L${PAD + to[0] * SIZE} ${PAD + to[1] * SIZE}`;
    })
    .join('');
  return { floor, edges };
}

/** Convert moving paper coordinates into the fixed corner illustration's viewBox. */
export function keepsakeProjection(paper: Box, illustration: Box) {
  if (
    paper.width <= 0 ||
    paper.height <= 0 ||
    illustration.width <= 0 ||
    illustration.height <= 0
  )
    return;
  const unitX = KEEPSAKE_WIDTH / illustration.width;
  const unitY = KEEPSAKE_HEIGHT / illustration.height;
  return [
    (paper.width / WIDTH) * unitX,
    0,
    0,
    (paper.height / HEIGHT) * unitY,
    (paper.left - illustration.left) * unitX,
    (paper.top - illustration.top) * unitY,
  ];
}
