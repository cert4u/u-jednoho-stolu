import { readCatalogs, getCatalog, getCatalogHistory } from './repository.mjs';
import { loadCatalogCore } from './validation.mjs';
import { catalogUsage } from './usage.mjs';
import { packCatalog } from '../catalog-pack.mjs';
import { catalogFiles } from '../catalog-files.mjs';
export async function listCatalogs() {
    const { builtinCatalog } = await loadCatalogCore();
    return [builtinCatalog, ...readCatalogs()].map(c => ({ ...c, bundle: undefined, manifest: c.bundle.manifest, counts: Object.fromEntries(Object.entries(c.bundle.entries).map(([k, v]) => [k, v.length])), usage: c.kind === 'builtin' ? [] : catalogUsage(c.bundle.manifest.id) }));
}
export async function viewCatalog(id) {
    const c = id === 'builtin' ? (await loadCatalogCore()).builtinCatalog : getCatalog(id);
    return { ...c, usage: id === 'builtin' ? [] : catalogUsage(id), history: id === 'builtin' ? [] : getCatalogHistory(id) };
}
export async function exportCatalog(id) {
    if (id === 'builtin') {
        throw new Error('Zkopíruj vybrané položky do vlastního katalogu.');
    }
    return packCatalog(getCatalog(id).bundle, digest => catalogFiles.read(digest));
}
