import assert from 'node:assert/strict';
import {
  catalogEntryDescription,
  catalogEntryTemplate,
  catalogInstallSummary,
  renderCatalogVisual,
} from '../server/admin-catalog-presentation.js';
const entries = {
  'dungeon-presets': [
    {
      id: 'mine',
      label: 'Důl',
      description: 'Popis',
      options: { name: 'Důl', levels: 2, rooms: 5 },
    },
  ],
};
const original = structuredClone(entries);
const preset = catalogEntryTemplate('dungeon-presets', false, entries);
assert.equal(preset.id, 'nova-polozka');
assert.equal(preset.options.name, 'Vlastní podzemí');
preset.options.levels = 8;
assert.deepEqual(entries, original);
for (const [type, area] of [
  ['bestiary', false],
  ['adventures', false],
  ['scenery', false],
  ['scenery', true],
]) {
  const entry = catalogEntryTemplate(type, area, entries);
  assert.equal(entry.id, area ? 'novy-material' : 'nova-polozka');
  assert.equal(Boolean(entry.surface), area);
  assert(catalogEntryDescription(type, entry));
}
assert.match(
  catalogEntryDescription('scenery', {
    category: 'floor',
    environments: ['mine', 'custom'],
  }),
  /Důl, custom/,
);
assert(
  catalogEntryDescription('bestiary', {
    description: '<script>test</script>',
    combat: {},
  }).includes('<script>test</script>'),
  'Description is plain text, never HTML.',
);
const result = {
  manifest: {
    id: 'mine',
    name: 'Důl',
    version: '1.1.0',
    author: 'Autor',
    license: 'CC0',
    dependencies: [],
  },
  currentVersion: '1.0.0',
  digest: 'abc',
  source: { repository: 'https://github.com/example/mine', commit: '123' },
  counts: { bestiary: 3 },
  diff: { added: 1, changed: 1, removed: 1 },
  items: { removed: ['old-rat'] },
  preservedCampaigns: 2,
};
const summary = catalogInstallSummary(result);
assert(summary.includes('1.0.0 → 1.1.0'));
assert(summary.includes('old-rat'));
assert(summary.includes('2 kampaní zachová připnuté kopie'));
class Element {
  constructor() {
    this.children = [];
    this.attributes = {};
  }
  replaceChildren() {
    this.children = [];
  }
  append(...items) {
    this.children.push(...items);
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
}
const document = {
    createElement: () => new Element(),
    createElementNS: () => new Element(),
  },
  container = new Element();
renderCatalogVisual(
  document,
  container,
  'scenery',
  { path: 'M0 0H2', surface: { color: '#123456' } },
  {},
);
assert.equal(container.children[0].children[0].attributes.stroke, '#123456');
renderCatalogVisual(
  document,
  container,
  'bestiary',
  { id: 'rat', name: 'Krysa' },
  {
    manifest: { id: 'mine' },
    assets: [{ path: 'images/rat.webp', digest: 'abc' }],
  },
);
assert.equal(container.children[0].src, '/catalog-assets/abc.webp');
renderCatalogVisual(
  document,
  container,
  'bestiary',
  { id: 'rat', portrait: 'builtin:kobold', name: 'Krysa' },
  { manifest: { id: 'mine' }, assets: [] },
);
assert.equal(container.children[0].src, '/monsters/kobold.webp');
renderCatalogVisual(document, container, 'adventures', {}, {});
assert.equal(container.children.length, 0);
console.log(
  'PASS: catalog templates do not mutate defaults, all entry previews, update summaries and built-in/local portrait paths.',
);
