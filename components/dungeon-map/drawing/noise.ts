/** Local visual noise. It does not use the dungeon generator or mutable PRNG state. */
export function inkNoise(key: string, sample = 0): number {
  let hash = 2166136261;
  const text = `ink-v1:${key}:${sample}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 4294967296;
}
