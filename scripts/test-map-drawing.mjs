import assert from 'node:assert/strict';
import { generateDungeon } from './generator-test-import.mjs';
const { buildInkDrawing, solidNormal, inkTheme, doorAppearance, edgeOpacity } =
  await import('../components/dungeon-map/drawing/geometry.ts');
const { inkNoise } = await import('../components/dungeon-map/drawing/noise.ts');
const { emptyDungeon, editDungeon, playerDungeon } = await import('../lib/dungeon.ts');

const ink = map => buildInkDrawing(map, new Set(map.revealed), new Set(), false, false);
const manual = editDungeon(emptyDungeon(), { tool: 'room', from: [3, 3], to: [8, 7] });
assert.equal(inkTheme(manual), 'universal');
assert.deepEqual(solidNormal('h:3:3', new Set(manual.floors)), [0, -1]);
assert.deepEqual(solidNormal('h:3:8', new Set(manual.floors)), [0, 1]);
assert.deepEqual(solidNormal('v:3:3', new Set(manual.floors)), [-1, 0]);
assert.deepEqual(solidNormal('v:9:3', new Set(manual.floors)), [1, 0]);
assert.equal(solidNormal('h:4:4', new Set(manual.floors)), undefined);
assert.equal(solidNormal('h:0:0', new Set(manual.floors)), undefined);
assert.equal(inkNoise('h:3:3', 2), inkNoise('h:3:3', 2));
assert.notEqual(inkNoise('h:3:3', 2), inkNoise('h:3:3', 3));
assert.equal(edgeOpacity('h:3:3', new Set(), new Set(), false, false), .25);
assert.equal(edgeOpacity('h:3:3', new Set(), new Set(), true, true), .3);

let totalEdges = 0;
const start = performance.now();
for (const style of ['castle', 'mine', 'cave']) {
  const draft = generateDungeon({
    version: 'v2', style, variant: 0, levels: 1, rooms: 6, name: 'Inkoust',
    seed: 'ink-regression', size: 'medium', corridors: 'winding', connections: 1, separateExit: true,
  });
  const map = draft.floors[0].map;
  const original = structuredClone(map);
  const drawing = ink(map);
  assert.equal(drawing.theme, style);
  assert(drawing.walls.length && drawing.hatching.some(group => group.d.length));
  assert(drawing.walls.length <= 3 && drawing.hatching.length <= 3 && drawing.accents.length <= 9);
  assert(!JSON.stringify(drawing).match(/NaN|Infinity/));
  assert.deepEqual(ink(JSON.parse(JSON.stringify(map))), drawing);
  assert.deepEqual(ink({ ...map, floors: [...map.floors].reverse(), edges: Object.fromEntries(Object.entries(map.edges).reverse()) }), drawing);
  assert.deepEqual(map, original);
  assert.equal(inkTheme({ ...map, generation: { ...map.generation, status: 'modified' } }), 'universal');
  assert.equal(inkTheme({ ...map, generation: { ...map.generation, rooms: [] } }), 'universal');
  assert.equal(inkTheme({ ...map, generation: { ...map.generation, style: 'unknown', options: { ...map.generation.options, style: 'unknown' } } }), 'universal');
  const door = Object.keys(map.edges).find(key => map.edges[key] === 'door');
  if (door) {
    const opened = { ...map, openDoors: [door] };
    assert.deepEqual(ink(opened), drawing, 'Opening a door must not reshape the other walls.');
    assert.equal(doorAppearance(opened, door), 'open');
    assert.equal(doorAppearance(map, door), 'closed');
    assert.equal(doorAppearance({ ...map, doorSettings: { [door]: { locked: true } } }, door), 'locked');
  }
  const first = map.floors[0];
  const hidden = { ...map, revealed: [first] };
  const observed = playerDungeon(hidden);
  const sameAllowedMap = structuredClone(observed);
  assert.equal(ink(observed).theme, 'universal');
  assert.deepEqual(ink(observed), ink(sameAllowedMap));
  assert.equal(ink(playerDungeon({ ...map, revealed: [] })).walls.length, 0);
  assert.equal(ink(playerDungeon({ ...map, revealed: [] })).hatching.length, 0);
  totalEdges += Object.keys(map.edges).length;
}

const door = 'h:5:3';
const secret = { ...manual, edges: { ...manual.edges, [door]: 'door' },
  revealed: [...manual.floors], doorSettings: { [door]: { secret: true, discovered: false, locked: true } } };
assert.equal(doorAppearance(secret, door), 'secret');
assert.equal(doorAppearance({ ...secret, openDoors: [door], doorSettings: { [door]: { secret: true, discovered: true, locked: false } } }, door), 'secret-open');
assert.equal(doorAppearance({ ...secret, openDoors: [door] }, door), 'secret', 'A locked secret door cannot appear open.');
const visibleSecret = playerDungeon(secret);
assert.equal(doorAppearance(visibleSecret, door), undefined);
const wall = { ...manual, revealed: [...manual.floors] };
assert.deepEqual(ink(visibleSecret), ink(playerDungeon(wall)), 'A hidden door must look exactly like the same known wall.');
assert.deepEqual(ink({ ...manual, generation: undefined }), ink(manual));
assert(ink(manual).walls.some(group => group.d.includes('C')));
// Interior partitions have no solid side, so adding one must not add exterior marks.
const partition = editDungeon(manual, { tool: 'wall', points: [[5,4],[5,6]] });
assert.deepEqual(ink(partition).hatching, ink(manual).hatching);
assert.deepEqual(ink(partition).details, ink(manual).details);
// An undiscovered extension must not change any part of the recipient's drawing.
const remembered = { ...manual, revealed: [...manual.floors] };
const hiddenExtension = editDungeon(remembered, { tool: 'room', from: [14,12], to: [20,17] });
assert.deepEqual(ink(playerDungeon(hiddenExtension)), ink(playerDungeon(remembered)));
const playerMap = playerDungeon(remembered);
const darkDrawing = buildInkDrawing(playerMap, new Set(playerMap.revealed), new Set(), true, true);
assert(darkDrawing.walls.every(group => group.opacity === .3));
assert(darkDrawing.hatching.every(group => group.opacity === .3));
console.log(`PASS: ink determinism, contours, hatch sides, hidden doors/fog, metadata fallback and immutable geometry (${totalEdges} edges, ${Math.round(performance.now()-start)} ms including generation).`);
