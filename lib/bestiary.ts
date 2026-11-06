import { z } from 'zod';
import catalog from '../content/bestiary/index';
import { parseCatalog, contentId } from './content-schema';

import { bestiaryEnvironments, type BestiaryEnvironment } from './bestiary-environments';

const environmentIds = Object.keys(bestiaryEnvironments) as [BestiaryEnvironment, ...BestiaryEnvironment[]];
export const bestiaryEntrySchema = z
  .object({
    id: contentId,
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(2000),
    gmHint: z.string().trim().min(1).max(4000),
    environments: z
      .array(z.enum(environmentIds))
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length),
    portrait: contentId.optional(),
    maxHp: z.number().int().min(1).max(9999),
    combat: z
      .object({
        attack: z.number().int().min(-50).max(100),
        defense: z.number().int().min(0).max(100),
        damage: z.number().int().min(-50).max(100),
      })
      .strict(),
  })
  .strict();

export const bestiaryEntries =
  parseCatalog(catalog, bestiaryEntrySchema);
export type BestiaryEntry = (typeof bestiaryEntries)[number];
const entriesById = new Map(bestiaryEntries.map((entry) => [entry.id, entry]));

export function findBestiaryEntry(id: unknown) {
  return typeof id === 'string' ? entriesById.get(id) : undefined;
}

export function bestiaryPortrait(entry: BestiaryEntry) {
  return entry.portrait ?? entry.id;
}
