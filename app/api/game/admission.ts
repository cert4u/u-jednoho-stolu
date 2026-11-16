import { env } from 'cloudflare:workers';
import { roomCapacity } from '../../../server/room-capacity.mjs';
import {
  defaultPjLimits,
  pjAdmissionError,
  pjAdmissionSql,
  pjAdmissionValues,
  pjUsageSql,
} from '../../../server/pj-quota.mjs';
import { fail } from './responses';

const limits = () => roomCapacity(env as unknown as Record<string, unknown>);

export function roomBytesLimit() {
  return limits().bytes;
}

type PjUsage = {
  tables: number;
  bytes: number;
  tableLimit: number | null;
  byteLimit: number | null;
};
export const pjDefaults = () =>
  defaultPjLimits(env as unknown as Record<string, unknown>);

export async function readPjUsage(id: string) {
  const db = env.DB;
  if (!db) throw new Error('Database unavailable');
  const defaults = pjDefaults();
  return db
    .prepare(pjUsageSql)
    .bind(defaults.tables, defaults.bytes, id)
    .first<PjUsage>();
}

/** One conditional SQLite statement serializes admission across workers/processes. No client IP is trusted. */
export async function admitRoom(id: string, data: string, ownerId?: string) {
  const db = env.DB;
  if (!db) throw new Error('Database unavailable');
  const { rate, tables: count, bytes } = limits();
  const dataBytes = new TextEncoder().encode(data).length;
  const now = Date.now(),
    since = now - 60_000;
  const result = await db
    .prepare(
      `INSERT INTO rooms (id,data,version,created_at,owner_id,last_activity_at,invite_token)
    SELECT ?,?,0,?,?,?,? WHERE
      (? IS NULL OR ${pjAdmissionSql}) AND
      (SELECT count(*) FROM rooms WHERE created_at > ?) < ? AND
      (SELECT count(*) FROM rooms) < ? AND
      (SELECT coalesce(sum(length(CAST(data AS BLOB))),0) FROM rooms) + ? <= ?
    RETURNING id`,
    )
    .bind(
      id,
      data,
      now,
      ownerId ?? null,
      now,
      ownerId ? crypto.randomUUID() : null,
      ownerId ?? null,
      ...pjAdmissionValues(ownerId ?? null, pjDefaults(), dataBytes),
      since,
      rate,
      count,
      dataBytes,
      bytes,
    )
    .all();
  if (result.results.length) return;
  if (ownerId) {
    const error = pjAdmissionError(await readPjUsage(ownerId), dataBytes);
    if (error) return fail(error, 409);
  }
  const recent = await db
    .prepare('SELECT count(*) AS total FROM rooms WHERE created_at > ?')
    .bind(since)
    .first<{ total: number }>();
  const limited = (recent?.total ?? 0) >= rate;
  console.warn('game_room_admission_denied', limited ? 'rate' : 'capacity');
  return Response.json(
    {
      error: limited
        ? 'Vzniká příliš mnoho stolů. Zkus to za minutu.'
        : 'Instalace dosáhla kapacity kampaní. Kontaktuj správce.',
    },
    {
      status: limited ? 429 : 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
    },
  );
}
