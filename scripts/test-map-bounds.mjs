import assert from 'node:assert/strict';
await import('./generator-test-import.mjs');
const {
  MAP_WIDTH: W,
  MAP_HEIGHT: H,
  MAP_CELLS,
} = await import('../lib/map-limits.ts');
const { emptyDungeon, editDungeon } = await import('../lib/dungeon.ts');
const { initialGame } = await import('../lib/game.ts');
const { makeBackup, validateBackup } = await import('../lib/backup.ts');
const { explorationAction } = await import('../lib/exploration/actions.ts');
const { surfaceListSchema } = await import('../lib/surfaces.ts');
const { sceneryListSchema } = await import('../lib/scenery.ts');
const { mapCellKey, mapEdgeKey, mapPoint } = await import(
  '../lib/map-coordinates.ts'
);
assert(mapPoint.safeParse([W - 1, H - 1]).success);
for (const invalid of [
  [W, 0],
  [0, H],
  [-1, 0],
  [0.5, 0],
  [0, '1'],
])
  assert(!mapPoint.safeParse(invalid).success);
assert(mapCellKey.safeParse(`${W - 1},${H - 1}`).success);
for (const invalid of [
  `${W},0`,
  `0,${H}`,
  '-1,0',
  '1.5,0',
  'constructor',
  'NaN,0',
])
  assert(!mapCellKey.safeParse(invalid).success);
for (const edge of [`h:${W - 1}:${H}`, `v:${W}:${H - 1}`])
  assert(mapEdgeKey.safeParse(edge).success);
for (const invalid of [
  `h:${W}:${H}`,
  `v:${W}:${H}`,
  `h:0:${H + 1}`,
  `v:${W + 1}:0`,
  'x:0:0',
  'h:-1:0',
])
  assert(!mapEdgeKey.safeParse(invalid).success);
let map = editDungeon(emptyDungeon(), {
  tool: 'room',
  from: [0, 0],
  to: [W - 1, H - 1],
});
assert.equal(map.floors.length, MAP_CELLS);
map = editDungeon(map, { tool: 'door', edges: [`v:${W}:${H - 1}`] });
map = editDungeon(map, { tool: 'stairsUp', points: [[W - 1, H - 1]] });
assert.throws(() =>
  editDungeon(map, { tool: 'room', from: [W, 0], to: [W, 0] }),
);
assert.throws(() =>
  editDungeon(map, { tool: 'room', from: [0, H], to: [0, H] }),
);
assert(
  surfaceListSchema.safeParse([{ kind: 'puddle', x: W - 1, y: H - 1 }]).success,
);
assert(
  !surfaceListSchema.safeParse([{ kind: 'puddle', x: W, y: H - 1 }]).success,
);
assert(!sceneryListSchema.safeParse([{ kind: 'barrel', x: W, y: 0 }]).success);
const game = initialGame('PJ', 'owner');
game.dungeon = map;
game.members[0].x = W - 1;
game.members[0].y = H - 1;
assert.deepEqual(validateBackup(makeBackup(game)).dungeon, map);
explorationAction(game, game.members[0], {
  op: 'enable',
  requestId: crypto.randomUUID(),
});
explorationAction(game, game.members[0], {
  op: 'place',
  levelId: game.atlas.levels[0].id,
  x: W - 1,
  y: H - 1,
  requestId: crypto.randomUUID(),
});
assert.equal(game.atlas.location.x, W - 1);
assert.equal(game.atlas.location.y, H - 1);
assert.equal(validateBackup(makeBackup(game)).atlas.location.x, W - 1);
const legacy = initialGame('Starý PJ', 'owner');
legacy.dungeon = editDungeon(emptyDungeon(), {
  tool: 'room',
  from: [0, 0],
  to: [27, 19],
});
assert.deepEqual(validateBackup(makeBackup(legacy)).dungeon, legacy.dungeon);
console.log(
  'PASS: expanded map bounds, full-map backup, far-corner doors/stairs/exploration, rejected overflow and legacy map compatibility.',
);
