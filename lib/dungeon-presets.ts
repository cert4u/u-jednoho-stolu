import { z } from 'zod';
import catalog from '../content/dungeon-presets.json' with { type: 'json' };
import { contentCatalog, contentId } from './content-schema';
import { generatorOptionsSchema } from './generator-schema';

const presetSchema = z
  .object({
    id: contentId,
    label: z.string().trim().min(1).max(60),
    description: z.string().trim().min(1).max(2000),
    options: generatorOptionsSchema.refine(
      (options) => options.version === 'v2',
    ),
  })
  .strict();

export const dungeonPresets =
  contentCatalog(presetSchema).parse(catalog).entries;
export const defaultDungeonPreset = dungeonPresets[0];

export function findDungeonPreset(id: unknown) {
  return dungeonPresets.find((preset) => preset.id === id);
}
