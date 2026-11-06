import { z } from 'zod';

export const contentId = z.string().regex(/^[a-z][a-z0-9-]{0,49}$/);

export function parseCatalog<T extends z.ZodType<{ id: string }>>(
  sources: readonly { path: string; data: unknown }[],
  schema: T,
): z.output<T>[] {
  const ids = new Set<string>();
  return sources.map(({ path, data }) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues.map(issue => {
        const field = issue.path.join('.') || 'položka';
        if (issue.code === 'invalid_type')
          return issue.received === 'undefined'
            ? `chybí povinné pole ${field}`
            : `${field}: očekávaný typ ${issue.expected}`;
        if (issue.code === 'custom') return `${field}: ${issue.message}`;
        if (issue.code === 'too_big') return `${field}: maximum je ${issue.maximum}`;
        if (issue.code === 'too_small') return `${field}: minimum je ${issue.minimum}`;
        if (issue.code === 'unrecognized_keys') return `neznámá pole ${issue.keys.join(', ')}`;
        return `${field}: nepovolená hodnota`;
      });
      throw new Error(`${path}: ${issues.join('. ')}`);
    }
    if (ids.has(result.data.id)) throw new Error(`${path}: duplicitní ID „${result.data.id}“.`);
    ids.add(result.data.id);
    return result.data;
  });
}
