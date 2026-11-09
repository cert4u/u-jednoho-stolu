import {
  cellKey,
  emptyDungeon,
  perimeter,
  type Dungeon,
  type Point,
} from '../dungeon';
import type {
  GeneratedFloor,
  GenerationMetadata,
  GeneratorOptions,
  LogicalRoom,
} from '../generator-types';
import { validateGeneratedFloor } from '../generator-validation';
import { connectRooms } from './corridors';
import { drawRoom, planGraph, planSlots } from './layout';
import {
  DIRS,
  edge,
  orderCells,
  point,
  PRESETS,
  seededRandom,
} from './primitives';
import { scoreFloor } from './quality';

function markRoomPassages(
  rooms: LogicalRoom[],
  graph: ReturnType<typeof planGraph>,
  options: GeneratorOptions,
) {
  const allowed = new Set<string>();
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    room.neighbors = graph.neighbors[i].map((n) => rooms[n].id);
    room.mainPath = graph.main.includes(i);
    room.role =
      i === 0
        ? 'entrance'
        : i === graph.goal
          ? 'goal'
          : room.neighbors.length >= 3
            ? 'junction'
            : room.neighbors.length === 1
              ? 'dead-end'
              : room.cells.length >= PRESETS[options.size].max ** 2 * 0.65
                ? 'chamber'
                : 'room';
    const cells = new Set(room.cells);
    for (const key of cells) {
      const p = point(key);
      for (const d of DIRS) {
        const q: Point = [p[0] + d[0], p[1] + d[1]];
        if (cells.has(cellKey(...q))) allowed.add(edge(p, q));
      }
    }
  }
  return allowed;
}

export function buildCandidateFloor(
  options: GeneratorOptions,
  level: number,
  candidate: number,
): GeneratedFloor {
  // Keep this order: the same PRNG stream feeds slots, graph, rooms and corridors.
  const random = seededRandom(
    `v2:${options.seed}:${options.style}:${options.variant}:${level}:${candidate}`,
  );
  const slots = planSlots(options, random);
  const graph = planGraph(slots, options, random);
  const rooms = slots.map((slot, i) =>
    drawRoom(slot, i, level, options, random),
  );
  const allowed = markRoomPassages(rooms, graph, options);
  const { corridors, connections } = connectRooms(
    rooms,
    slots,
    graph,
    allowed,
    options,
    level,
    random,
  );

  const floors = orderCells([...rooms.flatMap((r) => r.cells), ...corridors]),
    map: Dungeon = {
      ...emptyDungeon(),
      floors,
      edges: {},
      autoEdges: [...perimeter(floors)],
      stairMarks: {},
    };
  // Wall every unplanned contact, including adjacent corridor segments. Geometry cannot add a graph edge.
  for (const key of floors) {
    const p = point(key);
    for (const d of DIRS) {
      const q: Point = [p[0] + d[0], p[1] + d[1]],
        key = edge(p, q);
      if (!allowed.has(key)) map.edges[key] = 'wall';
    }
  }
  for (const connection of connections)
    for (const key of connection.doors) map.edges[key] = 'door';
  const metadata: GenerationMetadata = {
    version: 'v2',
    options: structuredClone(options),
    seed: options.seed,
    style: options.style,
    variant: options.variant,
    candidate,
    levelIndex: level,
    status: 'valid',
    rooms,
    connections,
    metrics: scoreFloor(rooms, connections, graph.main),
    goalRoomId: rooms[graph.goal].id,
  };
  map.generation = metadata;
  validateGeneratedFloor(map, metadata, false);
  return {
    name:
      level === 0
        ? `${options.name} · přízemí`
        : `${options.name} · -${level}. patro`,
    map,
    rooms,
  };
}
