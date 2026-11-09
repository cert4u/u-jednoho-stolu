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

  async function rollback(selected, history) {
    if (
      !(await dialog.confirm(
        'Vrátit tuto verzi katalogu? Kampaně zachovají své připnuté kopie.',
      ))
    )
      return;
    const id = selected.bundle.manifest.id;
    await api('rollback', {
      id,
      expectedRevision: state.selected.revision,
      historyId: history.id,
    });
    await reload();
    await open(id);
  }

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
    if (!state.preview || !(await canLeaveEditor())) {
      return;
    }
    const result = await api('install', { token: state.preview.token });
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
