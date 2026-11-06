import assert from 'node:assert/strict';
import { open, readFile, readdir } from 'node:fs/promises';
import { generateDungeon } from './generator-test-import.mjs';

const { bestiaryEntries, bestiaryPortrait, bestiaryEntrySchema } = await import('../lib/bestiary.ts');
const { dungeonPresets } = await import('../lib/dungeon-presets.ts');
const { adventureTemplates, resolveAdventureRooms, adventureSchema } = await import('../lib/adventure-templates.ts');

async function checkPortrait(entry, root = new URL('../', import.meta.url)) {
  const path = `public/monsters/${bestiaryPortrait(entry)}.webp`;
  const file = await open(new URL(path, root), 'r').catch(error => {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(`content/bestiary/${entry.id}.json: chybí ilustrace ${path}.`);
  });
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(20));
    const { size } = await file.stat();
    assert(bytesRead === 20 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16)) &&
      buffer.readUInt32LE(4) + 8 === size && buffer.readUInt32LE(16) <= size - 20,
    `content/bestiary/${entry.id}.json: ilustrace ${path} musí být ve formátu WebP.`);
  } finally {
    await file.close();
  }
}

for (const entry of bestiaryEntries) await checkPortrait(entry);

const drafts = new Map();
for (const preset of dungeonPresets) {
  try {
    drafts.set(preset.id, generateDungeon(preset.options));
  } catch (error) {
    throw new Error(`content/dungeon-presets/${preset.id}.json: ${error.message}`);
  }
}
for (const adventure of adventureTemplates) {
  resolveAdventureRooms(adventure, drafts.get(adventure.dungeonPreset).floors);
}

// Exercise diagnostics on synthetic submissions without editing the working catalog.
const { parseCatalog } = await import('../lib/content-schema.ts');
const source = (data, group = 'bestiary') => ({ path: `content/${group}/${data.id}.json`, data });
const entry = { ...bestiaryEntries[0], id: 'testovaci-prisera', portrait: bestiaryPortrait(bestiaryEntries[0]) };
const [newEntry] = parseCatalog([source(entry)], bestiaryEntrySchema);
assert.equal(newEntry.id, entry.id);
await checkPortrait(newEntry);
assert.throws(() => parseCatalog([source({ ...entry, gmHint: undefined })], bestiaryEntrySchema),
  /testovaci-prisera\.json: chybí povinné pole gmHint/);
assert.throws(() => parseCatalog([source(entry), source(entry)], bestiaryEntrySchema), /duplicitní ID/);
await assert.rejects(checkPortrait({ ...entry, portrait: 'neexistujici-testovaci-ilustrace' }), /chybí ilustrace/);
const adventure = adventureTemplates[0];
assert.throws(() => parseCatalog([source({ ...adventure, dungeonPreset: 'neexistuje' }, 'adventures')], adventureSchema),
  /dungeonPreset: Neznámá předloha jeskyně/);
const badMonster = { ...adventure, rooms: [{ ...adventure.rooms[0], monsters: ['neexistuje'] }] };
assert.throws(() => parseCatalog([source(badMonster, 'adventures')], adventureSchema),
  /rooms\.0\.monsters\.0: Neznámá příšera/);
const badRoom = { ...adventure, rooms: [{ ...adventure.rooms[0], role: undefined, roomId: 'v2-l0-r99' }] };
assert.throws(() => resolveAdventureRooms(badRoom, drafts.get(adventure.dungeonPreset).floors),
  /rooms\.0: patro 1 neobsahuje/);

console.log(`PASS: ${bestiaryEntries.length} příšer s ilustrací, ${dungeonPresets.length} funkční předlohy jeskyní a ${adventureTemplates.length} dobrodružství.`);

if (process.argv.includes('--client')) {
  const root = new URL('../dist/client/', import.meta.url);
  const files = (await readdir(root, { recursive: true })).filter(file => file.endsWith('.js'));
  assert(files.length > 0, 'Nejdřív sestav aplikaci. V dist/client chybí JavaScript.');
  const secrets = [
    ...bestiaryEntries.map(entry => [`bestiary/${entry.id}`, entry.gmHint]),
    ...adventureTemplates.flatMap(entry => [entry.gmNotes, ...entry.rooms.map(room => room.gmNotes)]
      .filter(Boolean).map(secret => [`adventures/${entry.id}`, secret])),
  ];
  for (const file of files) {
    const code = await readFile(new URL(file, root), 'utf8');
    for (const [source, secret] of secrets) {
      // Match complete string literals, including escaped Czech characters.
      const literal = JSON.stringify(secret).slice(1, -1);
      const unicode = literal.replace(/[^\x00-\x7F]/g, char =>
        '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
      const spellings = [literal, unicode].flatMap(value => [
        `"${value}"`,
        `'${value.replaceAll('\\"', '"').replaceAll("'", "\\'")}'`,
      ]);
      assert(!spellings.some(value => code.includes(value)),
        `dist/client/${file}: obsahuje text pro PJ z content/${source}.json.`);
    }
  }
  console.log('PASS: klientské JS neobsahuje texty předloh určené PJ.');
}
