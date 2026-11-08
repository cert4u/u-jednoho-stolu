/** Copy an object without selected own fields; useful for explicit private-data projections. */
export function omitFields<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Omit<T, K> {
  const result = { ...value };
  for (const key of keys) delete result[key];
  return result;
}
