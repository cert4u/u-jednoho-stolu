import { gameHeaders } from './responses';
import { sharedPortraitHeader } from '../../../lib/game-view-wire';

type Snapshot = { id: string; version: number; data: string };
type CachedRoom = Pick<Snapshot, 'version' | 'data'> & {
  tags: Map<string, string>;
};
const cachedRooms = new Map<string, CachedRoom>();
const MAX_ROOMS = 8;
const MAX_SNAPSHOT_CHARS = 512_000;
const MAX_TAGS_PER_ROOM = 32;

function cacheFor({ id, version, data }: Snapshot) {
  if (data.length > MAX_SNAPSHOT_CHARS) return;
  let room = cachedRooms.get(id);
  // A database restore can replace a room with different data at the same revision.
  if (room?.version !== version || room.data !== data)
    room = { version, data, tags: new Map() };
  cachedRooms.delete(id);
  if (cachedRooms.size >= MAX_ROOMS)
    cachedRooms.delete(cachedRooms.keys().next().value!);
  cachedRooms.set(id, room);
  return room.tags;
}

/** Call after authorization and level validation. The projection uses only this stored snapshot. */
export async function conditionalView(
  request: Request,
  snapshot: Snapshot,
  viewKey: string,
  project: () => unknown,
) {
  const tags = cacheFor(snapshot);
  const known = tags?.get(viewKey);
  const requested = request.headers.get('if-none-match');
  const headers = {
    ...gameHeaders,
    Vary: `Authorization, ${sharedPortraitHeader}`,
    'Content-Type': 'application/json',
  };
  if (known && requested === known)
    return new Response(null, {
      status: 304,
      headers: { ...headers, ETag: known },
    });

  const body = JSON.stringify(project());
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(body),
  );
  const etag =
    '"' +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('') +
    '"';
  if (tags) {
    if (!tags.has(viewKey) && tags.size >= MAX_TAGS_PER_ROOM)
      tags.delete(tags.keys().next().value!);
    tags.set(viewKey, etag);
  }
  const responseHeaders = { ...headers, ETag: etag };
  return requested === etag
    ? new Response(null, { status: 304, headers: responseHeaders })
    : new Response(body, { headers: responseHeaders });
}
