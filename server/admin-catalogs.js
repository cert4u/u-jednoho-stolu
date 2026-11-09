import { catalogEntryTemplate } from './admin-catalog-presentation.js';
import { createCatalogState, catalogItemPage } from './admin-catalog-state.js';
import { createCatalogView } from './admin-catalog-view.js';
import { createCatalogEditor } from './admin-catalog-editor.js';
import { createCatalogApi } from './admin-catalog-api.js';
import { createCatalogOperations } from './admin-catalog-operations.js';

const $ = (id) => document.getElementById(id);
const state = createCatalogState($('catalog-type').value);
const message = (value) => {
  $('catalog-message').textContent = value;
};
const node = (tag, text) => {
  const e = document.createElement(tag);
  if (text !== undefined) {
    e.textContent = text;
  }
  return e;
};
function button(text, run, disabled = false) {
  const b = node('button', text);
  b.type = 'button';
  b.className = 'secondary';
  b.disabled = disabled;
  b.onclick = () => void perform(run);
  return b;
}
const view = createCatalogView({ $, node, button });
const api = createCatalogApi(() => state.sessionGeneration);
const controls = () => view.controls(state);
const editor = createCatalogEditor({
  $,
  state,
  view,
  api,
  controls,
  renderItems,
  onCopy: showCopy,
  onRemove: removeEntry,
  onSaved: async (id) => {
    await reload();
    await open(id, true);
  },
});
const { canLeaveEditor, clearEditor, edit } = editor;
window.addEventListener('beforeunload', editor.protectDraft);

const operations = createCatalogOperations({
  state,
  api,
  dialog: window.stulAdminDialog,
  canLeaveEditor,
  reload,
  open,
  message,
  showPreview,
  clearPreview,
  hideDetail: () => {
    clearEditor();
    $('catalog-detail').hidden = true;
  },
});
async function perform(run) {
  if (state.busy) {
    return;
  }
  const generation = state.sessionGeneration;
  state.busy = true;
  message('');
  controls();
  try {
    await run();
  } catch (error) {
    if (generation === state.sessionGeneration) message(error.message);
  } finally {
    if (generation === state.sessionGeneration) {
      state.busy = false;
      controls();
    }
  }
}
async function reload() {
  state.catalogs = (await api('')).catalogs;
  renderList();
}
function renderList() {
  view.renderList(state.catalogs, state.preview, { ...operations, open });
  controls();
}
async function open(id, discardConfirmed = false) {
  if (!discardConfirmed && !(await canLeaveEditor())) {
    return;
  }
  state.selected = await api('view?' + new URLSearchParams({ id }));
  state.selectedType = $('catalog-type').value;
  state.catalogPage = 0;
  clearEditor();
  $('catalog-copy').hidden = true;
  $('catalog-detail').hidden = false;
  view.renderDetail(state.selected);
  renderItems();
  const first = state.selected.bundle.entries[$('catalog-type').value][0];
  if (first) {
    edit($('catalog-type').value, first, first.id);
  } else {
    $('catalog-editor-empty').hidden = false;
  }
  $('catalog-detail').scrollIntoView({ block: 'start' });
  view.renderHistory(state.selected, operations.rollback);
  controls();
}
function renderItems() {
  const type = $('catalog-type').value;
  const entries = state.selected.bundle.entries[type];
  const { page, from, items } = catalogItemPage(entries, state.catalogPage);
  state.catalogPage = page;
  view.renderItems({
    entries,
    from,
    items,
    type,
    editing: state.editing,
    onSelect: async (type, entry) => {
      if (await canLeaveEditor()) edit(type, entry, entry.id);
    },
  });
}
async function removeEntry(type, entry) {
  if (!(await canLeaveEditor())) {
    return;
  }
  if (
    !(await window.stulAdminDialog.confirm(
      'Odstranit nepoužitou položku? Odkazy mohou odstranění blokovat.',
    ))
  ) {
    return;
  }
  const id = state.selected.bundle.manifest.id;
  await api('entry', {
    id,
    expectedRevision: state.selected.revision,
    type,
    originalId: entry.id,
    remove: true,
  });
  await reload();
  await open(id, true);
}
async function newEntry(area = false) {
  if (
    !state.selected ||
    state.selected.kind !== 'local' ||
    !(await canLeaveEditor())
  ) {
    return;
  }
  const built = await api('view?id=builtin'),
    type = area ? 'scenery' : $('catalog-type').value;
  const example = catalogEntryTemplate(type, area, built.bundle.entries);
  $('catalog-type').value = state.selectedType = type;
  edit(type, example);
}
function showCopy(type, entry) {
  state.copying = {
    sourceId: state.selected.bundle.manifest.id,
    type,
    itemId: entry.id,
  };
  if (
    !view.renderCopy(
      state.catalogs.filter((c) => c.kind === 'local'),
      entry,
    )
  )
    message('Nejdřív vytvoř vlastní katalog.');
}
function clearPreview() {
  state.preview = undefined;
  $('catalog-preview').hidden = true;
}
function showPreview(result) {
  if (result.upToDate) {
    clearPreview();
    message(
      `Katalog „${result.manifest.name}“ je aktuální. Ověřený obsah odpovídá nainstalované verzi; žádná instalace není potřeba. Commit zdroje: ${result.source.commit}`,
    );
  } else {
    state.preview = result;
    view.renderInstallPreview(result);
  }
  renderList();
}
$('catalog-new').onclick = () => {
  $('catalog-create').hidden = false;
};
$('catalog-create-cancel').onclick = () => {
  $('catalog-create').hidden = true;
};
$('catalog-create').onsubmit = (e) => {
  e.preventDefault();
  void perform(async () => {
    const builtin = state.catalogs.find((c) => c.kind === 'builtin').manifest,
      manifest = {
        schemaVersion: 1,
        id: $('catalog-id').value,
        name: $('catalog-name').value,
        version: '1.0.0',
        author: $('catalog-author').value,
        license: $('catalog-license').value,
        description: '',
        minAppVersion: builtin.version,
        dependencies: [{ id: 'builtin', minVersion: builtin.version }],
        fileLicenses: {},
      };
    await api('create', { manifest });
    $('catalog-create').hidden = true;
    e.target.reset();
    await reload();
    await open(manifest.id);
  });
};
$('catalog-reload').onclick = () => void perform(reload);
$('catalog-type').onchange = () => {
  const previous = state.selectedType,
    type = $('catalog-type').value;
  if (state.busy) {
    $('catalog-type').value = previous;
    return;
  }
  void perform(async () => {
    if (!state.selected) {
      return;
    }
    if (!(await canLeaveEditor())) {
      $('catalog-type').value = previous;
      return;
    }
    state.selectedType = type;
    state.catalogPage = 0;
    clearEditor();
    const first = state.selected.bundle.entries[type][0];
    if (first) {
      edit(type, first, first.id);
    }
    renderItems();
  });
};
$('catalog-entry-new').onclick = () => void perform(() => newEntry());
$('catalog-entry-area').onclick = () => void perform(() => newEntry(true));
$('catalog-close').onclick = () =>
  void perform(async () => {
    if (!(await canLeaveEditor())) {
      return;
    }
    clearEditor();
    state.selected = undefined;
    $('catalog-detail').hidden = true;
  });
$('catalog-metadata').onclick = () => void perform(editor.editManifest);
$('catalog-json').oninput = () => void editor.validate();
$('catalog-editor-cancel').onclick = () =>
  void perform(async () => {
    if (!(await canLeaveEditor())) {
      return;
    }
    clearEditor();
    renderItems();
  });
$('catalog-editor').onsubmit = (event) => {
  event.preventDefault();
  if (editor.canSave()) void perform(editor.save);
};
$('catalog-copy').onsubmit = (e) => {
  e.preventDefault();
  void perform(async () => {
    const targetId = $('catalog-copy-target').value,
      target = state.catalogs.find((c) => c.manifest.id === targetId);
    await api('copy', {
      ...state.copying,
      targetId,
      newId: $('catalog-copy-id').value,
      expectedRevision: target.revision,
    });
    await reload();
    await open(targetId);
  });
};
$('catalog-prev').onclick = () => {
  if (state.catalogPage > 0) {
    state.catalogPage--;
    renderItems();
    controls();
  }
};
$('catalog-next').onclick = () => {
  state.catalogPage++;
  renderItems();
  controls();
};
$('catalog-import-button').onclick = () => $('catalog-import').click();
$('catalog-import').onchange = (e) =>
  void perform(async () => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    if (file.size > 40000000) {
      throw new Error('ZIP má nejvýše 40 MB.');
    }
    showPreview(
      await api('preview', undefined, {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: file,
      }),
    );
    e.target.value = '';
  });
$('catalog-install').onclick = () => void perform(operations.install);
$('catalog-discard').onclick = () => void perform(operations.discard);
$('catalog-image').onchange = (e) =>
  void perform(async () => {
    const file = e.target.files[0];
    if (
      !file ||
      state.selected?.kind !== 'local' ||
      !(await canLeaveEditor())
    ) {
      return;
    }
    const values = await window.stulAdminDialog.ask({
      title: 'Přidat WebP obrázek',
      message:
        'Zadej ID obrázku bez přípony. Toto ID pak použij v poli portrait.',
      fields: [
        {
          name: 'portrait',
          label: 'ID obrázku',
          required: true,
          pattern: '[a-z][a-z0-9-]{0,49}',
          maxLength: 50,
          value: file.name.replace(/\.webp$/i, ''),
        },
      ],
      submit: 'Nahrát obrázek',
    });
    if (!values) {
      e.target.value = '';
      return;
    }
    const portrait = values.portrait;
    const id = state.selected.bundle.manifest.id;
    await api(
      'image?' +
        new URLSearchParams({
          id,
          revision: String(state.selected.revision),
          portrait,
        }),
      undefined,
      { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: file },
    );
    e.target.value = '';
    await reload();
    await open(id, true);
    message(`Obrázek uložen. V příšeře nastav portrait: "${portrait}".`);
  });
$('catalog-github').onclick = () => void perform(operations.github);
$('catalog-recommend').onclick = () =>
  void perform(async () => {
    const result = await api('recommend', {});
    const list = $('catalog-recommendations');
    list.replaceChildren();
    for (const c of result.catalogs)
      list.append(
        node('p', `${c.name} · ${c.author}`),
        button('Připravit instalaci', () =>
          operations.github(undefined, c.repository),
        ),
      );
    if (!result.catalogs.length) {
      message(
        'Doporučený seznam zatím neobsahuje katalogy. Vlastní adresu lze zadat tlačítkem Přidat z GitHubu.',
      );
    }
  });
window.addEventListener('stul-admin-session', () => {
  state.sessionGeneration++;
  state.busy = false;
  void perform(reload);
});
window.addEventListener('stul-admin-logout', () => {
  state.sessionGeneration++;
  state.busy = false;
  clearEditor();
  state.selected = state.preview = state.editing = undefined;
  state.catalogs = [];
  $('catalog-list').replaceChildren();
  $('catalog-editor').hidden =
    $('catalog-detail').hidden =
    $('catalog-preview').hidden =
      true;
  $('catalog-json').value = '';
});
if (!$('panel').hidden) {
  void perform(reload);
}
