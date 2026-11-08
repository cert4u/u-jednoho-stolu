import assert from 'node:assert/strict';
await import('./generator-test-import.mjs');
const publicApi = await import('../lib/exploration.ts');
const { knownPath, sight } = await import('../lib/exploration/geometry.ts');
const { initialGame } = await import('../lib/game.ts');
const { emptyDungeon } = await import('../lib/dungeon.ts');

assert.equal(
  publicApi.sight,
  sight,
  'existing imports must expose the same implementation',
);
const map = { ...emptyDungeon(), floors: [] };
for (let y = 1; y <= 4; y++)
  for (let x = 1; x <= 8; x++) map.floors.push(`${x},${y}`);
for (let y = 1; y <= 4; y++) map.edges[`v:4:${y}`] = 'wall';
map.edges['v:4:2'] = 'door';
const level = {
  id: 'ground',
  name: 'Důl',
  map,
  memory: structuredClone(map),
  visible: [],
  history: [],
};
assert.throws(() => knownPath(level, [2, 2], [6, 2]), /známá průchozí cesta/);
assert(!sight(map, [2, 2], 12).includes('6,2'));
map.openDoors = ['v:4:2'];
const path = knownPath(level, [2, 2], [6, 2]);
assert.deepEqual(path, [
  [2, 2],
  [3, 2],
  [4, 2],
  [5, 2],
  [6, 2],
]);
assert(sight(map, [2, 2], 12).includes('6,2'));
level.memory.floors = level.memory.floors.filter((key) => key !== '6,2');
assert.throws(
  () => knownPath(level, [2, 2], [6, 2], 'Cíl není známý.'),
  /Cíl není známý/,
);
level.memory.floors.push('6,2');
for (const settings of [
  { locked: true, secret: false, discovered: true },
  { locked: false, secret: true, discovered: false },
]) {
  map.doorSettings = { 'v:4:2': settings };
  assert.throws(() => knownPath(level, [2, 2], [6, 2]), /známá průchozí cesta/);
  assert(!sight(map, [2, 2], 12).includes('6,2'));
}
assert.deepEqual(
  sight({ ...emptyDungeon(), floors: ['1,1', '2,2'] }, [1, 1], 12),
  ['1,1'],
);

// Moving through remembered cells in complete darkness must not reveal adjacent rooms.
const game = initialGame('PJ', 'owner');
const atlas = publicApi.ensureAtlas(game),
  ground = atlas.levels[0];
ground.map = { ...emptyDungeon(), floors: map.floors };
const corridor = ['2,2', '3,2', '4,2', '5,2', '6,2'];
ground.memory = {
  ...emptyDungeon(),
  floors: [...corridor],
  revealed: [...corridor],
};
atlas.location = { levelId: 'ground', x: 2, y: 2 };
atlas.radius = 12;
atlas.lighting = { enabled: true, darkRadius: 0 };
publicApi.explorationAction(game, game.members[0], {
  op: 'move',
  x: 6,
  y: 2,
  requestId: crypto.randomUUID(),
});
assert.deepEqual(ground.visible, ['6,2']);
assert.deepEqual([...ground.memory.floors].sort(), [...corridor].sort());
assert.deepEqual([...ground.memory.revealed].sort(), [...corridor].sort());
assert.deepEqual(atlas.location, { levelId: 'ground', x: 6, y: 2 });
assert.deepEqual(knownPath(ground, [6, 2], [6, 2]), [[6, 2]]);
console.log(
  'PASS: shared exploration facade, known paths, blocked/locked/secret doors, diagonal occlusion and no new discovery during dark group movement.',
);
