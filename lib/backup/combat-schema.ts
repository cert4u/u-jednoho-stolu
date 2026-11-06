import { z } from 'zod';
import { id, int, text } from './fields';

const ref = z.object({ type: z.enum(['member', 'monster']), id });
const mechanics = z.object({
  kind: z.enum(['ability', 'attack', 'defense']),
  actor: ref,
  target: ref.optional(),
  dice: z.array(int(1, 10)).min(1).max(100),
  base: int(-50, 100),
  modifier: int(-100, 100),
  total: int(-150, 800),
  damageBonus: int(-50, 100).optional(),
  attackId: id.optional(),
  defenseId: id.optional(),
  proposedDamage: int(0, 1000).optional(),
  applied: z.boolean().optional(),
  cancelled: z.boolean().optional(),
});
export const message = z.object({
  id,
  from: id,
  name: text(60),
  text: text(4000),
  to: id,
  time: z.number().finite(),
  roll: z.boolean().optional(),
  experience: z.boolean().optional(),
  parchment: z
    .object({
      title: z.string().trim().min(1).max(60),
      roomNumber: int(1, 999).optional(),
    })
    .optional(),
  mechanics: mechanics.optional(),
  audience: z.array(id).max(12).optional(),
});
export const initiative = z
  .object({
    autoTick: z.boolean().optional(),
    revision: int(0, Number.MAX_SAFE_INTEGER),
    active: z.boolean(),
    round: int(0, 1000000),
    current: text(210).nullable(),
    order: z.array(ref).max(64),
  })
  .refine(
    (s) =>
      new Set(s.order.map((r) => r.type + ':' + r.id)).size ===
        s.order.length &&
      (s.active
        ? s.round >= 1 && s.order.some((r) => r.type + ':' + r.id === s.current)
        : s.current === null),
  );
