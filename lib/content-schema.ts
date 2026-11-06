import { z } from 'zod';

export const contentId = z.string().regex(/^[a-z][a-z0-9-]{0,49}$/);

export function contentCatalog<T extends z.ZodType<{ id: string }>>(entry: T) {
  return z
    .object({
      version: z.literal(1),
      entries: z
        .array(entry)
        .min(1)
        .refine(
          (entries) =>
            new Set(entries.map((item) => item.id)).size === entries.length,
          'Duplicitní ID v katalogu.',
        ),
    })
    .strict();
}
