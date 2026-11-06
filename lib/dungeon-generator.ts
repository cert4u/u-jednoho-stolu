import { generateDungeon as generateV1 } from './dungeon-generator-v1';
import { generatorOptions } from './generator-options';
import { generateDungeonV2 } from './generator-v2';
import type { GeneratedDungeon } from './generator-types';

export { generatorOptions } from './generator-options';
export type {
  GeneratorOptions,
  GeneratedDungeon,
  GeneratedFloor,
  GeneratedRoom,
  GenerationMetadata,
  DungeonStyle,
} from './generator-types';

export function generateDungeon(raw: unknown): GeneratedDungeon {
  const options = generatorOptions(raw);
  return options.version === 'v1'
    ? generateV1(options)
    : generateDungeonV2(options);
}
