import { env } from 'cloudflare:workers';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { rooms } from '../../../db/schema';
import { makeBackup } from '../../../lib/backup';
import { assertBackupSize } from '../../../lib/backup-limits';
import type { Game } from '../../../lib/game';
import { assertRoomStorage } from '../../../lib/room-storage-limit';
import { roomBytesLimit } from './admission';

const nativeNode =
  (env as unknown as { STUL_NATIVE_NODE?: unknown }).STUL_NATIVE_NODE === true;
const encoder = new TextEncoder();

export function assertCampaignFits(game: Game) {
  assertBackupSize(makeBackup(game));
  assertRoomStorage(game, nativeNode);
}

export function readRoom(id: string) {
  return getDb().select().from(rooms).where(eq(rooms.id, id)).get();
}

type RoomRow = NonNullable<Awaited<ReturnType<typeof readRoom>>>;

export function serializeCampaign(game: Game) {
  assertCampaignFits(game);
  return JSON.stringify(game);
}

export async function writeRoom(row: RoomRow, serialized: string) {
  const dataBytes = encoder.encode(serialized).length;
  const storageLimit = roomBytesLimit();
  const db = getDb();

  // Check both the revision and the installation budget in the same atomic write.
  // An installation over its budget can still save changes that do not grow the room.
  const updated = await db
    .update(rooms)
    .set({ data: serialized, version: row.version + 1 })
    .where(
      and(
        eq(rooms.id, row.id),
        eq(rooms.version, row.version),
        sql`(${dataBytes} <= length(CAST(${rooms.data} AS BLOB)) OR
        (SELECT coalesce(sum(length(CAST(data AS BLOB))),0) FROM rooms WHERE id != ${row.id}) + ${dataBytes} <= ${storageLimit})`,
      ),
    )
    .returning({ id: rooms.id });
  if (updated.length) return { status: 'saved' } as const;

  const oldBytes = encoder.encode(row.data).length;
  if (dataBytes > oldBytes) {
    const total = await db
      .select({
        bytes: sql<number>`coalesce(sum(length(CAST(data AS BLOB))),0)`,
      })
      .from(rooms)
      .get();
    if (Number(total?.bytes) - oldBytes + dataBytes > storageLimit)
      return { status: 'capacity' } as const;
  }
  return { status: 'retry' } as const;
}
