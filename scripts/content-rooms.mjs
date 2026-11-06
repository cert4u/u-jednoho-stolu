import { generateDungeon } from './generator-test-import.mjs';

const { findDungeonPreset } = await import('../lib/dungeon-presets.ts');
const preset = findDungeonPreset(process.argv[2]);
if (!preset) {
  console.error('Zadej ID předlohy, např. npm run content:rooms -- cave');
  process.exitCode = 1;
} else {
  const draft = generateDungeon(preset.options);
  for (const [index, floor] of draft.floors.entries()) {
    console.log(`Patro ${index + 1} · ${floor.name}`);
    for (const room of floor.rooms)
      console.log(`  ${room.id} · ${room.role} · ${room.cells.length} polí`);
  }
}
