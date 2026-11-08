import { MAP_WIDTH, MAP_HEIGHT } from '../map-limits';
import { z } from 'zod';
import { RECAP_SUMMARY_LIMIT, RECAP_CLUES_LIMIT } from '../session-recap';
import { coins } from './actors-schema';
import { id, int, text } from './fields';
import { location } from './map-schema';

export const sessionRecap = z.object({
  summary: z.string().trim().min(1).max(RECAP_SUMMARY_LIMIT),
  clues: text(RECAP_CLUES_LIMIT),
  revision: int(1, Number.MAX_SAFE_INTEGER),
  savedAt: z.number().int().nonnegative().max(8640000000000000),
  location: location.optional(),
  requestId: z.string().regex(/^[a-zA-Z0-9-]{16,80}$/),
});
const light = z
  .object({
    radius: int(1, 12).optional(),
    carrierId: id.optional(),
    id,
    name: z.string().trim().min(1).max(40),
    remaining: int(0, 10080).nullable(),
    lit: z.boolean(),
    revision: int(0, Number.MAX_SAFE_INTEGER),
  })
  .refine((l) => l.remaining !== 0 || !l.lit);
export const journey = z.object({
  minutes: int(0, 9999999),
  revision: int(0, Number.MAX_SAFE_INTEGER),
  lights: z
    .array(light)
    .max(24)
    .refine((items) => new Set(items.map((l) => l.id)).size === items.length),
});
const publicMapNote = z.object({
  roomNumber: int(1, 999).optional(),
  title: z.string().trim().min(1).max(60),
  text: z.string().trim().min(1).max(2000),
});
const mapNote = z.object({
  parchmentOnEntry: z.boolean().optional(),
  parchmentRevealed: z.literal(true).optional(),
  roomNumber: int(1, 999).optional(),
  notify: z.boolean().optional(),
  radius: int(1, 6).optional(),
  id,
  levelId: id,
  x: int(0, MAP_WIDTH - 1),
  y: int(0, MAP_HEIGHT - 1),
  title: z.string().trim().min(1).max(60),
  text: text(2000),
  secret: text(3000),
  revision: int(0, Number.MAX_SAFE_INTEGER),
  published: publicMapNote.optional(),
});
export const mapNotes = z
  .array(mapNote)
  .max(200)
  .refine(
    (items) =>
      new Set(items.map((n) => n.id)).size === items.length &&
      new Set(items.map((n) => `${n.levelId}:${n.x},${n.y}`)).size ===
        items.length &&
      new Set(
        items
          .filter((n) => n.roomNumber)
          .map((n) => `${n.levelId}:${n.roomNumber}`),
      ).size === items.filter((n) => n.roomNumber).length,
  );
const challenge = z
  .object({
    id,
    memberId: id,
    title: z.string().trim().min(1).max(80),
    ability: z.enum([
      'strength',
      'dexterity',
      'constitution',
      'intelligence',
      'charisma',
    ]),
    difficulty: int(-100, 200),
    modifier: int(-100, 100),
    showDifficulty: z.boolean(),
    audience: z.enum(['all', 'private']),
    noteId: id.optional(),
    state: z.enum(['pending', 'rolled', 'resolved', 'cancelled']),
    result: z
      .object({ die: int(1, 10), base: int(-5, 5), total: int(-104, 115) })
      .optional(),
    resolution: z.string().trim().min(1).max(1000).optional(),
    revision: int(0, Number.MAX_SAFE_INTEGER),
    createdAt: z.number().finite(),
  })
  .refine(
    (c) =>
      (c.state === 'pending'
        ? !c.result
        : c.state === 'rolled' || c.state === 'resolved'
          ? !!c.result
          : true) &&
      (!c.result ||
        c.result.total === c.result.die + c.result.base + c.modifier) &&
      (c.state === 'resolved' ? !!c.resolution : !c.resolution),
  );
export const challenges = z
  .array(challenge)
  .max(150)
  .refine(
    (items) =>
      new Set(items.map((c) => c.id)).size === items.length &&
      items.filter((c) => c.state === 'pending' || c.state === 'rolled')
        .length <= 50 &&
      items.filter((c) => c.state === 'resolved' || c.state === 'cancelled')
        .length <= 100,
  );
const lootItem = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  quantity: int(0, 9999),
});
const lootClaim = z
  .object({
    id,
    memberId: id,
    memberName: z.string().trim().min(1).max(30),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(60),
          quantity: int(1, 9999),
        }),
      )
      .max(1),
    coins: coins.refine((c) => Object.values(c).every((v) => v <= 1000000)),
    at: z.number().finite(),
  })
  .refine(
    (c) => c.items.length > 0 || Object.values(c.coins).some((v) => v > 0),
  );
const lootEntry = z
  .object({
    id,
    title: z.string().trim().min(1).max(80),
    secret: text(2000),
    noteId: id.optional(),
    items: z
      .array(lootItem)
      .max(24)
      .refine(
        (items) =>
          new Set(items.map((i) => i.id)).size === items.length &&
          new Set(items.map((i) => i.name.toLocaleLowerCase('cs'))).size ===
            items.length,
      ),
    coins: coins.refine((c) => Object.values(c).every((v) => v <= 1000000)),
    state: z.enum(['draft', 'open', 'closed']),
    claims: z
      .array(lootClaim)
      .max(200)
      .refine((items) => new Set(items.map((c) => c.id)).size === items.length),
    revision: int(0, Number.MAX_SAFE_INTEGER),
    createdAt: z.number().finite(),
  })
  .refine(
    (l) =>
      l.state !== 'draft' ||
      (!l.claims.length &&
        l.items.every((i) => i.quantity > 0) &&
        (l.items.length > 0 || Object.values(l.coins).some((v) => v > 0))),
  );
export const loot = z
  .array(lootEntry)
  .max(150)
  .refine(
    (items) =>
      new Set(items.map((l) => l.id)).size === items.length &&
      items.filter((l) => l.state !== 'closed').length <= 50 &&
      items.filter((l) => l.state === 'closed').length <= 100,
  );
