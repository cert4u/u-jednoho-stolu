// Bounded, process-local prepared imports. ZIP and GitHub share this exact path.
import { readCatalogs, inTransaction, saveCatalog, assertRevision, reserveAssets } from './repository.mjs';
import { loadCatalogCore, validateLibrary } from './validation.mjs';
import { catalogUsage } from './usage.mjs';
import { saveAsset } from '../catalog-files.mjs';
import { unpackCatalog } from '../catalog-pack.mjs';
const now = () => new Date().toISOString();
const previews = new Map();
function prunePreviews() {
    for (const [key, value] of previews) {
        if (value.expires < Date.now()) {
            previews.delete(key);
        }
    }
}
export async function prepareCatalogImport(bytes, { source, updateId } = {}) {
    const api = await loadCatalogCore();
    const prepared = await unpackCatalog(bytes, api, readCatalogs());
    const id = prepared.bundle.manifest.id;
    const previous = readCatalogs().find(c => c.bundle.manifest.id === id);
    if (updateId) {
        if (id !== updateId || previous?.kind !== 'community' || previous.source?.repository !== source?.repository) {
            throw new Error('Aktualizace musí patřit původnímu komunitnímu zdroji.');
        }
        if (api.compareVersions(prepared.bundle.manifest.version, previous.bundle.manifest.version) < 0) {
            throw new Error('Starší verzi instaluj pouze návratem historie.');
        }
    }
    else if (previous) {
        throw new Error('Katalog s tímto ID již existuje. Vytvoř vlastní kopii nebo použij aktualizaci zdroje.');
    }
    const old = new Map(Object.entries(previous?.bundle.entries ?? {}).flatMap(([type, entries]) => entries.map(e => [`${type}/${e.id}`, JSON.stringify(e)]))), fresh = new Map(Object.entries(prepared.bundle.entries).flatMap(([type, entries]) => entries.map(e => [`${type}/${e.id}`, JSON.stringify(e)])));
    const items = { added: [...fresh.keys()].filter(k => !old.has(k)), changed: [...fresh.keys()].filter(k => old.has(k) && fresh.get(k) !== old.get(k)), removed: [...old.keys()].filter(k => !fresh.has(k)) };
    const diff = Object.fromEntries(Object.entries(items).map(([key, value]) => [key, value.length]));
    const dependencies = prepared.bundle.manifest.dependencies.filter(d => !previous?.bundle.manifest.dependencies.some(p => p.id === d.id && p.minVersion === d.minVersion));
    const summary = {
        manifest: prepared.bundle.manifest,
        digest: prepared.digest,
        source,
        currentVersion: previous?.bundle.manifest.version,
        currentRevision: previous?.revision,
        currentDigest: previous?.digest,
        currentSource: previous?.source,
        diff,
        items,
        newDependencies: dependencies,
        counts: Object.fromEntries(Object.entries(prepared.bundle.entries).map(([k, v]) => [k, v.length])),
        preservedCampaigns: updateId ? catalogUsage(id).length : 0,
    };
    if (updateId && prepared.digest === previous.digest) {
        return { ...summary, upToDate: true };
    }
    if (updateId && catalogUsage(id).some(u => !u.preserved)) {
        throw new Error('Nejdřív zachovej podklady existujících kampaní.');
    }
    prunePreviews();
    if (previews.size >= 2) {
        throw new Error('Dokonči nebo zahoď předchozí návrh importu.');
    }
    const token = crypto.randomUUID();
    previews.set(token, { ...prepared, source, previousRevision: previous?.revision ?? null, expires: Date.now() + 5 * 60e3 });
    return { ...summary, token, upToDate: false };
}
export function discardImport(token) {
    previews.delete(token);
    return { ok: true };
}
export async function installPrepared(token) {
    prunePreviews();
    const prepared = previews.get(token);
    if (!prepared) {
        throw new Error('Náhled vypršel. Připrav nový import.');
    }
    const api = await loadCatalogCore();
    // Reserve before disk writes. Recheck mutable library state in the final transaction.
    inTransaction(db => reserveAssets(db, prepared.bundle.assets));
    for (const [digest, bytes] of prepared.images) {
        await saveAsset(digest, bytes);
    }
    const result = inTransaction(db => {
        const all = readCatalogs(db), id = prepared.bundle.manifest.id, previous = all.find(c => c.bundle.manifest.id === id);
        assertRevision(previous, prepared.previousRevision);
        if (previous && catalogUsage(id).some(u => !u.preserved)) {
            throw new Error('Kampaň nemá zachované podklady; aktualizace je blokována.');
        }
        if (previous?.kind === 'local') {
            throw new Error('Vlastní katalog nelze přepsat importem.');
        }
        if (!previous && all.length >= 16) {
            throw new Error('Knihovna podporuje nejvýše 16 místních katalogů.');
        }
        const next = { bundle: prepared.bundle, digest: prepared.digest, source: prepared.source, kind: 'community', enabled: previous?.enabled ?? true, installedAt: previous?.installedAt ?? now(), checkedAt: now() };
        validateLibrary(api, [...all.filter(c => c !== previous), next]);
        reserveAssets(db, next.bundle.assets);
        saveCatalog(db, next, previous);
        return { ok: true, id };
    });
    previews.delete(token);
    return result;
}
