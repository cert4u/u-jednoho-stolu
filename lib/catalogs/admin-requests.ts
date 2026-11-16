import { z } from 'zod';
import { contentId } from '../content-schema';
import { catalogTypeSchema, manifestSchema } from './model';

const positiveInteger = z.number().int().positive();
const target = { id: contentId, expectedRevision: positiveInteger };
const token = z.strictObject({ token: z.uuid() });
const entryTarget = { ...target, type: catalogTypeSchema };

export const catalogAdminRequests = {
  github: z.strictObject({
    repository: z.string(),
    ref: z.string().optional(),
    updateId: contentId.optional(),
  }),
  recommend: z.strictObject({}),
  create: z.strictObject({ manifest: manifestSchema }),
  manifest: z.strictObject({ ...target, manifest: z.unknown() }),
  entry: z.discriminatedUnion('remove', [
    z.strictObject({
      ...entryTarget,
      entry: z.unknown(),
      originalId: contentId.optional(),
      remove: z.literal(false).optional(),
      validateOnly: z.boolean().optional(),
    }),
    z.strictObject({
      ...entryTarget,
      originalId: contentId,
      remove: z.literal(true),
      validateOnly: z.literal(false).optional(),
    }),
  ]),
  copy: z.strictObject({
    sourceId: contentId,
    targetId: contentId,
    expectedRevision: positiveInteger,
    type: catalogTypeSchema,
    itemId: contentId,
    newId: contentId,
  }),
  enable: z.strictObject({ ...target, enabled: z.boolean() }),
  remove: z.strictObject({
    ...target,
    preserveCampaigns: z.boolean().optional(),
  }),
  install: token,
  discard: token,
  rollback: z.strictObject({ ...target, historyId: positiveInteger }),
};

export const catalogIdQuery = z.strictObject({ id: contentId });
export const catalogImageQuery = z.strictObject({
  id: contentId,
  revision: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .transform(Number)
    .pipe(positiveInteger),
  portrait: contentId,
});

export type CatalogRequests = {
  [Action in keyof typeof catalogAdminRequests]: z.input<
    (typeof catalogAdminRequests)[Action]
  >;
};
