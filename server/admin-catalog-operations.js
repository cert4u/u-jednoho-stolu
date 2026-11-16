// @ts-check

/** @typedef {ReturnType<import('./admin-catalog-api.js').createCatalogApi>} CatalogApi */
/** @typedef {import('./catalog-admin-contract').CatalogImportPreview} CatalogImportPreview */
/** @typedef {ReturnType<import('./admin-catalog-state.js').createCatalogState>} CatalogState */
/** @typedef {Awaited<ReturnType<typeof import('./catalogs/queries.mjs').listCatalogs>>[number]} CatalogSummary */
/** @typedef {Awaited<ReturnType<typeof import('./catalogs/queries.mjs').viewCatalog>>} CatalogDetail */

/**
 * @param {{
 *   state: Pick<CatalogState, 'selected' | 'preview'>,
 *   api: CatalogApi,
 *   dialog: {
 *     confirm: (message: string) => Promise<boolean>,
 *     ask: (options: {
 *       title: string,
 *       message: string,
 *       fields: Array<{
 *         name: string, label: string, type?: string, required?: boolean,
 *         value: string, readOnly?: boolean, maxLength: number,
 *       }>,
 *       submit: string,
 *     }) => Promise<Record<string, string> | null>,
 *   },
 *   canLeaveEditor: () => Promise<boolean>,
 *   reload: () => Promise<void>,
 *   open: (id: string, discardConfirmed?: boolean) => Promise<void>,
 *   message: (value: string) => void,
 *   showPreview: (result: CatalogImportPreview) => void,
 *   clearPreview: () => void,
 *   hideDetail: () => void,
 * }} dependencies
 */
export function createCatalogOperations({
  state,
  api,
  dialog,
  canLeaveEditor,
  reload,
  open,
  message,
  showPreview,
  clearPreview,
  hideDetail,
}) {
  /** @param {CatalogSummary} catalog */
  async function toggle(catalog) {
    if (
      catalog.enabled &&
      !(await dialog.confirm(
        `Zakázat katalog „${catalog.manifest.name}“ pro nové kampaně? Rozehrané kampaně zachovají své podklady.`,
      ))
    )
      return;
    await api('enable', {
      id: catalog.manifest.id,
      expectedRevision: catalog.revision,
      enabled: !catalog.enabled,
    });
    await reload();
  }

  /** @param {CatalogSummary} catalog */
  async function remove(catalog) {
    const { manifest, revision, usage } = catalog;
    if (
      !(await dialog.confirm(
        `Odebrat katalog „${manifest.name}“? ${usage.length ? 'Připnuté kopie zůstanou v ' + usage.length + ' kampaních.' : ''} Závislosti mohou odstranění blokovat.`,
      ))
    )
      return;
    await api('remove', {
      id: manifest.id,
      expectedRevision: revision,
      preserveCampaigns: true,
    });
    if (state.selected?.bundle.manifest.id === manifest.id) {
      state.selected = undefined;
      hideDetail();
    }
    await reload();
  }

  /** @param {CatalogDetail} selected @param {{id: number}} history */
  async function rollback(selected, history) {
    if (
      !(await dialog.confirm(
        'Vrátit tuto verzi katalogu? Kampaně zachovají své připnuté kopie.',
      ))
    )
      return;
    const id = selected.bundle.manifest.id;
    if (state.selected?.bundle.manifest.id !== id) return;
    await api('rollback', {
      id,
      expectedRevision: selected.revision,
      historyId: history.id,
    });
    await reload();
    await open(id);
  }

  /** @param {CatalogSummary} [catalog] @param {string} [initialRepository] */
  async function github(catalog, initialRepository) {
    const values = await dialog.ask({
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
    if (state.preview) await discard();
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

  async function install() {
    const preview = state.preview;
    if (!preview || !(await canLeaveEditor()) || preview !== state.preview) {
      return;
    }
    const result = await api('install', { token: preview.token });
    clearPreview();
    await reload();
    await open(result.id, true);
  }
  async function discard() {
    if (state.preview) {
      await api('discard', { token: state.preview.token });
    }
    clearPreview();
  }
  return { toggle, remove, rollback, github, install, discard };
}
