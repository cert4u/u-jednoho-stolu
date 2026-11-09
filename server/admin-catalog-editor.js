import {
  catalogEntryDescription,
  renderCatalogVisual,
} from './admin-catalog-presentation.js';
import { hasCatalogDraft } from './admin-catalog-state.js';

export function createCatalogEditor({
  $,
  state,
  view,
  api,
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
      (await window.stulAdminDialog.confirm(
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
  function protectDraft(event) {
    if (isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  function edit(type, entry, originalId) {
    state.editing = { type, originalId };
    state.editorBaseline = view.renderEditor({
      selected: state.selected,
      type,
      entry,
      originalId,
      onCopy,
      onRemove,
      onDuplicate: async (type, entry) => {
        if (!(await canLeaveEditor())) return;
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
  function visualPreview(entry) {
    renderCatalogVisual(
      document,
      $('catalog-visual-preview'),
      state.editing.type,
      entry,
      state.selected.bundle,
    );
  }
  async function validate() {
    const serial = ++state.validationRequest;
    clearTimeout(state.validationTimer);
    state.valid = false;
    controls();
    let entry;
    try {
      entry = JSON.parse($('catalog-json').value);
    } catch (error) {
      $('catalog-validation').textContent = 'Neplatný JSON: ' + error.message;
      return;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      $('catalog-validation').textContent = 'Zadej JSON objekt položky.';
      return;
    }
    $('catalog-entry-preview').textContent = catalogEntryDescription(
      state.editing.type,
      entry,
    );
    $('catalog-visual-preview').replaceChildren();
    if (state.selected.kind !== 'local') {
      visualPreview(entry);
      $('catalog-validation').textContent =
        'Originál je pouze pro čtení. Pro vlastní variantu použij Vlastní kopie.';
      return;
    }
    if (state.editing.type === 'manifest') {
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
          id: state.selected.bundle.manifest.id,
          expectedRevision: state.selected.revision,
          type: state.editing.type,
          originalId: state.editing.originalId,
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
          $('catalog-validation').textContent = error.message;
        }
      }
      if (serial === state.validationRequest) {
        controls();
      }
    }, 350);
  }

  async function editManifest() {
    if (!(await canLeaveEditor())) return;
    state.editing = { type: 'manifest' };
    $('catalog-editor-empty').hidden = true;
    $('catalog-item-actions').replaceChildren();
    $('catalog-json-details').open = true;
    $('catalog-editor').hidden = false;
    $('catalog-json').readOnly = false;
    $('catalog-json').value = JSON.stringify(
      state.selected.bundle.manifest,
      null,
      2,
    );
    state.editorBaseline = $('catalog-json').value;
    $('catalog-editor-title').textContent = 'Metadata katalogu';
    $('catalog-editor-help').textContent =
      'Název lze změnit, ID musí zůstat stejné. Verze používá formát 1.0.0. Závislosti uvádějí id a minVersion.';
    void validate();
  }
  function canSave() {
    return state.valid && state.selected?.kind === 'local';
  }
  async function save() {
    const id = state.selected.bundle.manifest.id,
      data = JSON.parse($('catalog-json').value);
    if (state.editing.type === 'manifest') {
      await api('manifest', {
        id,
        expectedRevision: state.selected.revision,
        manifest: data,
      });
    } else {
      await api('entry', {
        id,
        expectedRevision: state.selected.revision,
        type: state.editing.type,
        originalId: state.editing.originalId,
        entry: data,
      });
    }
    state.editorBaseline = $('catalog-json').value;
    if (state.editing.type !== 'manifest') {
      state.editing.originalId = data.id;
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
