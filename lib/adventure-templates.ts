import { z } from 'zod';
import catalog from '../content/adventures.json' with { type: 'json' };
import { contentCatalog, contentId } from './content-schema';
import { findDungeonPreset } from './dungeon-presets';
import { findBestiaryEntry } from './bestiary';

const roomSchema = z
  .object({
    floor: z.number().int().min(1).max(8),
    role: z.enum(['entrance', 'goal']),
    title: z.string().trim().min(1).max(60),
    playerText: z.string().trim().max(2000),
    gmNotes: z.string().trim().max(3000),
    monsters: z.array(contentId).max(8).optional(),
  })
  .strict();

const adventureSchema = z
  .object({
    id: contentId,
    title: z.string().trim().min(1).max(100),
    scene: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(500),
    gmNotes: z.string().trim().max(20000),
    dungeonPreset: contentId,
    rooms: z.array(roomSchema).min(1).max(16),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const preset = findDungeonPreset(entry.dungeonPreset);
    if (!preset)
      ctx.addIssue({
        code: 'custom',
        path: ['dungeonPreset'],
        message: 'Neznámá předloha jeskyně.',
      });
    const locations = new Set<string>();
    for (const [index, room] of entry.rooms.entries()) {
      const location = `${room.floor}:${room.role}`;
      if (
        locations.has(location) ||
        (preset && room.floor > preset.options.levels)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['rooms', index],
          message: 'Duplicitní místnost nebo patro mimo předlohu.',
        });
      locations.add(location);
      if (room.monsters?.some((id) => !findBestiaryEntry(id)))
        ctx.addIssue({
          code: 'custom',
          path: ['rooms', index, 'monsters'],
          message: 'Neznámá příšera.',
        });
    }
  });

export const adventureTemplates =
  contentCatalog(adventureSchema).parse(catalog).entries;
export type AdventureSummary = Pick<
  (typeof adventureTemplates)[number],
  'id' | 'title' | 'summary'
>;

export const adventureSummaries: AdventureSummary[] = adventureTemplates.map(
  ({ id, title, summary }) => ({ id, title, summary }),
);
