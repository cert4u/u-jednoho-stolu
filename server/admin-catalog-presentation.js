export function catalogEntryDescription(type, entry) {
  const environment = { castle: 'Hrad', mine: 'Důl', cave: 'Jeskyně' };
  const detail =
    type === 'bestiary'
      ? [
          entry.description,
          `Životy ${entry.maxHp}  ·  ÚČ ${entry.combat?.attack}  ·  OČ ${entry.combat?.defense}  ·  Útočnost ${entry.combat?.damage}`,
          entry.gmHint ? `Jak s ní hrát (pro PJ)\n${entry.gmHint}` : '',
        ]
      : type === 'scenery'
        ? [
            entry.surface
              ? 'Plošný materiál'
              : entry.category === 'floor'
                ? 'Podlahový detail'
                : 'Předmět',
            `Prostředí: ${(Array.isArray(entry.environments) ? entry.environments : []).map((e) => environment[e] ?? e).join(', ')}`,
            entry.automatic
              ? 'Lze zahrnout do náhodného rozmístění.'
              : 'Ruční umístění v mapě.',
          ]
        : type === 'dungeon-presets'
          ? [
              entry.description,
              `Patra: ${entry.options?.levels} · Místností na patro: ${entry.options?.rooms}`,
            ]
          : [
              entry.description ?? entry.summary ?? '',
              entry.gmNotes ? `Příprava pro PJ\n${entry.gmNotes}` : '',
            ];
  return detail.filter(Boolean).join('\n\n');
}

export function renderCatalogVisual(document, container, type, entry, bundle) {
  container.replaceChildren();
  if (type === 'scenery' && entry.path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    svg.setAttribute('width', '96');
    svg.setAttribute('height', '96');
    svg.setAttribute('aria-label', 'Náhled stafáže');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', entry.path);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', entry.surface?.color ?? '#65543f');
    path.setAttribute('stroke-width', '1.25');
    svg.append(path);
    container.append(svg);
  } else if (type === 'bestiary') {
    const portrait = entry.portrait ?? entry.id,
      asset = bundle.assets.find((a) => a.path === `images/${portrait}.webp`);
    const builtin =
      bundle.manifest.id === 'builtin'
        ? portrait
        : portrait.startsWith('builtin:')
          ? portrait.slice(8)
          : undefined;
    if (asset || builtin) {
      const image = document.createElement('img');
      image.alt = entry.name;
      image.width = 120;
      image.src = asset
        ? `/catalog-assets/${asset.digest}.webp`
        : `/monsters/${builtin}.webp`;
      container.append(image);
    }
  }
}

export function catalogEntryTemplate(type, area, builtinEntries) {
  let example;
  if (type === 'bestiary') {
    example = {
      id: 'nova-polozka',
      name: 'Nová příšera',
      description: 'Popiš vzhled příšery.',
      gmHint: 'Jak s ní má PJ hrát?',
      environments: ['caves'],
      maxHp: 6,
      combat: { attack: 1, defense: 1, damage: 0 },
    };
  } else if (type === 'dungeon-presets') {
    example = {
      ...structuredClone(builtinEntries[type][0]),
      label: 'Vlastní předloha',
      description: 'Popis prostředí a přípravy.',
      options: { ...builtinEntries[type][0].options, name: 'Vlastní podzemí' },
    };
  } else if (type === 'adventures') {
    example = {
      id: 'nova-polozka',
      title: 'Vlastní dobrodružství',
      scene: 'Začátek výpravy',
      summary: 'Krátká anotace pro družinu.',
      gmNotes: '',
      dungeonPreset: 'builtin:castle',
      rooms: [
        {
          floor: 1,
          role: 'entrance',
          title: 'Vchod',
          playerText: '',
          gmNotes: '',
          monsters: [],
        },
      ],
    };
  } else {
    example = {
      id: 'nova-polozka',
      name: area ? 'Nový materiál' : 'Nový prvek',
      category: area ? 'floor' : 'object',
      environments: ['castle', 'mine', 'cave'],
      automatic: false,
      path: area
        ? 'M4 16Q4 4 16 4Q28 4 28 16Q28 28 16 28Q4 28 4 16Z'
        : 'M4 4H28V28H4Z',
      ...(area
        ? { surface: { color: '#938571', texture: 'speckles', roughness: 0.5 } }
        : {}),
    };
  }
  example.id = area ? 'novy-material' : 'nova-polozka';
  return example;
}

export function catalogInstallSummary(result) {
  const labels = {
    bestiary: 'Příšery',
    'dungeon-presets': 'Předlohy jeskyní',
    adventures: 'Dobrodružství',
    scenery: 'Stafáž a materiály',
  };
  return [
    `${result.manifest.name} (${result.manifest.id})`,
    `${result.currentVersion ?? 'Nový katalog'} → ${result.manifest.version}`,
    `Autor: ${result.manifest.author} · Licence: ${result.manifest.license}`,
    `SHA-256: ${result.digest}`,
    result.currentDigest ? `Současný SHA-256: ${result.currentDigest}` : '',
    result.currentSource
      ? `Současný commit: ${result.currentSource.commit}`
      : '',
    result.source
      ? `${result.source.repository}\nCommit: ${result.source.commit}`
      : 'Import ze souboru',
    Object.entries(result.counts)
      .map(([k, v]) => `${labels[k]}: ${v}`)
      .join(' · '),
    `Přidáno: ${result.diff.added} · Změněno: ${result.diff.changed} · Odstraněno: ${result.diff.removed}`,
    ...Object.entries(result.items ?? {})
      .filter(([, items]) => items.length)
      .map(
        ([type, items]) =>
          `${{ added: 'Přidané položky', changed: 'Upravené položky', removed: 'Odstraněné položky' }[type]}: ${items.join(', ')}`,
      ),
    `Nové nebo změněné závislosti: ${(result.newDependencies ?? []).map((d) => `${d.id} >= ${d.minVersion}`).join(', ') || 'žádné'}`,
    `Závislosti: ${result.manifest.dependencies.map((d) => `${d.id} >= ${d.minVersion}`).join(', ') || 'žádné'}`,
    result.preservedCampaigns
      ? `${result.preservedCampaigns} kampaní zachová připnuté kopie. Aktualizace je nepřepíše.`
      : '',
    'Kompatibilita a obsah ověřeny. Knihovna se změní až potvrzením.',
  ]
    .filter(Boolean)
    .join('\n');
}
