import { MAP_WIDTH, MAP_HEIGHT, MAP_CELLS, MAP_EDGES } from '../map-limits';
import {surfaceListSchema} from '../surfaces';
import { sceneryListSchema } from '../scenery';
import { z } from 'zod';
import { generationMetadataSchema } from '../generator-schema';
import { id, int, text } from './fields';

export const cell = z
  .string()
  .regex(/^\d{1,2},\d{1,2}$/)
  .refine((k) => {
    const [x, y] = k.split(',').map(Number);
    return x < MAP_WIDTH && y < MAP_HEIGHT;
  });
const edge = z
  .string()
  .regex(/^[hv]:\d{1,2}:\d{1,2}$/)
  .refine((k) => {
    const [axis, x, y] = k.split(':');
    return +x < (axis === 'h' ? MAP_WIDTH : MAP_WIDTH + 1) && +y < (axis === 'h' ? MAP_HEIGHT + 1 : MAP_HEIGHT);
  });
const accessPoint = z.tuple([int(0, MAP_WIDTH - 1), int(0, MAP_HEIGHT - 1)]);
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
export const location = z.object({ levelId: id, x: int(0, MAP_WIDTH - 1), y: int(0, MAP_HEIGHT - 1) });
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
