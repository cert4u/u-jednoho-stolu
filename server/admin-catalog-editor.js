// @ts-check

import {
  catalogEntryDescription,
  renderCatalogVisual,
} from './admin-catalog-presentation.js';
import { hasCatalogDraft } from './admin-catalog-state.js';

/** @typedef {import('../lib/catalogs/model').CatalogType} CatalogType */
/** @typedef {import('./catalog-admin-contract').CatalogEditorEntry} CatalogEditorEntry */
/** @typedef {ReturnType<import('./admin-catalog-state.js').createCatalogState>} CatalogState */
/** @typedef {import('./catalog-admin-contract').CatalogEditorView} CatalogEditorView */
/** @typedef {(id: 'catalog-json') => HTMLTextAreaElement} FindTextarea */
/** @typedef {(id: 'catalog-json-details') => HTMLDetailsElement} FindDetails */
/** @typedef {(id: string) => HTMLElement} FindElement */

/**
 * @param {{
 *   $: FindTextarea & FindDetails & FindElement,
 *   state: Pick<CatalogState, 'selected' | 'editing' | 'editorBaseline' | 'valid' | 'validationRequest' | 'validationTimer'>,
 *   view: Pick<ReturnType<import('./admin-catalog-view.js').createCatalogView>, 'renderEditor'>,
 *   api: ReturnType<import('./admin-catalog-api.js').createCatalogApi>,
 *   confirmDiscard: (message: string) => Promise<boolean>,
 *   controls: () => void,
 *   renderItems: () => void,
 *   onCopy: CatalogEditorView['onCopy'],
 *   onRemove: CatalogEditorView['onRemove'],
 *   onSaved: (id: string) => Promise<void>,
 * }} options
 */
export function createCatalogEditor({
  $,
  state,
  view,
  api,
  confirmDiscard,
  controls,
  renderItems,
  onCopy,
  onRemove,
  onSaved,
}) {
  function isDirty() {
    return hasCatalogDraft(state, $('catalog-json').value);
  }
  async function canLeaveEditor() {
    return (
      !isDirty() ||
      (await confirmDiscard(
        'Máš neuložené změny položky. Opravdu je chceš zahodit?',
      ))
    );
  }
  function clearEditor() {
    state.validationRequest++;
    clearTimeout(state.validationTimer);
    state.editing = undefined;
    state.valid = false;
    state.editorBaseline = '';
    $('catalog-editor').hidden = true;
    $('catalog-editor-empty').hidden = false;
  }
  /** @param {BeforeUnloadEvent} event */
  function protectDraft(event) {
    if (isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  /**
   * @param {CatalogType} type
   * @param {CatalogEditorEntry} entry
   * @param {string} [originalId]
   */
  function edit(type, entry, originalId) {
    const selected = state.selected;
    if (!selected) return;
    state.editing = { type, originalId };
    state.editorBaseline = view.renderEditor({
      selected,
      type,
      entry,
      originalId,
      onCopy,
      onRemove,
      onDuplicate: async (type, entry) => {
        if (!(await canLeaveEditor()) || state.selected !== selected) return;
        const copy = structuredClone(entry);
        copy.id = copy.id.slice(0, 42) + '-kopie';
        edit(type, copy);
      },
    });
    renderItems();
    state.valid = false;
    void validate();
    controls();
  }
  /** @param {object} entry */
  function visualPreview(entry) {
    const { selected, editing } = state;
    if (!selected || !editing) return;
    renderCatalogVisual(
      document,
      $('catalog-visual-preview'),
      editing.type,
      entry,
      selected.bundle,
    );
  }
  async function validate() {
    const serial = ++state.validationRequest;
    clearTimeout(state.validationTimer);
    state.valid = false;
    controls();
    const { selected, editing } = state;
    if (!selected || !editing) return;
    /** @type {unknown} */
    let entry;
    try {
      entry = JSON.parse($('catalog-json').value);
    } catch (error) {
      $('catalog-validation').textContent =
        'Neplatný JSON: ' +
        (error instanceof Error ? error.message : String(error));
      return;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      $('catalog-validation').textContent = 'Zadej JSON objekt položky.';
      return;
    }
    $('catalog-entry-preview').textContent = catalogEntryDescription(
      editing.type,
      entry,
    );
    $('catalog-visual-preview').replaceChildren();
    if (selected.kind !== 'local') {
      visualPreview(entry);
      $('catalog-validation').textContent =
        'Originál je pouze pro čtení. Pro vlastní variantu použij Vlastní kopie.';
      return;
    }
    if (editing.type === 'manifest') {
      $('catalog-validation').textContent =
        'Syntaxe JSON je platná; metadata a závislosti ověří server při uložení.';
      state.valid = true;
      controls();
      return;
    }
    $('catalog-validation').textContent = 'Ověřuji schéma a odkazy…';
    state.validationTimer = setTimeout(async () => {
      try {
        await api('entry', {
          id: selected.bundle.manifest.id,
          expectedRevision: selected.revision,
          type: editing.type,
          originalId: editing.originalId,
          entry,
          validateOnly: true,
        });
        if (serial !== state.validationRequest) {
          return;
        }
        state.valid = true;
        visualPreview(entry);
        $('catalog-validation').textContent = 'Schéma i odkazy jsou platné.';
      } catch (error) {
        if (serial === state.validationRequest) {
          $('catalog-validation').textContent =
            error instanceof Error ? error.message : String(error);
        }
      }
      if (serial === state.validationRequest) {
        controls();
      }
    }, 350);
  }

  async function editManifest() {
    const selected = state.selected;
    if (
      selected?.kind !== 'local' ||
      !(await canLeaveEditor()) ||
      state.selected !== selected
    )
      return;
    state.editing = { type: 'manifest' };
    $('catalog-editor-empty').hidden = true;
    $('catalog-item-actions').replaceChildren();
    $('catalog-json-details').open = true;
    $('catalog-editor').hidden = false;
    $('catalog-json').readOnly = false;
    $('catalog-json').value = JSON.stringify(selected.bundle.manifest, null, 2);
    state.editorBaseline = $('catalog-json').value;
    $('catalog-editor-title').textContent = 'Metadata katalogu';
    $('catalog-editor-help').textContent =
      'Název lze změnit, ID musí zůstat stejné. Verze používá formát 1.0.0. Závislosti uvádějí id a minVersion.';
    void validate();
  }
  function canSave() {
    return (
      state.valid &&
      state.selected?.kind === 'local' &&
      state.editing !== undefined
    );
  }
  async function save() {
    const { selected, editing } = state;
    if (!selected || !editing || !canSave()) return;
    const id = selected.bundle.manifest.id;
    const submitted = $('catalog-json').value;
    /** @type {unknown} */
    const data = JSON.parse(submitted);
    if (editing.type === 'manifest') {
      await api('manifest', {
        id,
        expectedRevision: selected.revision,
        manifest: data,
      });
    } else {
      await api('entry', {
        id,
        expectedRevision: selected.revision,
        type: editing.type,
        originalId: editing.originalId,
        entry: data,
      });
    }
    if (state.selected !== selected || state.editing !== editing) return;
    state.editorBaseline = submitted;
    if (
      editing.type !== 'manifest' &&
      data &&
      typeof data === 'object' &&
      'id' in data &&
      typeof data.id === 'string'
    ) {
      editing.originalId = data.id;
    }
    await onSaved(id);
  }
  return {
    canLeaveEditor,
    clearEditor,
    protectDraft,
    edit,
    editManifest,
    validate,
    canSave,
    save,
  };
}
