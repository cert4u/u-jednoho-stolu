import type {
  GeneratorMetrics,
  LogicalRoom,
  RoomConnection,
} from '../generator-types';

export const QUALITY_WEIGHTS = {
  mainPath: 24,
  branches: 14,
  loops: 14,
  occupancy: 12,
  roomVariety: 20,
  corridors: 16,
} as const;

export function scoreFloor(
  rooms: LogicalRoom[],
  connections: RoomConnection[],
  main: number[],
): GeneratorMetrics {
  let turns = 0;
  for (const { path } of connections)
    for (let i = 2; i < path.length; i++)
      if (
        path[i][0] - path[i - 1][0] !== path[i - 1][0] - path[i - 2][0] ||
        path[i][1] - path[i - 1][1] !== path[i - 1][1] - path[i - 2][1]
      )
        turns++;
  const branches = rooms.filter(
      (r) =>
        r.neighbors.length === 1 && r.role !== 'entrance' && r.role !== 'goal',
    ).length,
    loops = connections.length - rooms.length + 1,
    occupancy =
      (rooms.reduce((sum, r) => sum + r.cells.length, 0) +
        connections.reduce((sum, c) => sum + c.path.length - 2, 0)) /
      560,
    roomVariety =
      new Set(rooms.map((r) => `${r.width}:${r.height}:${r.cells.length}`))
        .size / rooms.length;
  const corridorLength = connections.reduce((sum, c) => sum + c.path.length, 0),
    score =
      (QUALITY_WEIGHTS.mainPath * main.length) / rooms.length +
      QUALITY_WEIGHTS.branches *
        Math.min(1, branches / Math.max(1, rooms.length / 3)) +
      QUALITY_WEIGHTS.loops * Math.min(1, loops / 3) +
      QUALITY_WEIGHTS.occupancy * Math.min(1, occupancy / 0.6) +
      QUALITY_WEIGHTS.roomVariety * roomVariety +
      QUALITY_WEIGHTS.corridors *
        Math.max(0, 1 - turns / Math.max(1, corridorLength));
  return {
    score: Math.round(score * 100) / 100,
    mainPathLength: main.length,
    branches,
    loops,
    occupancy,
    roomVariety,
    turns,
  };
}
