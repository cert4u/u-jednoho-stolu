// Shared Zod/core boundary; keeps Node storage out of the portable schemas.
export const loadCatalogCore = () => import('../../dist/catalog-core.mjs');
export function validateLibrary(core, all) {
    const everything = all.map(c => ({ ...c, enabled: true }));
    for (const c of all) {
        core.validateCatalog(c.bundle, everything);
    }
    for (const c of all.filter(c => c.enabled)) {
        core.validateCatalog(c.bundle, all);
    }
    const byId = new Map(all.map(c => [c.bundle.manifest.id, c]));
    const visit = (id, stack) => {
        if (stack.includes(id)) {
            throw new Error('Cyklická závislost katalogů.');
        }
        for (const dep of byId.get(id)?.bundle.manifest.dependencies ?? []) {
            visit(dep.id, [...stack, id]);
        }
    };
    for (const id of byId.keys()) {
        visit(id, []);
    }
}
