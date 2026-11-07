// Library visibility, deletion and rollback preserve campaign/dependency guards.
import { readCatalogs, getCatalog, inTransaction, saveCatalog, assertRevision, deleteCatalog, getHistoryVersion } from './repository.mjs';
import { loadCatalogCore, validateLibrary } from './validation.mjs';
import { catalogUsage } from './usage.mjs';
export async function setCatalogEnabled(id, expectedRevision, enabled) {
    if (typeof enabled !== 'boolean') {
        throw new Error('Neplatný stav katalogu.');
    }
    const api = await loadCatalogCore();
    return inTransaction(db => {
        const previous = getCatalog(id);
        assertRevision(previous, expectedRevision);
        const next = { ...previous, enabled };
        validateLibrary(api, readCatalogs(db).map(c => c.bundle.manifest.id === id ? next : c));
        if (!enabled && catalogUsage(id).some(u => !u.preserved)) {
            throw new Error('Některá kampaň nemá zachované podklady. Katalog nelze zakázat.');
        }
        saveCatalog(db, next, previous);
        return { ok: true };
    });
}
export async function removeCatalog(id, expectedRevision, preserveCampaigns) {
    return inTransaction(db => {
        const c = getCatalog(id);
        assertRevision(c, expectedRevision);
        if (readCatalogs(db).some(other => other.bundle.manifest.dependencies.some(d => d.id === id))) {
            throw new Error('Na katalogu závisejí další katalogy.');
        }
        const usage = catalogUsage(id);
        if (usage.some(u => !u.preserved) || usage.length && !preserveCampaigns) {
            throw new Error('Potvrď zachování připnutých kopií v kampaních; neúplné podklady odstranění blokují.');
        }
        deleteCatalog(db, id);
        return { ok: true, preservedCampaigns: usage.length };
    });
}
export async function rollbackCatalog(id, expectedRevision, historyId) {
    const api = await loadCatalogCore();
    return inTransaction(db => {
        const previous = getCatalog(id);
        assertRevision(previous, expectedRevision);
        const history = getHistoryVersion(id, historyId);
        if (!history) {
            throw new Error('Bod návratu neexistuje.');
        }
        const next = { ...previous, bundle: JSON.parse(history.payload), digest: history.digest, source: history.source ? JSON.parse(history.source) : undefined };
        validateLibrary(api, readCatalogs(db).map(c => c.bundle.manifest.id === id ? next : c));
        saveCatalog(db, next, previous);
        return { ok: true };
    });
}
