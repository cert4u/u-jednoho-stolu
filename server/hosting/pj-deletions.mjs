import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const pjDeletionsFilename = 'pj-deletions.sqlite';
const selectIds = 'SELECT id FROM deleted_rooms';

// This ledger lives beside game.sqlite. Restoring a game snapshot leaves it intact.
export function openPjDeletions(directory, create = false) {
  const path = join(directory, pjDeletionsFilename);
  if (!create && !existsSync(path)) return null;
  const db = new DatabaseSync(path);
  db.exec(
    'PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS deleted_rooms (id TEXT PRIMARY KEY NOT NULL)',
  );

  function removeRecordedRooms(rooms) {
    const remove = rooms.prepare('DELETE FROM rooms WHERE id = ?');
    for (const row of db.prepare(selectIds).iterate()) remove.run(row.id);
  }

  function record(ids) {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO deleted_rooms(id) VALUES (?)',
    );
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const { id } of ids) insert.run(id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return { removeRecordedRooms, record, close: () => db.close() };
}

export function snapshotPjDeletions(directory, maxBytes) {
  const path = join(directory, pjDeletionsFilename);
  if (!existsSync(path)) return null;
  const db = new DatabaseSync(path, { readOnly: true });
  let temp;
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    const { page_count: pages } = db.prepare('PRAGMA page_count').get();
    const { page_size: pageSize } = db.prepare('PRAGMA page_size').get();
    if (pages * pageSize > maxBytes)
      throw new Error('Evidence smazaných stolů překračuje limit zálohy.');
    temp = mkdtempSync(join(tmpdir(), 'stul-pj-deletions-'));
    const snapshot = join(temp, pjDeletionsFilename);
    db.prepare('VACUUM INTO ?').run(snapshot);
    return readFileSync(snapshot);
  } finally {
    db.close();
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

export function mergePjDeletions(sourceFile, targetDirectory) {
  const source = new DatabaseSync(sourceFile, { readOnly: true });
  try {
    const ids = source.prepare(selectIds).iterate();
    const target = openPjDeletions(targetDirectory, true);
    try {
      target.record(ids);
    } finally {
      target.close();
      ids.return();
    }
  } finally {
    source.close();
  }
}
