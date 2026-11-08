import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as presentation from '../server/admin-catalog-presentation.js';
// Execute the actual administrator controller against a minimal DOM. Browser smoke remains separate.
const elements = new Map();
class Element {
  constructor() {
    this.value = '';
    this.hidden = false;
    this.childNodes = [];
    this.disabled = false;
    this.textContent = '';
  }
  append(...children) {
    this.childNodes.push(...children);
    this.firstChild = this.childNodes[0];
  }
  replaceChildren(...children) {
    this.childNodes = [];
    this.append(...children);
  }
  querySelectorAll() {
    return [];
  }
  scrollIntoView() {}
  setAttribute() {}
}
const el = (id) => {
  if (!elements.has(id)) elements.set(id, new Element());
  return elements.get(id);
};
el('catalog-type').value = 'bestiary';
el('panel').hidden = true;
const entries = {
  bestiary: Array.from({ length: 10 }, (_, i) => ({
    id: 'monster-' + i,
    name: 'Příšera ' + i,
    description: 'Test',
    maxHp: 4,
    combat: { attack: 1, defense: 1, damage: 0 },
  })),
  scenery: [
    { id: 'rubble', name: 'Suť', category: 'floor', environments: ['mine'] },
  ],
  'dungeon-presets': [],
  adventures: [],
};
const selected = {
  kind: 'local',
  revision: 1,
  usage: [],
  history: [],
  bundle: {
    manifest: {
      id: 'local-test',
      name: 'Test',
      version: '1.0.0',
      author: 'QA',
      license: 'MIT',
    },
    entries,
    assets: [],
  },
};
let confirmations = [],
  slow,
  requests = 0,
  installs = 0;
const listeners = new Map();
const context = vm.createContext({
  document: {
    getElementById: el,
    createElement: () => new Element(),
    createElementNS: () => new Element(),
  },
  window: {
    addEventListener(name, fn) {
      listeners.set(name, fn);
    },
    stulAdminDialog: { confirm: async () => confirmations.shift() ?? false },
  },
  structuredClone,
  console,
  URLSearchParams,
  clearTimeout,
  setTimeout,
  fetch: async (url, options) => {
    requests++;
    if (slow) await slow;
    let value = selected;
    if (url === '/admin/api/catalogs')
      value = {
        catalogs: [
          {
            ...selected,
            manifest: selected.bundle.manifest,
            counts: Object.fromEntries(
              Object.entries(entries).map(([k, v]) => [k, v.length]),
            ),
            enabled: true,
          },
        ],
      };
    if (url.endsWith('/preview'))
      value = {
        token: 'preview-token',
        manifest: { ...selected.bundle.manifest, dependencies: [] },
        digest: 'a'.repeat(64),
        counts: { bestiary: 1 },
        diff: { added: 1, changed: 0, removed: 0 },
      };
    if (url.endsWith('/install')) {
      installs++;
      value = { id: 'local-test' };
    }
    if (url.endsWith('/entry')) {
      const data = JSON.parse(options.body);
      value = {};
      if (!data.validateOnly) {
        const list = entries[data.type],
          index = list.findIndex((e) => e.id === data.originalId);
        if (index < 0) list.push(data.entry);
        else list[index] = data.entry;
      }
    }
    return { ok: true, json: async () => structuredClone(value) };
  },
});
// Transpile only ESM syntax; run the actual controller and imported production helpers.
context.exports = {};
context.require = (specifier) => {
  assert.equal(specifier, './admin-catalog-presentation.js');
  return presentation;
};
vm.runInContext(
  ts.transpileModule(
    readFileSync(
      process.env.STUL_ADMIN_SOURCE || 'server/admin-catalogs.js',
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  context,
);
const run = (code) => vm.runInContext(code, context);
await run("open('local-test')");
assert.equal(run('editing.type'), 'bestiary');
el('catalog-type').value = 'scenery';
await el('catalog-type').onchange();
await new Promise((r) => setImmediate(r));
assert.equal(
  run('editing.type'),
  'scenery',
  'category must select matching editor',
);
assert.equal(JSON.parse(el('catalog-json').value).id, 'rubble');
el('catalog-json').value += ' ';
confirmations.push(false);
el('catalog-type').value = 'bestiary';
await el('catalog-type').onchange();
await new Promise((r) => setImmediate(r));
assert.equal(el('catalog-type').value, 'scenery');
assert.equal(run('editing.type'), 'scenery');
assert(el('catalog-json').value.endsWith(' '));
confirmations.push(true);
el('catalog-type').value = 'bestiary';
await el('catalog-type').onchange();
await new Promise((r) => setImmediate(r));
assert.equal(run('editing.type'), 'bestiary');
el('catalog-json').value += ' ';
await el('catalog-next').onclick();
assert.equal(run('catalogPage'), 1);
assert(el('catalog-json').value.endsWith(' '));
confirmations.push(false);
el('catalog-editor-cancel').onclick();
await new Promise((r) => setImmediate(r));
assert.equal(el('catalog-editor').hidden, false);
confirmations.push(true);
el('catalog-editor-cancel').onclick();
await new Promise((r) => setImmediate(r));
assert.equal(el('catalog-editor').hidden, true);
let release;
slow = new Promise((r) => (release = r));
const before = requests;
const first = run('perform(reload)');
await run('perform(reload)');
assert.equal(requests, before + 1);
assert.equal(run('busy'), true);
el('catalog-type').value = 'scenery';
el('catalog-type').onchange();
assert.equal(el('catalog-type').value, 'bestiary');
release();
await first;
slow = undefined;
assert.equal(run('busy'), false);
run('clearEditor()');
run(
  `edit('bestiary',{id:'new-test',name:'New',description:'Draft',maxHp:2,combat:{attack:0,defense:0,damage:0}})`,
);
assert.equal(run('Boolean(isDirty())'), true);
run('valid=true');
el('catalog-editor').onsubmit({ preventDefault() {} });
await new Promise((r) => setImmediate(r));
assert.equal(run('Boolean(isDirty())'), false);
assert(entries.bestiary.some((e) => e.id === 'new-test'));
assert.equal(el('catalog-message').textContent, '');
run('clearEditor()');
el('catalog-import').files = [{ size: 1000 }];
el('catalog-import').onchange({ target: el('catalog-import') });
await new Promise((r) => setImmediate(r));
assert.equal(el('catalog-preview').hidden, false);
assert.equal(el('catalog-install').textContent, 'Potvrdit instalaci');
run(
  `edit('bestiary',selected.bundle.entries.bestiary[0],selected.bundle.entries.bestiary[0].id)`,
);
el('catalog-json').value += ' ';
confirmations.push(false);
el('catalog-install').onclick();
await new Promise((r) => setImmediate(r));
assert.equal(installs, 0);
assert(el('catalog-json').value.endsWith(' '));
confirmations.push(true);
el('catalog-install').onclick();
el('catalog-install').onclick();
await new Promise((r) => setImmediate(r));
assert.equal(installs, 1);
assert.equal(el('catalog-preview').hidden, true);
run(
  `showPreview({token:'update-token',manifest:{...selected.bundle.manifest,dependencies:[],version:'1.1.0'},currentVersion:'1.0.0',digest:'b'.repeat(64),counts:{bestiary:1},diff:{added:0,changed:1,removed:0}})`,
);
assert.equal(el('catalog-install').textContent, 'Aktualizovat katalog');
selected.kind = 'community';
await run("open('local-test')");
assert.equal(el('catalog-json').readOnly, true);
assert.equal(el('catalog-save').hidden, true);
selected.kind = 'local';
let finish;
slow = new Promise((r) => (finish = r));
const abandoned = run('perform(reload)');
listeners.get('stul-admin-logout')();
finish();
await abandoned;
slow = undefined;
assert.equal(run('selected'), undefined);
assert.equal(run('busy'), false);
assert.equal(el('catalog-detail').hidden, true);
console.log(
  'PASS: actual admin controller category/editor consistency, unsaved cancel/confirm, paging, cancel editing and double click during slow fetch.',
);
