import {
  catalogEntryDescription,
  catalogEntryTemplate,
  catalogInstallSummary,
  renderCatalogVisual,
} from './admin-catalog-presentation.js';

const $ = (id) => document.getElementById(id);
let catalogs = [],
  selected,
  editing,
  preview,
  busy = false,
  valid = false,
  validationTimer,
  validationRequest = 0,
  copying,
  catalogPage = 0;
const catalogPageSize = 8;
let sessionGeneration = 0;
let editorBaseline = '',
  selectedType = $('catalog-type').value;
function isDirty() {
  return (
    selected?.kind === 'local' &&
    editing &&
    ((editing.type !== 'manifest' && !editing.originalId) ||
      $('catalog-json').value !== editorBaseline)
  );
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
  validationRequest++;
  clearTimeout(validationTimer);
  editing = undefined;
  valid = false;
  editorBaseline = '';
  $('catalog-editor').hidden = true;
  $('catalog-editor-empty').hidden = false;
}
window.addEventListener('beforeunload', (event) => {
  if (isDirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});
const date = (value) => (value ? new Date(value).toLocaleString('cs-CZ') : '—');
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
async function api(action, data, options = {}) {
  const generation = sessionGeneration;
  const response = await fetch(
    '/admin/api/catalogs' + (action ? '/' + action : ''),
    data === undefined
      ? options
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          ...options,
        },
  );
  const value = await response.json();
  if (generation !== sessionGeneration)
    throw new Error('Přihlášení se mezitím změnilo.');
  if (!response.ok) {
    throw new Error(
      value.error || 'Katalogovou operaci se nepodařilo dokončit.',
    );
  }
  return value;
}
function button(text, run, disabled = false) {
  const b = node('button', text);
  b.type = 'button';
  b.className = 'secondary';
  b.disabled = disabled;
  b.onclick = () => void perform(run);
  return b;
}
function controls() {
  for (const b of $('catalog-section').querySelectorAll(
    'button,input,select,textarea',
  ))
    b.disabled = busy;
  const readOnly = !selected || selected.kind !== 'local';
  for (const id of [
    'catalog-metadata',
    'catalog-entry-new',
    'catalog-entry-area',
    'catalog-image',
  ])
    $(id).disabled = busy || readOnly;
  $('catalog-save').disabled = busy || !valid || readOnly;
  $('catalog-save').hidden = readOnly;
  for (const id of [
    'catalog-metadata',
    'catalog-entry-new',
    'catalog-entry-area',
    'catalog-image-control',
  ])
    $(id).hidden = readOnly;
  const count = selected?.bundle.entries[$('catalog-type').value]?.length ?? 0;
  $('catalog-prev').disabled = busy || catalogPage === 0;
  $('catalog-next').disabled =
    busy || (catalogPage + 1) * catalogPageSize >= count;
}
async function perform(run) {
  if (busy) {
    return;
  }
  const generation = sessionGeneration;
  busy = true;
  message('');
  controls();
  try {
    await run();
  } catch (error) {
    if (generation === sessionGeneration) message(error.message);
  } finally {
    if (generation === sessionGeneration) {
      busy = false;
      controls();
    }
  }
}
async function reload() {
  catalogs = (await api('')).catalogs;
  renderList();
}
function renderList() {
  const container = $('catalog-list');
  container.replaceChildren();
  const scroll = node('div');
  scroll.className = 'catalog-scroll';
  const table = node('table');
  const head = node('tr');
  for (const label of [
    'Název',
    'Typ',
    'Verze',
    'Autor',
    'Obsah',
    'Stav',
    'Akce',
  ])
    head.append(node('th', label));
  table.append(head);
  for (const c of catalogs) {
    const row = node('tr'),
      m = c.manifest;
    for (const text of [
      m.name,
      { builtin: 'Výchozí', local: 'Vlastní', community: 'Komunitní' }[c.kind],
      m.version,
      m.author,
      Object.entries(c.counts)
        .map(
          ([k, v]) =>
            `${{ bestiary: 'Příšery', 'dungeon-presets': 'Jeskyně', adventures: 'Příběhy', scenery: 'Stafáž' }[k]}: ${v}`,
        )
        .join('\n'),
      preview?.manifest.id === m.id && preview.digest !== c.digest
        ? 'Změna připravená'
        : c.enabled
          ? 'Aktivní'
          : 'Zakázaný',
    ])
      row.append(node('td', text));
    if (c.source) {
      const source = node(
        'small',
        `${c.source.repository}\nAktualizace: ${date(c.updatedAt)}\nKontrola: ${date(c.checkedAt)}`,
      );
      row.firstChild.append(node('br'), source);
    }
    const cell = node('td'),
      actions = node('div');
    actions.className = 'actions';
    cell.append(actions);
    actions.append(button('Otevřít katalog', () => open(m.id)));
    if (c.kind !== 'builtin') {
      const download = node('a', 'Exportovat ZIP');
      download.href =
        '/admin/api/catalogs/export?' + new URLSearchParams({ id: m.id });
      actions.append(download);
      actions.append(
        button(c.enabled ? 'Zakázat' : 'Povolit', async () => {
          if (
            c.enabled &&
            !(await window.stulAdminDialog.confirm(
              `Zakázat katalog „${m.name}“ pro nové kampaně? Rozehrané kampaně zachovají své podklady.`,
            ))
          ) {
            return;
          }
          await api('enable', {
            id: m.id,
            expectedRevision: c.revision,
            enabled: !c.enabled,
          });
          await reload();
        }),
      );
      if (c.source) {
        actions.append(button('Zkontrolovat aktualizace', () => github(c)));
      }
      actions.append(
        button('Odebrat', async () => {
          if (
            !(await window.stulAdminDialog.confirm(
              `Odebrat katalog „${m.name}“? ${c.usage.length ? 'Připnuté kopie zůstanou v ' + c.usage.length + ' kampaních.' : ''} Závislosti mohou odstranění blokovat.`,
            ))
          ) {
            return;
          }
          await api('remove', {
            id: m.id,
            expectedRevision: c.revision,
            preserveCampaigns: true,
          });
          if (selected?.bundle.manifest.id === m.id) {
            selected = undefined;
            $('catalog-detail').hidden = true;
          }
          await reload();
        }),
      );
    }
    row.append(cell);
    table.append(row);
  }
  scroll.append(table);
  container.append(scroll);
  controls();
}
async function open(id, discardConfirmed = false) {
  if (!discardConfirmed && !(await canLeaveEditor())) {
    return;
  }
  selected = await api('view?' + new URLSearchParams({ id }));
  selectedType = $('catalog-type').value;
  catalogPage = 0;
  editing = undefined;
  valid = false;
  $('catalog-editor').hidden = true;
  $('catalog-copy').hidden = true;
  $('catalog-detail').hidden = false;
  const m = selected.bundle.manifest;
  $('catalog-detail-title').textContent = m.name;
  $('catalog-origin').textContent = [
    `${m.id} · ${m.version} · Autor: ${m.author}`,
    `Licence: ${m.license}`,
    selected.source
      ? `${selected.source.repository} · Commit: ${selected.source.commit}`
      : selected.kind === 'builtin'
        ? 'Součást aplikace · originál pouze pro čtení'
        : 'Vlastní obsah této instalace',
    selected.kind !== 'builtin'
      ? `Instalace: ${date(selected.installedAt)} · Aktualizace: ${date(selected.updatedAt)} · Kontrola: ${date(selected.checkedAt)}`
      : '',
    selected.kind !== 'builtin'
      ? `Použití: ${selected.usage.length} kampaní`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  if (selected.usage.some((u) => !u.preserved)) {
    $('catalog-origin').textContent +=
      '\nNěkteré kampaně nemají připnuté podklady; odebrání a aktualizace jsou blokované.';
  }
  renderItems();
  const first = selected.bundle.entries[$('catalog-type').value][0];
  if (first) {
    edit($('catalog-type').value, first, first.id);
  } else {
    $('catalog-editor-empty').hidden = false;
  }
  $('catalog-detail').scrollIntoView({ block: 'start' });
  const history = $('catalog-history');
  history.replaceChildren();
  if (selected.history.length) {
    const details = node('details'),
      summary = node('summary', 'Historie a body návratu');
    details.append(summary);
    history.append(details);
    for (const h of selected.history)
      details.append(
        button(
          `Vrátit předchozí verzi: ${date(h.saved_at)} · ${h.digest.slice(0, 12)}`,
          async () => {
            if (
              !(await window.stulAdminDialog.confirm(
                'Vrátit tuto verzi katalogu? Kampaně zachovají své připnuté kopie.',
              ))
            ) {
              return;
            }
            await api('rollback', {
              id: m.id,
              expectedRevision: selected.revision,
              historyId: h.id,
            });
            await reload();
            await open(m.id);
          },
        ),
      );
  }
  controls();
}
function renderItems() {
  const type = $('catalog-type').value,
    list = $('catalog-items'),
    entries = selected.bundle.entries[type];
  list.replaceChildren();
  catalogPage = Math.min(
    catalogPage,
    Math.max(0, Math.ceil(entries.length / catalogPageSize) - 1),
  );
  const from = catalogPage * catalogPageSize;
  $('catalog-page').textContent = entries.length
    ? `${from + 1}–${Math.min(from + catalogPageSize, entries.length)} z ${entries.length}`
    : 'Žádné položky';
  $('catalog-pagination').hidden = entries.length <= catalogPageSize;
  for (const entry of entries.slice(from, from + catalogPageSize)) {
    const item = button('', async () => {
      if (await canLeaveEditor()) {
        edit(type, entry, entry.id);
      }
    });
    item.className =
      'catalog-item' +
      (editing?.type === type && editing.originalId === entry.id
        ? ' is-selected'
        : '');
    item.append(
      node('strong', entry.name ?? entry.label ?? entry.title),
      node('small', entry.id),
    );
    list.append(item);
  }
  if (!list.childNodes.length) {
    list.append(node('p', 'Tento typ zatím neobsahuje žádné položky.'));
  }
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
  const id = selected.bundle.manifest.id;
  await api('entry', {
    id,
    expectedRevision: selected.revision,
    type,
    originalId: entry.id,
    remove: true,
  });
  await reload();
  await open(id, true);
}
function edit(type, entry, originalId) {
  editing = { type, originalId };
  $('catalog-editor-empty').hidden = true;
  $('catalog-json-details').open = selected.kind === 'local';
  $('catalog-editor').hidden = false;
  $('catalog-editor-title').textContent =
    entry.name ?? entry.label ?? entry.title ?? 'Nová položka';
  $('catalog-editor-help').textContent =
    selected.kind === 'local'
      ? 'Popis a náhled vycházejí z dat níže. ID existující položky zůstává stejné; pro novou variantu použij Duplikovat.'
      : 'Tuto předlohu lze prohlížet a zkopírovat do vlastního katalogu. Originál zůstane zachovaný.';
  const actions = $('catalog-item-actions');
  actions.replaceChildren();
  if (originalId) {
    actions.append(button('Vlastní kopie', () => showCopy(type, entry)));
    if (selected.kind === 'local') {
      actions.append(
        button('Duplikovat', async () => {
          if (!(await canLeaveEditor())) {
            return;
          }
          const copy = structuredClone(entry);
          copy.id = copy.id.slice(0, 42) + '-kopie';
          edit(type, copy);
        }),
        button('Odstranit', () => removeEntry(type, entry)),
      );
    }
  }
  renderItems();
  $('catalog-json').value = JSON.stringify(entry, null, 2);
  editorBaseline = $('catalog-json').value;
  $('catalog-json').readOnly = selected.kind !== 'local';
  valid = false;
  void validate();
  controls();
}
function visualPreview(entry) {
  renderCatalogVisual(
    document,
    $('catalog-visual-preview'),
    editing.type,
    entry,
    selected.bundle,
  );
}
async function validate() {
  const serial = ++validationRequest;
  clearTimeout(validationTimer);
  valid = false;
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
    valid = true;
    controls();
    return;
  }
  $('catalog-validation').textContent = 'Ověřuji schéma a odkazy…';
  validationTimer = setTimeout(async () => {
    try {
      await api('entry', {
        id: selected.bundle.manifest.id,
        expectedRevision: selected.revision,
        type: editing.type,
        originalId: editing.originalId,
        entry,
        validateOnly: true,
      });
      if (serial !== validationRequest) {
        return;
      }
      valid = true;
      visualPreview(entry);
      $('catalog-validation').textContent = 'Schéma i odkazy jsou platné.';
    } catch (error) {
      if (serial === validationRequest) {
        $('catalog-validation').textContent = error.message;
      }
    }
    if (serial === validationRequest) {
      controls();
    }
  }, 350);
}
async function newEntry(area = false) {
  if (!selected || selected.kind !== 'local' || !(await canLeaveEditor())) {
    return;
  }
  const built = await api('view?id=builtin'),
    type = area ? 'scenery' : $('catalog-type').value;
  const example = catalogEntryTemplate(type, area, built.bundle.entries);
  $('catalog-type').value = selectedType = type;
  edit(type, example);
}
function showCopy(type, entry) {
  copying = { sourceId: selected.bundle.manifest.id, type, itemId: entry.id };
  const targets = catalogs.filter((c) => c.kind === 'local');
  if (!targets.length) {
    message('Nejdřív vytvoř vlastní katalog.');
    return;
  }
  $('catalog-copy').hidden = false;
  $('catalog-copy-target').replaceChildren(
    ...targets.map((c) => {
      const option = node('option', c.manifest.name);
      option.value = c.manifest.id;
      return option;
    }),
  );
  $('catalog-copy-id').value = entry.id.slice(0, 42) + '-kopie';
}
function showPreview(result) {
  if (result.upToDate) {
    preview = undefined;
    $('catalog-preview').hidden = true;
    message(
      `Katalog „${result.manifest.name}“ je aktuální. Ověřený obsah odpovídá nainstalované verzi; žádná instalace není potřeba. Commit zdroje: ${result.source.commit}`,
    );
    renderList();
    return;
  }
  preview = result;
  $('catalog-install').textContent = result.currentVersion
    ? 'Aktualizovat katalog'
    : 'Potvrdit instalaci';
  $('catalog-preview').hidden = false;
  $('catalog-preview-text').textContent = catalogInstallSummary(result);
  renderList();
}
async function github(catalog, initialRepository) {
  const values = await window.stulAdminDialog.ask({
    title: catalog
      ? 'Zkontrolovat aktualizace katalogu'
      : 'Přidat katalog z GitHubu',
    message:
      'Zadej veřejný repozitář a případně tag nebo revizi. Nejdřív se zobrazí náhled; instalaci potvrdíš samostatně.',
    fields: [
      {
        name: 'repository',
        label: 'Veřejný GitHub repozitář',
        type: 'url',
        required: true,
        value: catalog?.source?.repository ?? initialRepository ?? '',
        readOnly: Boolean(catalog),
        maxLength: 250,
      },
      {
        name: 'ref',
        label: 'Revize nebo tag (prázdné = HEAD)',
        value: 'HEAD',
        maxLength: 100,
      },
    ],
    submit: 'Připravit náhled',
  });
  if (!values) {
    return;
  }
  const repository = values.repository.trim(),
    ref = values.ref.trim() || 'HEAD';
  if (preview) {
    await api('discard', { token: preview.token });
    preview = undefined;
    $('catalog-preview').hidden = true;
  }
  message('Stahuji a ověřuji katalog…');
  const result = await api('github', {
    repository,
    ref: ref || 'HEAD',
    ...(catalog ? { updateId: catalog.manifest.id } : {}),
  });
  await reload();
  message('');
  showPreview(result);
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
    const builtin = catalogs.find((c) => c.kind === 'builtin').manifest,
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
  const previous = selectedType,
    type = $('catalog-type').value;
  if (busy) {
    $('catalog-type').value = previous;
    return;
  }
  void perform(async () => {
    if (!selected) {
      return;
    }
    if (!(await canLeaveEditor())) {
      $('catalog-type').value = previous;
      return;
    }
    selectedType = type;
    catalogPage = 0;
    clearEditor();
    const first = selected.bundle.entries[type][0];
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
    selected = undefined;
    $('catalog-detail').hidden = true;
  });
$('catalog-metadata').onclick = () =>
  void perform(async () => {
    if (!(await canLeaveEditor())) {
      return;
    }
    editing = { type: 'manifest' };
    $('catalog-editor-empty').hidden = true;
    $('catalog-item-actions').replaceChildren();
    $('catalog-json-details').open = true;
    $('catalog-editor').hidden = false;
    $('catalog-json').readOnly = false;
    $('catalog-json').value = JSON.stringify(selected.bundle.manifest, null, 2);
    editorBaseline = $('catalog-json').value;
    $('catalog-editor-title').textContent = 'Metadata katalogu';
    $('catalog-editor-help').textContent =
      'Název lze změnit, ID musí zůstat stejné. Verze používá formát 1.0.0. Závislosti uvádějí id a minVersion.';
    void validate();
  });
$('catalog-json').oninput = () => void validate();
$('catalog-editor-cancel').onclick = () =>
  void perform(async () => {
    if (!(await canLeaveEditor())) {
      return;
    }
    clearEditor();
    renderItems();
  });
$('catalog-editor').onsubmit = (e) => {
  e.preventDefault();
  if (!valid || selected.kind !== 'local') {
    return;
  }
  void perform(async () => {
    const id = selected.bundle.manifest.id,
      data = JSON.parse($('catalog-json').value);
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
    editorBaseline = $('catalog-json').value;
    if (editing.type !== 'manifest') {
      editing.originalId = data.id;
    }
    await reload();
    await open(id, true);
  });
};
$('catalog-copy').onsubmit = (e) => {
  e.preventDefault();
  void perform(async () => {
    const targetId = $('catalog-copy-target').value,
      target = catalogs.find((c) => c.manifest.id === targetId);
    await api('copy', {
      ...copying,
      targetId,
      newId: $('catalog-copy-id').value,
      expectedRevision: target.revision,
    });
    await reload();
    await open(targetId);
  });
};
$('catalog-prev').onclick = () => {
  if (catalogPage > 0) {
    catalogPage--;
    renderItems();
    controls();
  }
};
$('catalog-next').onclick = () => {
  catalogPage++;
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
$('catalog-install').onclick = () =>
  void perform(async () => {
    if (!preview || !(await canLeaveEditor())) {
      return;
    }
    const result = await api('install', { token: preview.token });
    preview = undefined;
    $('catalog-preview').hidden = true;
    await reload();
    await open(result.id, true);
  });
$('catalog-discard').onclick = () =>
  void perform(async () => {
    if (preview) {
      await api('discard', { token: preview.token });
    }
    preview = undefined;
    $('catalog-preview').hidden = true;
  });
$('catalog-image').onchange = (e) =>
  void perform(async () => {
    const file = e.target.files[0];
    if (!file || selected?.kind !== 'local' || !(await canLeaveEditor())) {
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
    const id = selected.bundle.manifest.id;
    await api(
      'image?' +
        new URLSearchParams({
          id,
          revision: String(selected.revision),
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
$('catalog-github').onclick = () => void perform(() => github());
$('catalog-recommend').onclick = () =>
  void perform(async () => {
    const result = await api('recommend', {});
    const list = $('catalog-recommendations');
    list.replaceChildren();
    for (const c of result.catalogs)
      list.append(
        node('p', `${c.name} · ${c.author}`),
        button('Připravit instalaci', () => github(undefined, c.repository)),
      );
    if (!result.catalogs.length) {
      message(
        'Doporučený seznam zatím neobsahuje katalogy. Vlastní adresu lze zadat tlačítkem Přidat z GitHubu.',
      );
    }
  });
window.addEventListener('stul-admin-session', () => {
  sessionGeneration++;
  busy = false;
  void perform(reload);
});
window.addEventListener('stul-admin-logout', () => {
  sessionGeneration++;
  busy = false;
  clearEditor();
  selected = preview = editing = undefined;
  catalogs = [];
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
