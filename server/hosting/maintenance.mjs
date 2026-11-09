import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { dataDirectory, openDatabase } from '../database.mjs';
import { body, equal, json } from '../http.mjs';
import { createSnapshot } from '../snapshots.mjs';

export function createMaintenance({ token, info }) {
  const flag = path.join(dataDirectory(), 'maintenance');
  let inFlight = 0,
    draining = false;
  function syncMaintenanceFlag() {
    const directory = openSync(dataDirectory(), 'r');
    try {
      fsyncSync(directory);
    } finally {
      closeSync(directory);
    }
  }
  const hasMarker = () => existsSync(flag);
  const blocksWrites = () => draining || hasMarker();

  // Release exactly once even if a proxied response emits both end and close.
  function trackMutation(mutates) {
    if (mutates) inFlight++;
    let done = false;
    return () => {
      if (mutates && !done) {
        done = true;
        inFlight--;
      }
    };
  }

  async function handleInternal(req, res, pathname, port) {
    if (!equal(req.headers.authorization, `Bearer ${token}`)) {
      json(res, 401, { error: 'Nepovolený přístup.' });
      return;
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'Použij POST.' });
      return;
    }
    if (pathname === '/internal/maintenance') {
      const b = await body(req);
      if (b.enabled !== true && b.enabled !== false)
        throw new Error('Chybí stav údržby.');
      if (b.enabled) {
        draining = true;
        writeFileSync(flag, 'maintenance', { mode: 0o600, flush: true });
        syncMaintenanceFlag();
        const end = Date.now() + 15000;
        while (inFlight && Date.now() < end)
          await new Promise((r) => setTimeout(r, 50));
        if (inFlight) throw new Error('Požadavky se ještě dokončují.');
      } else {
        if (existsSync(flag)) {
          unlinkSync(flag);
          syncMaintenanceFlag();
        }
        draining = false;
      }
      json(res, 200, { ok: true });
      return;
    }
    if (pathname === '/internal/backup') {
      if (!existsSync(flag) || inFlight)
        throw new Error('Záloha vyžaduje klidový režim.');
      json(res, 200, { name: createSnapshot() });
      return;
    }
    if (pathname === '/internal/smoke') {
      const db = openDatabase();
      db.prepare('SELECT id, data, version FROM rooms LIMIT 0').all();
      if (db.prepare('PRAGMA quick_check(1)').get()?.quick_check !== 'ok')
        throw new Error('Databáze neprošla kontrolou integrity.');
      const migrations = new Set(
        readdirSync('drizzle').filter((name) => name.endsWith('.sql')),
      );
      if (
        db
          .prepare('SELECT name FROM stul_migrations')
          .all()
          .some((row) => !migrations.has(row.name))
      )
        throw new Error('Databáze obsahuje migraci z novější verze.');
      const local = `http://127.0.0.1:${port}`;
      const [game, admin, protectedAdmin] = await Promise.all(
        [
          '/api/game?room=stul-smoke-neexistuje',
          '/admin',
          '/admin/api/status',
        ].map((endpoint) =>
          fetch(local + endpoint, { signal: AbortSignal.timeout(5000) }),
        ),
      );
      const gameBody = await game.json();
      if (
        game.status !== 404 ||
        typeof gameBody.error !== 'string' ||
        admin.status !== 200 ||
        !(await admin.text()).includes('Správa instalace') ||
        protectedAdmin.status !== 401
      )
        throw new Error('Herní API nebo administrace neprošly kontrolou.');
      await protectedAdmin.text();
      json(res, 200, { ok: true, revision: info.revision });
      return;
    }
    json(res, 404, { error: 'Nenalezeno.' });
    return;
  }
  return { hasMarker, blocksWrites, trackMutation, handleInternal };
}
