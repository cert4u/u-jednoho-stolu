import { z } from 'zod';
import catalog from '../content/dungeon-presets/index';
import { parseCatalog, contentId } from './content-schema';
import { generatorOptionsSchema } from './generator-options';

export const presetSchema = z
  .object({
    id: contentId,
    label: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(2000),
    options: generatorOptionsSchema.refine(
      (options) => options.version === 'v2',
    ),
  })
  .strict();

const presets = parseCatalog(catalog, presetSchema);
const castle = presets.find(preset => preset.id === 'castle');
if (!castle) throw new Error('Chybí výchozí předloha jeskyně castle.');
export const defaultDungeonPreset = castle;
export const dungeonPresets = [castle, ...presets.filter(preset => preset !== castle)];

export function findDungeonPreset(id: unknown) {
  return dungeonPresets.find((preset) => preset.id === id);
}
