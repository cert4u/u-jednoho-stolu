import { z } from 'zod';

export const generatorLimits = {
  maxLevels: 8,
  minRooms: 2,
  maxRooms: 12,
  maxLargeRooms: 6,
  maxConnections: 4,
  maxNameLength: 35,
  maxSeedLength: 64,
} as const;

function integer(min: number, max: number, label: string) {
  const message = `${label}: zadej celé číslo od ${min} do ${max}.`;
  return z
    .number({ error: message })
    .int(message)
    .min(min, message)
    .max(max, message);
}

const sizeOrCorridorsError = 'Vyber velikost místností a podobu chodeb.';
const nameError = `Název jeskyně musí mít 1 až ${generatorLimits.maxNameLength} znaků.`;
const seedError = `Semínko musí mít 1 až ${generatorLimits.maxSeedLength} znaků.`;

// Store all fields explicitly. Only incoming generation requests get legacy defaults.
const optionsFields = z.object({
  version: z.enum(['v1', 'v2'], {
    error: 'Neznámá verze generátoru.',
  }),
  style: z.enum(['castle', 'mine', 'cave'], {
    error: 'Vyber styl podzemí.',
  }),
  variant: integer(0, 2, 'Varianta'),
  separateExit: z.boolean({
    error: 'Vyber, zda vytvořit samostatný východ.',
  }),
  name: z
    .string({ error: nameError })
    .trim()
    .min(1, nameError)
    .max(generatorLimits.maxNameLength, nameError),
  levels: integer(1, generatorLimits.maxLevels, 'Počet pater'),
  rooms: integer(
    generatorLimits.minRooms,
    generatorLimits.maxRooms,
    'Místností na patro',
  ),
  size: z.enum(['small', 'medium', 'large'], {
    error: sizeOrCorridorsError,
  }),
  corridors: z.enum(['direct', 'winding'], { error: sizeOrCorridorsError }),
  connections: integer(0, generatorLimits.maxConnections, 'Další propojení'),
  seed: z
    .string({ error: seedError })
    .trim()
    .min(1, seedError)
    .max(generatorLimits.maxSeedLength, seedError),
});

export type GeneratorOptions = z.infer<typeof optionsFields>;
export type GeneratorVersion = GeneratorOptions['version'];
export type DungeonStyle = GeneratorOptions['style'];

export function maxGeneratorRooms(size: GeneratorOptions['size']) {
  return size === 'large'
    ? generatorLimits.maxLargeRooms
    : generatorLimits.maxRooms;
}

function checkOptionCombinations(
  options: GeneratorOptions,
  context: z.RefinementCtx,
) {
  if (
    options.version === 'v1' &&
    (options.style !== 'castle' || options.variant !== 0)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['version'],
      message:
        'Původní generátor V1 podporuje pouze původní styl a variantu 1.',
    });
  }

  const maxRooms = maxGeneratorRooms(options.size);
  if (options.rooms > maxRooms) {
    context.addIssue({
      code: 'custom',
      path: ['rooms'],
      message: `Místností na patro: zadej celé číslo od ${generatorLimits.minRooms} do ${maxRooms}.`,
    });
  }
}

export const generatorOptionsSchema = optionsFields.superRefine(
  checkOptionCombinations,
);

const generatorRequestSchema = optionsFields
  .extend({
    version: optionsFields.shape.version.default('v1'),
    style: optionsFields.shape.style.default('castle'),
    variant: optionsFields.shape.variant.default(0),
    separateExit: optionsFields.shape.separateExit.default(false),
  })
  .superRefine(checkOptionCombinations);

export function generatorOptions(raw: unknown): GeneratorOptions {
  const result = generatorRequestSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      issue?.path.length ? issue.message : 'Vyplň parametry jeskyně.',
    );
  }
  return result.data;
}
