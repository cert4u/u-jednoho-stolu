// @ts-check

export const catalogPageSize = 8;

/** @param {import('../lib/catalogs/model').CatalogType} selectedType */
export function createCatalogState(selectedType) {
  return {
    catalogs:
      /** @type {import('./catalog-admin-contract').CatalogResponses['']['catalogs']} */ ([]),
    selected:
      /** @type {Awaited<ReturnType<typeof import('./catalogs/queries.mjs').viewCatalog>> | undefined} */ (
        undefined
      ),
    editing:
      /** @type {import('./catalog-admin-contract').CatalogEditing | undefined} */ (
        undefined
      ),
    preview:
      /** @type {Extract<import('./catalog-admin-contract').CatalogImportPreview, { upToDate: false }> | undefined} */ (
        undefined
      ),
    busy: false,
    valid: false,
    validationTimer: /** @type {ReturnType<typeof setTimeout> | undefined} */ (
      undefined
    ),
    validationRequest: 0,
    copying:
      /** @type {Pick<import('./catalog-admin-contract').CatalogRequests['copy'], 'sourceId' | 'type' | 'itemId'> | undefined} */ (
        undefined
      ),
    catalogPage: 0,
    sessionGeneration: 0,
    editorBaseline: '',
    selectedType,
  };
}

/**
 * @param {Pick<ReturnType<typeof createCatalogState>, 'selected' | 'editing' | 'editorBaseline'>} state
 * @param {string} value
 */
export function hasCatalogDraft({ selected, editing, editorBaseline }, value) {
  return (
    selected?.kind === 'local' &&
    editing &&
    ((editing.type !== 'manifest' && !editing.originalId) ||
      value !== editorBaseline)
  );
}

/**
 * @template T
 * @param {T[]} entries
 * @param {number} requestedPage
 */
export function catalogItemPage(entries, requestedPage) {
  const page = Math.min(
    requestedPage,
    Math.max(0, Math.ceil(entries.length / catalogPageSize) - 1),
  );
  const from = page * catalogPageSize;
  return { page, from, items: entries.slice(from, from + catalogPageSize) };
}
