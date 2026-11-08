import { env } from 'cloudflare:workers';

function limit(name: string, fallback: number) {
  const value = Number((env as unknown as Record<string, unknown>)[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function roomBytesLimit() { return limit('STUL_ROOM_BYTES_LIMIT', 256_000_000); }

/** One conditional SQLite statement serializes admission across workers/processes. No client IP is trusted. */
export async function admitRoom(id: string, data: string) {
  const db = env.DB;
  if (!db) throw new Error('Database unavailable');
  const rate = limit('STUL_ROOM_CREATE_RATE', 100);
  const count = limit('STUL_ROOM_LIMIT', 1000);
  const bytes = roomBytesLimit();
  const now = Date.now(), since = now - 60_000;
  const result = await db.prepare(`INSERT INTO rooms (id,data,version,created_at)
    SELECT ?,?,0,? WHERE
      (SELECT count(*) FROM rooms WHERE created_at > ?) < ? AND
      (SELECT count(*) FROM rooms) < ? AND
      (SELECT coalesce(sum(length(CAST(data AS BLOB))),0) FROM rooms) + ? <= ?
    RETURNING id`).bind(id, data, now, since, rate, count, new TextEncoder().encode(data).length, bytes).all();
  if (result.results.length) return;
  const recent = await db.prepare('SELECT count(*) AS total FROM rooms WHERE created_at > ?').bind(since).first<{total: number}>();
  const limited = (recent?.total ?? 0) >= rate;
  console.warn('game_room_admission_denied', limited ? 'rate' : 'capacity');
  return Response.json({ error: limited ? 'Vzniká příliš mnoho stolů. Zkus to za minutu.' : 'Instalace dosáhla kapacity kampaní. Kontaktuj správce.' }, {
    status: limited ? 429 : 503,
    headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
  });
}
