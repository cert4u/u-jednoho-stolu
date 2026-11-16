import { env } from 'cloudflare:workers';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { rooms } from '../../../db/schema';
import { makeBackup } from '../../../lib/backup';
import { assertBackupSize } from '../../../lib/backup-limits';
import type { Game } from '../../../lib/game';
import { assertRoomStorage } from '../../../lib/room-storage-limit';
import { publicAccounts } from './public-accounts';
import { pjDefaults, readPjUsage, roomBytesLimit } from './admission';

const nativeNode =
  (env as unknown as { STUL_NATIVE_NODE?: unknown }).STUL_NATIVE_NODE === true;
const encoder = new TextEncoder();

export function assertCampaignFits(game: Game) {
  assertBackupSize(makeBackup(game));
  assertRoomStorage(game, nativeNode);
}

export function readRoom(id: string, includeArchived = false) {
  return getDb()
    .select()
    .from(rooms)
    .where(
      and(
        eq(rooms.id, id),
        includeArchived ? undefined : isNull(rooms.archivedAt),
      ),
    )
    .get();
}

type RoomRow = NonNullable<Awaited<ReturnType<typeof readRoom>>>;

export function serializeCampaign(game: Game) {
  assertCampaignFits(game);
  return JSON.stringify(game);
}

export async function writeRoom(
  row: RoomRow,
  serialized: string,
  activity: boolean,
  ownerId?: string,
  playedOn?: string,
) {
  const dataBytes = encoder.encode(serialized).length;
  const oldBytes = encoder.encode(row.data).length;
  const grow = dataBytes > oldBytes;
  const tableOwner = publicAccounts() ? row.ownerId : null;
  const storageLimit = roomBytesLimit();
  const db = getDb();

  // Check both the revision and the installation budget in the same atomic write.
  // An installation over its budget can still save changes that do not grow the room.
  const updated = await db
    .update(rooms)
    .set({
      data: serialized,
      version: row.version + 1,
      ...(activity ? { lastActivityAt: Date.now() } : {}),
      ...(playedOn && playedOn !== row.lastPlayDay
        ? { lastPlayDay: playedOn }
        : {}),
    })
    .where(
      and(
        eq(rooms.id, row.id),
        eq(rooms.version, row.version),
        isNull(rooms.archivedAt),
        ownerId
          ? sql`EXISTS (SELECT 1 FROM pj_accounts WHERE id = ${ownerId} AND status = 'approved' AND verified_at IS NOT NULL)`
          : undefined,
        grow
          ? sql`(SELECT coalesce(sum(length(CAST(data AS BLOB))),0) FROM rooms WHERE id != ${row.id}) + ${dataBytes} <= ${storageLimit}`
          : undefined,
        grow && tableOwner
          ? sql`NOT EXISTS (
          SELECT 1 FROM (
            SELECT coalesce(bytes_limit, ${pjDefaults().bytes}) AS bytes_limit
            FROM pj_accounts WHERE id = ${tableOwner}
          ) budget
          WHERE budget.bytes_limit IS NOT NULL
            AND (SELECT coalesce(sum(length(CAST(data AS BLOB))), 0) FROM rooms WHERE owner_id = ${tableOwner} AND id != ${row.id})
              + ${dataBytes} > budget.bytes_limit
        )`
          : undefined,
      ),
    )
    .returning({ id: rooms.id });
  if (updated.length) return { status: 'saved' } as const;

  if (grow) {
    const current = await readRoom(row.id);
    if (current?.version !== row.version) return { status: 'retry' } as const;
    if (tableOwner) {
      const usage = await readPjUsage(tableOwner);
      if (
        usage?.byteLimit != null &&
        usage.bytes - oldBytes + dataBytes > usage.byteLimit
      )
        return { status: 'owner-capacity' } as const;
    }
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
