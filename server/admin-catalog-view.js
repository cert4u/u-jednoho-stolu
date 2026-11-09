import { catalogInstallSummary } from './admin-catalog-presentation.js';
import { catalogPageSize } from './admin-catalog-state.js';

const date = (value) => (value ? new Date(value).toLocaleString('cs-CZ') : '—');
export function createCatalogView({ $, node, button }) {
  function controls({ selected, busy, valid, catalogPage }) {
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
    const count =
      selected?.bundle.entries[$('catalog-type').value]?.length ?? 0;
    $('catalog-prev').disabled = busy || catalogPage === 0;
    $('catalog-next').disabled =
      busy || (catalogPage + 1) * catalogPageSize >= count;
  }
  function renderList(catalogs, preview, actionsForCatalog) {
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
        { builtin: 'Výchozí', local: 'Vlastní', community: 'Komunitní' }[
          c.kind
        ],
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
      actions.append(
        button('Otevřít katalog', () => actionsForCatalog.open(m.id)),
      );
      if (c.kind !== 'builtin') {
        const download = node('a', 'Exportovat ZIP');
        download.href =
          '/admin/api/catalogs/export?' + new URLSearchParams({ id: m.id });
        actions.append(download);
        actions.append(
          button(c.enabled ? 'Zakázat' : 'Povolit', () =>
            actionsForCatalog.toggle(c),
          ),
        );
        if (c.source) {
          actions.append(
            button('Zkontrolovat aktualizace', () =>
              actionsForCatalog.github(c),
            ),
          );
        }
        actions.append(button('Odebrat', () => actionsForCatalog.remove(c)));
      }
      row.append(cell);
      table.append(row);
    }
    scroll.append(table);
    container.append(scroll);
  }
  function renderDetail(selected) {
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
  }
  function renderHistory(selected, rollback) {
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
            () => rollback(selected, h),
          ),
        );
    }
  }
  function renderItems({ entries, from, items, type, editing, onSelect }) {
    const list = $('catalog-items');
    list.replaceChildren();
    $('catalog-page').textContent = entries.length
      ? `${from + 1}–${Math.min(from + catalogPageSize, entries.length)} z ${entries.length}`
      : 'Žádné položky';
    $('catalog-pagination').hidden = entries.length <= catalogPageSize;
    for (const entry of items) {
      const item = button('', () => onSelect(type, entry));
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
  function renderEditor({
    selected,
    type,
    entry,
    originalId,
    onCopy,
    onDuplicate,
    onRemove,
  }) {
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
      actions.append(button('Vlastní kopie', () => onCopy(type, entry)));
      if (selected.kind === 'local') {
        actions.append(
          button('Duplikovat', () => onDuplicate(type, entry)),
          button('Odstranit', () => onRemove(type, entry)),
        );
      }
    }

    $('catalog-json').value = JSON.stringify(entry, null, 2);
    $('catalog-json').readOnly = selected.kind !== 'local';
    return $('catalog-json').value;
  }
  function renderCopy(targets, entry) {
    if (!targets.length) {
      return false;
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
    return true;
  }
  function renderInstallPreview(result) {
    $('catalog-install').textContent = result.currentVersion
      ? 'Aktualizovat katalog'
      : 'Potvrdit instalaci';
    $('catalog-preview').hidden = false;
    $('catalog-preview-text').textContent = catalogInstallSummary(result);
  }

  return {
    controls,
    renderList,
    renderDetail,
    renderHistory,
    renderItems,
    renderEditor,
    renderCopy,
    renderInstallPreview,
  };
}
