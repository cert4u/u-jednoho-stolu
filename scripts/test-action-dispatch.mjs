import assert from 'node:assert/strict';
await import('./generator-test-import.mjs');
const { applyGameAction } = await import('../app/api/game/actions.ts');
const { initialGame } = await import('../lib/game.ts');
const { ensureAtlas } = await import('../lib/exploration.ts');
const { editDungeon } = await import('../lib/dungeon.ts');

function fixture() {
  const game = initialGame('PJ', 'pj-token');
  const owner = game.members[0];
  const player = { ...owner, id: 'player', token: 'player-token', name: 'Hráč', role: 'player' };
  game.members.push(player);
  return { game, owner, player };
}

async function rejected(body, expectedStatus, expectedMessage, asOwner = false) {
  const { game, owner, player } = fixture();
  const before = structuredClone(game);
  const result = await applyGameAction(game, asOwner ? owner : player, 'ROOM', body);
  assert(result instanceof Response, JSON.stringify(body));
  assert.equal(result.status, expectedStatus, JSON.stringify(body));
  if (expectedMessage) assert.equal((await result.json()).error, expectedMessage);
  assert.deepEqual(game, before, 'rejected action must not mutate the game');
}

for (const action of ['map', 'experience', 'generate', 'life', 'map-note', 'journey',
  'recovery', 'condition', 'initiative', 'monster', 'story-outline', 'session-recap',
  'notes', 'member-archive', 'member-restore']) {
  await rejected({ action }, 403);
}
for (const op of ['save', 'remove', 'close', 'reopen', 'split-coins'])
  await rejected({ action: 'loot', op }, 403);
for (const op of ['create', 'resolve', 'cancel'])
  await rejected({ action: 'challenge', op }, 403);
for (const op of ['enable', 'level-add', 'level-rename', 'settings', 'place',
  'stairs-add', 'stairs-remove', 'battle-start', 'battle-end', 'lighting', 'move', 'door', 'travel'])
  await rejected({ action: 'explore', op }, 403);
await rejected({ action: 'equipment', op: 'use-healing', memberId: 'player' }, 403,
  'Léčení předmětem potvrzuje pouze Pán jeskyně.');
await rejected({ action: 'equipment', memberId: 'someone-else' }, 403);
await rejected({ action: 'power', memberId: 'someone-else' }, 403);
await rejected({ action: 'access-key', memberId: 'someone-else' }, 403);
for (const action of ['unknown', '__proto__', 'constructor', 'toString', null, 17])
  await rejected({ action }, 400, 'Neznámá akce.');
await rejected({ action: 'move', id: 'someone-else', x: 2, y: 3 }, 403);
await rejected({ action: 'cell' }, 403, 'Použij nový editor mapy.');
await rejected({ action: 'cell' }, 400, 'Použij nový editor mapy.', true);
await rejected({ action: 'character', name: 'Nové jméno' }, 409);
await rejected({ action: 'character', hp: -1, expected: { hp: '12' } }, 400);
await rejected({ action: 'notes', notes: 'Zastaralá poznámka' }, 409, undefined, true);

const { game, owner, player } = fixture();
const forbiddenMove = await applyGameAction(game, player, 'ROOM', { action: 'move', id: owner.id, x: 2, y: 3 });
assert(forbiddenMove instanceof Response);
assert.equal(forbiddenMove.status, 403);
assert.deepEqual([owner.x, owner.y], [5, 6]);
let result = await applyGameAction(game, player, 'ROOM', {
  action: 'character', name: 'Borin', expected: { name: player.name },
});
assert(!(result instanceof Response));
assert.equal(player.name, 'Borin');
result = await applyGameAction(game, owner, 'ROOM', { action: 'notes', title: 'Důl', expected: { title: game.title } });
assert(!(result instanceof Response));
assert.equal(game.title, 'Důl');
result = await applyGameAction(game, player, 'ROOM', { action: 'move', id: player.id, x: 2, y: 3 });
assert(!(result instanceof Response));
assert.deepEqual([player.x, player.y], [2, 3]);

// A rejected geometry edit must not commit the draft map, undo history or replay ID.
game.dungeon = editDungeon(game.dungeon, { tool: 'room', from: [1, 1], to: [4, 4] });
const atlas = ensureAtlas(game);
atlas.location = { levelId: 'ground', x: 2, y: 2 };
const before = structuredClone(game);
result = await applyGameAction(game, owner, 'ROOM', {
  action: 'map', tool: 'subtract', points: [[2, 2]], requestId: 'occupied-cell-edit',
});
assert(result instanceof Response);
assert.equal(result.status, 400);
assert.deepEqual(game, before);

// Access rotation still returns the secret to its caller and invalidates archived access.
result = await applyGameAction(game, owner, 'ROOM', { action: 'member-archive', memberId: player.id });
assert(!(result instanceof Response));
assert.equal(player.archived, true);
assert.notEqual(player.token, 'player-token');
result = await applyGameAction(game, owner, 'ROOM', { action: 'member-restore', memberId: player.id });
assert(!(result instanceof Response));
assert.equal(player.archived, false);
assert(result.recoveryCode.startsWith('ROOM:player:'));
assert(player.recoveryHash);
console.log('PASS: dispatcher role policies, unknown/prototype names, 400/403/409 errors, successful edits, occupied map atomicity and access rotation.');
