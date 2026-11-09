export const catalogPageSize = 8;

export function createCatalogState(selectedType) {
  return {
    catalogs: [],
    selected: undefined,
    editing: undefined,
    preview: undefined,
    busy: false,
    valid: false,
    validationTimer: undefined,
    validationRequest: 0,
    copying: undefined,
    catalogPage: 0,
    sessionGeneration: 0,
    editorBaseline: '',
    selectedType,
  };
}

export function hasCatalogDraft({ selected, editing, editorBaseline }, value) {
  return (
    selected?.kind === 'local' &&
    editing &&
    ((editing.type !== 'manifest' && !editing.originalId) ||
      value !== editorBaseline)
  );
}

export function catalogItemPage(entries, requestedPage) {
  const page = Math.min(
    requestedPage,
    Math.max(0, Math.ceil(entries.length / catalogPageSize) - 1),
  );
  const from = page * catalogPageSize;
  return { page, from, items: entries.slice(from, from + catalogPageSize) };
}
