import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { generateDungeon } from './generator-test-import.mjs';

const { bestiaryEntries } = await import('../lib/bestiary.ts');
const { dungeonPresets } = await import('../lib/dungeon-presets.ts');
const { adventureTemplates } = await import('../lib/adventure-templates.ts');

for (const entry of bestiaryEntries) {
  const portrait = new URL(`../public/monsters/${entry.portrait ?? entry.id}.webp`, import.meta.url);
  await access(portrait);
}

const drafts = new Map(dungeonPresets.map(preset => [preset.id, generateDungeon(preset.options)]));
for (const adventure of adventureTemplates) {
  const draft = drafts.get(adventure.dungeonPreset);
  assert(draft, adventure.id);
  for (const placement of adventure.rooms) {
    const matches = draft.floors[placement.floor - 1]?.rooms.filter(room => room.role === placement.role);
    assert.equal(matches?.length, 1, `${adventure.id}: ${placement.floor}/${placement.role}`);
  }
}

console.log(`PASS: ${bestiaryEntries.length} příšer s ilustrací, ${dungeonPresets.length} funkční předlohy jeskyní a ${adventureTemplates.length} dobrodružství.`);
