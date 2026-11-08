import type { Game } from './game';

// D1 counts the entire SQLite row; leave 100 bytes for the fixed room ID/integers/record header.
export const MAX_D1_ROOM_BYTES = 1_999_900;
export class RoomStorageSizeError extends Error {
  constructor() {
    super('Kampaň přesahuje kapacitu jednoho řádku Cloudflare D1 (2 MB). Změna nebyla uložena. Pro větší kampaň použij Node/Docker.');
  }
}
export function assertRoomStorage(g: Game, nativeNode: boolean) {
  if (!nativeNode && new TextEncoder().encode(JSON.stringify(g)).length > MAX_D1_ROOM_BYTES)
    throw new RoomStorageSizeError();
}
