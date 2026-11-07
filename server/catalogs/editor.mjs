// Local editing, copying and image upload. Community originals remain read-only.
import { readCatalogs, getCatalog, requireWritableCatalog, inTransaction, saveCatalog, reserveAssets } from './repository.mjs';
import { loadCatalogCore, validateLibrary } from './validation.mjs';
import { assertEntryUnused } from './usage.mjs';
import { viewCatalog } from './queries.mjs';
import { saveAsset } from '../catalog-files.mjs';
import { bundleDigest, hashBytes } from '../catalog-pack.mjs';
const clone = value => structuredClone(value);
export async function createCatalog(manifest) {
    const api = await loadCatalogCore(), bundle = api.validateCatalog({ manifest, entries: api.emptyEntries(), assets: [] }, readCatalogs());
    inTransaction(db => {
        if (readCatalogs(db).some(c => c.bundle.manifest.id === bundle.manifest.id)) {
            throw new Error('ID katalogu již existuje.');
        }
        if (readCatalogs(db).length >= 16) {
            throw new Error('Knihovna podporuje nejvýše 16 místních katalogů.');
        }
        saveCatalog(db, { kind: 'local', enabled: true, bundle, digest: bundleDigest(bundle) }, null);
    });
    return viewCatalog(bundle.manifest.id);
}
async function saveLocal(id, expected, change) {
    const api = await loadCatalogCore();
    return inTransaction(db => {
        const previous = requireWritableCatalog(id, expected), next = clone(previous);
        change(next, api);
        next.bundle = api.catalogBundleSchema.parse(next.bundle);
        next.digest = bundleDigest(next.bundle);
        validateLibrary(api, readCatalogs(db).map(c => c.bundle.manifest.id === id ? next : c));
        reserveAssets(db, next.bundle.assets);
        saveCatalog(db, next, previous);
        return { ok: true, revision: previous.revision + 1 };
    });
}
export async function editManifest(id, expected, manifest) {
    return saveLocal(id, expected, next => {
        if (manifest.id !== id) {
            throw new Error('Interní ID katalogu je neměnné.');
        }
        next.bundle.manifest = manifest;
    });
}
export async function editEntry({ id, expectedRevision, type, entry, originalId, remove = false, validateOnly = false }) {
    const api = await loadCatalogCore();
    if (!api.catalogTypes.includes(type)) {
        throw new Error('Neznámý typ položky.');
    }
    const change = next => {
        const entries = next.bundle.entries[type], index = entries.findIndex(e => e.id === originalId);
        if (originalId && index < 0) {
            throw new Error('Položka neexistuje.');
        }
        if (remove) {
            if (!originalId) {
                throw new Error('Vyber položku k odstranění.');
            }
            assertEntryUnused(id, type, originalId);
            entries.splice(index, 1);
            delete next.bundle.manifest.fileLicenses[`${type}/${originalId}.json`];
            if (next.bundle.manifest.attributions) {
                delete next.bundle.manifest.attributions[`${type}/${originalId}.json`];
            }
            return;
        }
        const value = api.entrySchemas[type].parse(entry);
        if (originalId && value.id !== originalId) {
            throw new Error('ID existující položky neměň; použij Duplikovat.');
        }
        if (index < 0 && entries.some(e => e.id === value.id)) {
            throw new Error('Položka s tímto ID již existuje.');
        }
        if (index < 0) {
            entries.push(value);
        }
        else {
            entries[index] = value;
        }
    };
    if (validateOnly) {
        const next = clone(requireWritableCatalog(id, expectedRevision));
        change(next);
        api.validateCatalog(next.bundle, readCatalogs());
        return { valid: true, entry: api.entrySchemas[type].parse(entry) };
    }
    return saveLocal(id, expectedRevision, change);
}
export async function copyEntry({ sourceId, targetId, type, itemId, newId, expectedRevision }) {
    const api = await loadCatalogCore(), source = sourceId === 'builtin' ? api.builtinCatalog : getCatalog(sourceId);
    if (!api.catalogTypes.includes(type)) {
        throw new Error('Neznámý typ položky.');
    }
    const original = source.bundle.entries[type].find(e => e.id === itemId);
    if (!original) {
        throw new Error('Položka neexistuje.');
    }
    return saveLocal(targetId, expectedRevision, next => {
        const entry = clone(original);
        entry.id = newId;
        if (next.bundle.entries[type].some(e => e.id === newId)) {
            throw new Error('ID kopie již existuje.');
        }
        const explicit = ref => {
            const qualified = api.referenceInCatalog(ref, sourceId), [owner, local] = api.splitReference(qualified);
            if (owner !== targetId && !next.bundle.manifest.dependencies.some(d => d.id === owner)) {
                const dependency = owner === 'builtin' ? api.builtinCatalog : getCatalog(owner);
                next.bundle.manifest.dependencies.push({ id: owner, minVersion: dependency.bundle.manifest.version });
            }
            return `${owner}:${local}`;
        };
        if (type === 'adventures') {
            entry.dungeonPreset = explicit(entry.dungeonPreset);
            for (const room of entry.rooms) {
                if (room.monsters) {
                    room.monsters = room.monsters.map(explicit);
                }
            }
        }
        if (type === 'bestiary') {
            if (sourceId === 'builtin') {
                entry.portrait = `builtin:${entry.portrait ?? itemId}`;
            }
            else if (!entry.portrait?.startsWith('builtin:')) {
                const asset = source.bundle.assets.find(a => a.path === `images/${entry.portrait ?? itemId}.webp`);
                if (asset) {
                    entry.portrait = newId;
                    const path = `images/${newId}.webp`;
                    if (next.bundle.assets.some(a => a.path === path)) {
                        throw new Error('Pro kopii zvol jiné ID obrázku.');
                    }
                    next.bundle.assets.push({ ...asset, path });
                }
            }
        }
        const originalPath = `${type}/${itemId}.json`, copiedPath = `${type}/${newId}.json`;
        next.bundle.manifest.fileLicenses[copiedPath] = source.bundle.manifest.fileLicenses[originalPath] ?? source.bundle.manifest.license;
        next.bundle.manifest.attributions ??= {};
        next.bundle.manifest.attributions[copiedPath] = source.bundle.manifest.attributions?.[originalPath] ?? { author: source.bundle.manifest.author, source: `${sourceId}@${source.bundle.manifest.version}` };
        if (type === 'bestiary' && entry.portrait === newId) {
            const copiedImage = `images/${newId}.webp`, originalImage = `images/${original.portrait ?? itemId}.webp`;
            next.bundle.manifest.fileLicenses[copiedImage] = source.bundle.manifest.fileLicenses[originalImage] ?? source.bundle.manifest.license;
            next.bundle.manifest.attributions[copiedImage] = source.bundle.manifest.attributions?.[originalImage] ?? { author: source.bundle.manifest.author, source: `${sourceId}@${source.bundle.manifest.version}` };
        }
        next.bundle.entries[type].push(entry);
    });
}
export async function uploadImage(id, expectedRevision, portrait, bytes) {
    const api = await loadCatalogCore();
    api.inspectCatalogWebp(bytes);
    if (!/^[a-z][a-z0-9-]{0,49}$/.test(portrait)) {
        throw new Error('Neplatné ID obrázku.');
    }
    requireWritableCatalog(id, expectedRevision);
    const digest = hashBytes(bytes);
    inTransaction(db => reserveAssets(db, [{ digest, bytes: bytes.length, mime: 'image/webp' }]));
    await saveAsset(digest, bytes);
    return saveLocal(id, expectedRevision, next => {
        const path = `images/${portrait}.webp`;
        next.bundle.assets = next.bundle.assets.filter(a => a.path !== path);
        next.bundle.assets.push({ path, digest, bytes: bytes.length, mime: 'image/webp' });
    });
}
