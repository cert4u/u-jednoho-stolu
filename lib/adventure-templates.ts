import { z } from 'zod';
import catalog from '../content/adventures/index';
import { parseCatalog, contentId } from './content-schema';
import { findDungeonPreset } from './dungeon-presets';
import type { GeneratedRoom } from './generator-types';
import { findBestiaryEntry } from './bestiary';

const roomSchema = z
  .object({
    floor: z.number().int().min(1).max(8),
    role: z.enum(['entrance', 'goal']).optional(),
    roomId: contentId.optional(),
    phase: z.enum(['entrance-obstacle', 'challenge', 'complication', 'climax', 'resolution']).optional(),
    title: z.string().trim().min(1).max(60),
    playerText: z.string().trim().max(2000),
    gmNotes: z.string().trim().max(3000),
    monsters: z.array(contentId).max(8).optional(),
  })
  .strict()
  .refine(room => Boolean(room.roomId) !== Boolean(room.role),
    'Vyber právě jedno pole: roomId nebo role.');

export const adventureSchema = z
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
      const location = `${room.floor}:${room.roomId ?? room.role}`;
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
      for (const [monsterIndex, id] of (room.monsters ?? []).entries()) {
        if (!findBestiaryEntry(id)) ctx.addIssue({
          code: 'custom',
          path: ['rooms', index, 'monsters', monsterIndex],
          message: `Neznámá příšera „${id}“.`,
        });
      }
    }
  });

export const adventureTemplates =
  parseCatalog(catalog, adventureSchema);
export type AdventureSummary = Pick<
  (typeof adventureTemplates)[number],
  'id' | 'title' | 'summary'
>;

export const adventureSummaries: AdventureSummary[] = adventureTemplates.map(
  ({ id, title, summary }) => ({ id, title, summary }),
);

export function resolveAdventureRooms(
  adventure: (typeof adventureTemplates)[number],
  floors: readonly { rooms: readonly GeneratedRoom[] }[],
) {
  const resolved = new Set<string>();
  return adventure.rooms.map((placement, index) => {
    const { floor, roomId, role } = placement;
    const rooms = floors[floor - 1]?.rooms ?? [];
    const matches = rooms.filter(room => roomId ? room.id === roomId : room.role === role);
    if (matches.length !== 1)
      throw new Error(`content/adventures/${adventure.id}.json: rooms.${index}: patro ${floor} neobsahuje právě jednu místnost „${roomId ?? role}“.`);
    const room = matches[0];
    const roomNumber = rooms.indexOf(room) + 1;
    const key = `${floor}:${room.id ?? roomNumber}`;
    if (resolved.has(key))
      throw new Error(`content/adventures/${adventure.id}.json: rooms.${index}: místnost už má přípravu.`);
    resolved.add(key);
    return { placement, room, roomNumber };
  });
}
