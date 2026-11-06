import { constants, chmodSync, closeSync, fsyncSync, openSync, mkdirSync, readdirSync, renameSync, lstatSync, statSync, statfsSync, unlinkSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { backupDatabase, dataDirectory } from './database.mjs';

const namePattern = /^(manual-)?(\d+)-[a-f0-9]{16}\.sqlite$/;

export function createSnapshot(manual = false) {
  const dir = path.join(dataDirectory(), 'backups');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = `${manual ? 'manual-' : ''}${Date.now()}-${randomBytes(8).toString('hex')}.sqlite`;
  const temp = path.join(dir, '.' + name + '.tmp');
  try {
    backupDatabase(temp);
    chmodSync(temp, 0o600);
    const snapshot = openSync(temp, 'r');
    try { fsyncSync(snapshot); } finally { closeSync(snapshot); }
    renameSync(temp, path.join(dir, name));
    const directory = openSync(dir, 'r');
    try { fsyncSync(directory); } finally { closeSync(directory); }
    return name;
  } finally {
    try { unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export function snapshots() {
  const dir = path.join(dataDirectory(), 'backups');
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return entries.flatMap(entry => {
    const match = entry.name.match(namePattern);
    if (!match || !entry.isFile()) return [];
    try {
      const stat = lstatSync(path.join(dir, entry.name));
      if (!stat.isFile()) return [];
      return [{ name: entry.name, manual: Boolean(match[1]), size: stat.size,
        createdAt: new Date(Number(match[2])).toJSON() }];
    } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function downloadSnapshot(name, res) {
  if (!namePattern.test(name ?? '')) return false;
  let file;
  try { file = await open(path.join(dataDirectory(), 'backups', name), constants.O_RDONLY | constants.O_NOFOLLOW); }
  catch (error) { if (['ENOENT', 'ELOOP'].includes(error.code)) return false; throw error; }
  try {
    const stat = await file.stat();
    if (!stat.isFile()) return false;
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream', 'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    const stream = file.createReadStream();
    res.once('close', () => stream.destroy());
    stream.on('error', () => res.destroy());
    stream.pipe(res);
    file = undefined; // The stream owns the open file descriptor.
    return true;
  } finally { await file?.close(); }
}

export function storageStatus() {
  const dir = dataDirectory();
  const volume = statfsSync(dir);
  const databaseBytes = ['game.sqlite', 'game.sqlite-wal'].reduce((total, name) => {
    try { return total + statSync(path.join(dir, name)).size; }
    catch (error) { if (error.code === 'ENOENT') return total; throw error; }
  }, 0);
  return { databaseBytes, freeBytes: volume.bavail * volume.bsize };
}
