import {
  mapX,
  mapY,
  mapPoint,
  mapCellKey,
  mapEdgeKey,
} from '../map-coordinates';
import { MAP_CELLS, MAP_EDGES } from '../map-limits';
import { surfaceListSchema } from '../surfaces';
import { sceneryListSchema } from '../scenery';
import { z } from 'zod';
import { generationMetadataSchema } from '../generator-schema';
import { id, int, text } from './fields';

export { mapCellKey as cell } from '../map-coordinates';
const cell = mapCellKey;
const edge = mapEdgeKey;
const accessPoint = mapPoint;
export const dungeon = z
  .object({
    scenery: sceneryListSchema.optional(),
    surfaces: surfaceListSchema.optional(),
    doorSettings: z
      .record(
        edge,
        z.object({
          locked: z.boolean(),
          secret: z.boolean(),
          discovered: z.boolean(),
        }),
      )
      .optional(),
    generation: generationMetadataSchema.optional(),
    access: z
      .object({
        entrance: accessPoint.optional(),
        exit: accessPoint.optional(),
      })
      .refine(
        (a) => !a.entrance || !a.exit || a.entrance.join() !== a.exit.join(),
      )
      .optional(),
    edges: z.record(edge, z.enum(['wall', 'door'])),
    floors: z.array(cell).max(MAP_CELLS),
    revealed: z.array(cell).max(MAP_CELLS),
    autoEdges: z.array(edge).max(MAP_EDGES).optional(),
    openDoors: z.array(edge).max(MAP_EDGES).optional(),
    stairMarks: z.record(cell, z.enum(['up', 'down', 'both'])).optional(),
  })
  .refine(
    (d) =>
      Object.values(d.access || {}).every(
        (p) => !p || d.floors.includes(p.join()),
      ) &&
      Object.entries(d.doorSettings || {}).every(
        ([key, value]) =>
          d.edges[key] === 'door' &&
          ((!value.locked && (!value.secret || value.discovered)) ||
            !d.openDoors?.includes(key)),
      ),
  );
export const location = z.object({ levelId: id, x: mapX, y: mapY });
export const atlas = z.object({
  lighting: z
    .object({ enabled: z.boolean(), darkRadius: int(0, 12) })
    .optional(),
  battle: z
    .object({
      id,
      levelId: id,
      origin: accessPoint,
      revision: int(0, Number.MAX_SAFE_INTEGER),
    })
    .optional(),
  levels: z
    .array(
      z.object({
        id,
        name: text(50),
        map: dungeon,
        history: z.array(dungeon).max(12),
        memory: dungeon,
        visible: z.array(cell).max(MAP_CELLS),
      }),
    )
    .min(1)
    .max(8),
  leaderId: text(100),
  order: z.array(id).max(12),
  radius: int(1, 12),
  location: location.optional(),
  stairs: z.array(z.object({ id, a: location, b: location })).max(4480),
  operations: z.array(id).max(256),
});
