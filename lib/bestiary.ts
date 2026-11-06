import { z } from 'zod';
import catalog from '../content/bestiary.json' with { type: 'json' };
import { contentCatalog, contentId } from './content-schema';

export const bestiaryEnvironments = {
  caves: 'Jeskyně a doly',
  castles: 'Hrady a ruiny',
  crypts: 'Hrobky a krypty',
  woods: 'Lesy a cesty',
  waters: 'Voda, bažiny a stoky',
  wilds: 'Skály a pustiny',
} as const;

export type BestiaryEnvironment = keyof typeof bestiaryEnvironments;
const environmentIds = [
  'caves',
  'castles',
  'crypts',
  'woods',
  'waters',
  'wilds',
] as const satisfies readonly BestiaryEnvironment[];
const entrySchema = z
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
  contentCatalog(entrySchema).parse(catalog).entries;
const entriesById = new Map(bestiaryEntries.map((entry) => [entry.id, entry]));

export function findBestiaryEntry(id: unknown) {
  return typeof id === 'string' ? entriesById.get(id) : undefined;
}
