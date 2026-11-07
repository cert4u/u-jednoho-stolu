import { cellKey, type Dungeon, type Point } from '../../../lib/dungeon';
import { validateGeneratedFloor } from '../../../lib/generator-validation';
import { PAD, SIZE, WIDTH, HEIGHT, edgeVertices } from '../model';
import { inkNoise } from './noise';
import { inkPalettes, type InkTheme } from './palettes';

type InkEdge = { key: string; opacity: number };
export type InkDrawing = {
  theme: InkTheme;
  walls: { d: string; opacity: number }[];
  accents: { d: string; opacity: number; width: number }[];
  hatching: { d: string; opacity: number }[];
  details: { d: string; opacity: number }[];
  outside: string;
  grain: string;
};

const number = (value: number) => Number(value.toFixed(2));
const position = ([x, y]: Point): Point => [PAD + x * SIZE, PAD + y * SIZE];
const pointText = ([x, y]: Point) => `${number(x)} ${number(y)}`;
const line = (a: Point, b: Point) => `M${pointText(a)}L${pointText(b)}`;

export function inkTheme(map: Dungeon): InkTheme {
  if (!map.generation || map.generation.status !== 'valid' ||
    !['castle', 'mine', 'cave'].includes(map.generation.style)) return 'universal';
  try {
    validateGeneratedFloor(map, map.generation);
    return map.generation.style;
  } catch {
    return 'universal';
  }
}

export function edgeOpacity(
  key: string,
  revealed: ReadonlySet<string>,
  lit: ReadonlySet<string>,
  visible: boolean,
  exploring: boolean,
) {
  const [a, b] = edgeVertices(key);
  const [x, y] = a;
  const cells = a[1] === b[1] ? [cellKey(x, y - 1), cellKey(x, y)] : [cellKey(x - 1, y), cellKey(x, y)];
  if (visible && exploring && !cells.some(cell => lit.has(cell))) return 0.3;
  return visible || cells.some(cell => revealed.has(cell)) ? 1 : 0.25;
}

/** Only uses the floor and edges already present in this recipient's map. */
export function solidNormal(key: string, floor: ReadonlySet<string>): Point | undefined {
  const [a, b] = edgeVertices(key);
  const [x, y] = a;
  const horizontal = a[1] === b[1];
  const before = floor.has(horizontal ? cellKey(x, y - 1) : cellKey(x - 1, y));
  const after = floor.has(cellKey(x, y));
  if (before === after) return undefined;
  return horizontal ? [0, before ? 1 : -1] : [before ? 1 : -1, 0];
}

function curve(key: string, theme: InkTheme, reverse = false) {
  const [a, b] = edgeVertices(key).map(position);
  const palette = inkPalettes[theme];
  const horizontal = a[1] === b[1];
  const controls: Point[] = [0.32, 0.69].map((t, i) => {
    const offset = (inkNoise(key, i) - 0.5) * 2 * palette.wobble;
    return [a[0] + (b[0] - a[0]) * t + (horizontal ? 0 : offset),
      a[1] + (b[1] - a[1]) * t + (horizontal ? offset : 0)];
  });
  if (reverse) controls.reverse();
  return `C${controls.map(pointText).join(' ')} ${pointText(reverse ? a : b)}`;
}

/** Join degree-two edges into contours. Junctions remain explicit, with shared endpoints. */
function wallContours(edges: InkEdge[], theme: InkTheme) {
  const byVertex = new Map<string, InkEdge[]>();
  for (const edge of edges) {
    for (const vertex of edgeVertices(edge.key)) {
      const key = vertex.join(',');
      byVertex.set(key, [...(byVertex.get(key) ?? []), edge]);
    }
  }
  const used = new Set<string>();
  const contours: string[] = [];
  function walk(first: InkEdge, start: Point) {
    let edge = first, vertex = start;
    let d = `M${pointText(position(vertex))}`;
    while (!used.has(edge.key)) {
      used.add(edge.key);
      const [a, b] = edgeVertices(edge.key);
      const reverse = vertex[0] === b[0] && vertex[1] === b[1];
      d += curve(edge.key, theme, reverse);
      vertex = reverse ? a : b;
      const neighbors = byVertex.get(vertex.join(',')) ?? [];
      if (neighbors.length !== 2) break;
      const next = neighbors.find(item => !used.has(item.key));
      if (!next) break;
      edge = next;
    }
    contours.push(d);
  }
  for (const edge of edges) {
    const start = edgeVertices(edge.key).find(vertex => byVertex.get(vertex.join(','))!.length !== 2);
    if (start && !used.has(edge.key)) walk(edge, start);
  }
  for (const edge of edges) {
    if (!used.has(edge.key)) walk(edge, edgeVertices(edge.key)[0]);
  }
  return contours.join('');
}

export function buildInkDrawing(
  map: Dungeon,
  revealed: ReadonlySet<string>,
  lit: ReadonlySet<string>,
  visible: boolean,
  exploring: boolean,
): InkDrawing {
  const theme = inkTheme(map);
  const palette = inkPalettes[theme];
  const floor = new Set(map.floors);
  const edges = Object.entries(map.edges).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const walls: InkEdge[] = [];
  const hatchGroups = new Map<number, string[]>();
  const detailGroups = new Map<number, string[]>();
  const pressureGroups = new Map<string, { d: string[]; opacity: number; width: number }>();
  for (const [key, kind] of edges) {
    if (kind !== 'wall') continue;
    const [a, b] = edgeVertices(key).map(position);
    const horizontal = a[1] === b[1];
    const normal = solidNormal(key, floor);
    const opacity = edgeOpacity(key, revealed, lit, visible, exploring);
    const width = 0.45 + Math.floor(inkNoise(key, 9) * 3) * 0.2;
    walls.push({ key, opacity });
    const group = `${opacity}:${width}`;
    const pressure = pressureGroups.get(group) ?? { d: [], opacity, width };
    pressure.d.push(`M${pointText(a)}${curve(key, theme)}`);
    pressureGroups.set(group, pressure);
    if (!normal) continue;
    const hatch = hatchGroups.get(opacity) ?? [];
    const detail = detailGroups.get(opacity) ?? [];
    const tangent: Point = horizontal ? [1, 0] : [0, 1];
    const count = Math.floor(SIZE / palette.spacing);
    for (let i = 0; i < count; i++) {
      // Center samples within each edge. No duplicate marks at shared vertices.
      const t = (i + 0.5) / count;
      const length = palette.hatch * (0.6 + inkNoise(key, i + 20) * 0.65);
      const lean = (theme === 'cave' ? 2 : 3.5) + inkNoise(key, i + 40) * 2;
      const start: Point = [a[0] + tangent[0] * SIZE * t + normal[0] * 2,
        a[1] + tangent[1] * SIZE * t + normal[1] * 2];
      const end: Point = [start[0] + normal[0] * length + tangent[0] * lean,
        start[1] + normal[1] * length + tangent[1] * lean];
      hatch.push(line(start, end));
      if (theme === 'castle' && i % 2 === 0) {
        const corner: Point = [start[0] + normal[0] * 6, start[1] + normal[1] * 6];
        detail.push(line(start, corner) + line(corner, [corner[0] + tangent[0] * 5, corner[1] + tangent[1] * 5]));
      }
      if (theme === 'cave' && i % 3 === 0)
        detail.push(line(end, [end[0] + normal[0] * 2 - tangent[0] * 3, end[1] + normal[1] * 2 - tangent[1] * 3]));
    }
    // Paired short strokes suggest cut rock/supports outside selected mine edges.
    if (theme === 'mine' && inkNoise(key, 70) > 0.82) {
      const mid: Point = [(a[0] + b[0]) / 2 + normal[0] * 3, (a[1] + b[1]) / 2 + normal[1] * 3];
      for (const offset of [-3, 3]) detail.push(line(
        [mid[0] + tangent[0] * offset, mid[1] + tangent[1] * offset],
        [mid[0] + tangent[0] * offset + normal[0] * 10, mid[1] + tangent[1] * offset + normal[1] * 10],
      ));
    }
    hatchGroups.set(opacity, hatch);
    detailGroups.set(opacity, detail);
  }
  const outside = `M0 0H${WIDTH}V${HEIGHT}H0Z` + [...floor].sort().map(key => {
    const [x, y] = key.split(',').map(Number);
    return `M${PAD + x * SIZE} ${PAD + y * SIZE}h${SIZE}v${SIZE}h-${SIZE}Z`;
  }).join('');
  const grain = Array.from({ length: 190 }, (_, i) => {
    const x = inkNoise('paper', i * 2) * WIDTH;
    const y = inkNoise('paper', i * 2 + 1) * HEIGHT;
    return `M${number(x)} ${number(y)}h0.15`;
  }).join('');
  return {
    theme,
    walls: [0.25, 0.3, 1].flatMap(opacity => {
      const matching = walls.filter(edge => edge.opacity === opacity);
      return matching.length ? [{ d: wallContours(matching, theme), opacity }] : [];
    }),
    accents: [...pressureGroups.values()].map(group => ({ ...group, d: group.d.join('') })),
    hatching: [...hatchGroups].map(([opacity, paths]) => ({ opacity, d: paths.join('') })),
    details: [...detailGroups].map(([opacity, paths]) => ({ opacity, d: paths.join('') })),
    outside,
    grain,
  };
}

export function doorAppearance(map: Dungeon, key: string) {
  if (map.edges[key] !== 'door') return undefined;
  const locked = map.doorSettings?.[key]?.locked;
  const open = !locked && map.openDoors?.includes(key);
  if (map.doorSettings?.[key]?.secret) return open ? 'secret-open' : 'secret';
  return locked ? 'locked' : open ? 'open' : 'closed';
}
