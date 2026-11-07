// SQLite persistence only. Transaction callbacks must remain synchronous.
import { openDatabase } from '../database.mjs';
const now = () => new Date().toISOString();
export function readCatalogs(db = openDatabase()) {
    return db.prepare('SELECT * FROM catalogs ORDER BY installed_at,id').all().map(row => ({
        kind: row.kind,
        enabled: Boolean(row.enabled),
        revision: row.revision,
        digest: row.digest,
        bundle: JSON.parse(row.payload),
        source: row.source ? JSON.parse(row.source) : undefined,
        installedAt: row.installed_at,
        checkedAt: row.checked_at,
        updatedAt: row.updated_at,
    }));
}
export function getCatalog(id) {
    const found = readCatalogs().find(c => c.bundle.manifest.id === id);
    if (!found) {
        throw new Error('Katalog neexistuje.');
    }
    return found;
}
export function requireWritableCatalog(id, expected) {
    const c = getCatalog(id);
    if (c.kind !== 'local') {
        throw new Error('Komunitní originál je pouze pro čtení. Vytvoř vlastní kopii.');
    }
    if (c.revision !== expected) {
        throw new Error('Katalog se změnil; načti aktuální verzi.');
    }
    return c;
}
export function inTransaction(fn) {
    const db = openDatabase();
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = fn(db);
        db.exec('COMMIT');
        return result;
    }
    catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}
function remember(db, c) {
    db.prepare('INSERT INTO catalog_versions(catalog_id,digest,payload,source,saved_at) VALUES(?,?,?,?,?)').run(c.bundle.manifest.id, c.digest, JSON.stringify(c.bundle), c.source ? JSON.stringify(c.source) : null, now());
    db.prepare('DELETE FROM catalog_versions WHERE catalog_id=? AND id NOT IN (SELECT id FROM catalog_versions WHERE catalog_id=? ORDER BY id DESC LIMIT 10)').run(c.bundle.manifest.id, c.bundle.manifest.id);
}
export function saveCatalog(db, c, previous) {
    if (previous) {
        remember(db, previous);
    }
    db.prepare('INSERT INTO catalogs(id,kind,enabled,revision,digest,payload,source,installed_at,checked_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,digest=excluded.digest,payload=excluded.payload,source=excluded.source,checked_at=excluded.checked_at,updated_at=excluded.updated_at').run(c.bundle.manifest.id, c.kind, Number(c.enabled), (previous?.revision ?? 0) + 1, c.digest, JSON.stringify(c.bundle), c.source ? JSON.stringify(c.source) : null, c.installedAt ?? now(), c.checkedAt ?? null, previous?.digest === c.digest ? previous.updatedAt : now());
}
export function assertRevision(previous, expected) {
    if ((previous?.revision ?? null) !== expected) {
        throw new Error('Katalog se mezitím změnil. Připrav nový návrh.');
    }
}
export function reserveAssets(db, assets) {
    if (db.prepare('SELECT count(*) n FROM catalog_assets').get().n + assets.filter(a => !db.prepare('SELECT digest FROM catalog_assets WHERE digest=?').get(a.digest)).length > 4096) {
        throw new Error('Knihovna podporuje nejvýše 4096 neměnných příloh.');
    }
    const used = db.prepare('SELECT coalesce(sum(bytes),0) n FROM catalog_assets').get().n;
    const fresh = assets.filter(a => !db.prepare('SELECT digest FROM catalog_assets WHERE digest=?').get(a.digest));
    if (used + fresh.reduce((n, a) => n + a.bytes, 0) > 128000000) {
        throw new Error('Přílohy knihovny překračují limit 128 MB.');
    }
    for (const a of fresh) {
        db.prepare('INSERT OR IGNORE INTO catalog_assets VALUES(?,?,?)').run(a.digest, a.bytes, a.mime);
    }
}
export function readCampaigns() {
    return openDatabase().prepare('SELECT id,data FROM rooms').all();
}
export function getCatalogHistory(id) {
    return openDatabase().prepare('SELECT id,digest,saved_at FROM catalog_versions WHERE catalog_id=? ORDER BY id DESC').all(id);
}
export function getHistoryVersion(id, historyId) {
    return openDatabase().prepare('SELECT * FROM catalog_versions WHERE catalog_id=? AND id=?').get(id, historyId);
}
export function deleteCatalog(db, id) {
    db.prepare('DELETE FROM catalogs WHERE id=?').run(id);
    db.prepare('DELETE FROM catalog_versions WHERE catalog_id=?').run(id);
}
export function markCatalogChecked(id, revision) {
    openDatabase().prepare('UPDATE catalogs SET checked_at=? WHERE id=? AND revision=?').run(now(), id, revision);
}
