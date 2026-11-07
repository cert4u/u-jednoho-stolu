import { sceneryListSchema } from '../scenery';
import { z } from 'zod';
import { generationMetadataSchema } from '../generator-schema';
import { id, int, text } from './fields';

export const cell = z
  .string()
  .regex(/^\d{1,2},\d{1,2}$/)
  .refine((k) => {
    const [x, y] = k.split(',').map(Number);
    return x < 28 && y < 20;
  });
const edge = z
  .string()
  .regex(/^[hv]:\d{1,2}:\d{1,2}$/)
  .refine((k) => {
    const [axis, x, y] = k.split(':');
    return +x < (axis === 'h' ? 28 : 29) && +y < (axis === 'h' ? 21 : 20);
  });
const accessPoint = z.tuple([int(0, 27), int(0, 19)]);
export const dungeon = z
  .object({
    scenery: sceneryListSchema.optional(),
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
    floors: z.array(cell).max(560),
    revealed: z.array(cell).max(560),
    autoEdges: z.array(edge).max(1168).optional(),
    openDoors: z.array(edge).max(1168).optional(),
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
export const location = z.object({ levelId: id, x: int(0, 27), y: int(0, 19) });
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
        visible: z.array(cell).max(560),
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
