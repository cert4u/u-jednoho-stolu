import { z } from 'zod';
import { id, int, text } from './fields';

const combat = z.object({
  attack: int(-50, 100),
  defense: int(0, 100),
  damage: int(-50, 100),
});
const condition = z.object({
  id,
  label: z.string().trim().min(1).max(40),
  note: text(300),
  rounds: int(0, 999).nullable(),
  secret: z.boolean(),
  revision: int(0, Number.MAX_SAFE_INTEGER),
});
const conditions = z
  .array(condition)
  .max(12)
  .refine((items) => new Set(items.map((c) => c.id)).size === items.length);
const mana = z
  .object({
    current: int(0, 9999),
    max: int(0, 9999),
    revision: int(0, Number.MAX_SAFE_INTEGER),
  })
  .refine((m) => m.current <= m.max);
const power = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  kind: z.enum(['spell', 'ability']),
  cost: int(0, 9999),
  description: text(1000),
  revision: int(0, Number.MAX_SAFE_INTEGER),
});
const powers = z
  .array(power)
  .max(30)
  .refine((items) => new Set(items.map((p) => p.id)).size === items.length);
export const coins = z.object({
  gold: int(0, 999999999),
  silver: int(0, 999999999),
  copper: int(0, 999999999),
});
const possession = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  quantity: int(1, 999999),
});
const possessions = z
  .array(possession)
  .max(200)
  .refine(
    (items) =>
      new Set(items.map((i) => i.id)).size === items.length &&
      new Set(items.map((i) => i.name)).size === items.length,
  );
export const member = z
  .object({
    life: z
      .object({
        status: z.enum(['active', 'out', 'unconscious', 'dead']),
        note: text(300),
        revision: int(0, Number.MAX_SAFE_INTEGER),
      })
      .optional(),
    equipmentRevision: int(0, Number.MAX_SAFE_INTEGER).optional(),
    purse: coins.optional(),
    possessions: possessions.optional(),
    mana: mana.optional(),
    powers: powers.optional(),
    conditions: conditions.optional(),
    id,
    name: text(30),
    role: z.enum(['pj', 'player']),
    hp: int(0, 999),
    maxHp: int(1, 999),
    stats: text(2000),
    inventory: text(4000),
    x: int(0, 27),
    y: int(0, 19),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    seen: z.number().finite(),
    experience: z.number().int().nonnegative().safe().optional(),
    race: text(50).optional(),
    profession: text(50).optional(),
    level: int(1, 36).optional(),
    abilities: z
      .object({
        strength: int(1, 21).optional(),
        dexterity: int(1, 21).optional(),
        constitution: int(1, 21).optional(),
        intelligence: int(1, 21).optional(),
        charisma: int(1, 21).optional(),
      })
      .optional(),
    combat: combat.optional(),
    archived: z.boolean().optional(),
  })
  .refine((m) => m.hp <= m.maxHp);
export const monster = z
  .object({
    templateId: z
      .string()
      .regex(/^[a-z][a-z0-9-]{0,49}$/)
      .optional(),
    conditions: conditions.optional(),
    id,
    number: int(1, 1000000),
    name: text(60),
    levelId: id,
    x: int(0, 27).nullable(),
    y: int(0, 19).nullable(),
    hp: int(0, 9999),
    maxHp: int(1, 9999),
    stats: text(2000),
    notes: text(4000),
    hidden: z.boolean(),
    archived: z.boolean(),
    combat: combat.optional(),
  })
  .refine((m) => m.hp <= m.maxHp && (m.x === null) === (m.y === null));
