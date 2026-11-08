import assert from 'node:assert/strict';
await import('./generator-test-import.mjs');
const { initialGame } = await import('../lib/game.ts');
const { mechanicsAction, pendingCombat, canReadMessage } = await import(
  '../lib/mechanics.ts'
);
const game = initialGame('PJ', 'owner'),
  pj = game.members[0];
const a = { ...pj, id: 'a', token: 'a-token', role: 'player', name: 'Borin' },
  b = { ...pj, id: 'b', token: 'b-token', role: 'player', name: 'Ela' };
game.members.push(a, b);
const run = (who, body, id = crypto.randomUUID()) => {
  mechanicsAction(game, who, { ...body, requestId: id });
  return id;
};
const attackId = run(a, {
  kind: 'attack',
  actor: { type: 'member', id: a.id },
  target: { type: 'member', id: b.id },
  base: 5,
  modifier: 0,
  damageBonus: 2,
});
const attack = game.messages.at(-1),
  count = game.messages.length;
run(a, { kind: 'attack' }, attackId);
assert.equal(
  game.messages.length,
  count,
  'Repeated operation must return before rerolling or validating new data.',
);
assert.throws(
  () => run(a, { kind: 'defense', attackId: attack.id, base: 3 }),
  /svou postavu/,
);
const defenseId = run(b, { kind: 'defense', attackId: attack.id, base: 3 });
const defense = game.messages.at(-1);
assert.equal(defense.mechanics.attackId, attack.id);
assert.equal(game.combatActions[attack.id].mechanics.defenseId, defense.id);
run(b, { kind: 'defense', attackId: attack.id, base: 3 }, defenseId);
assert.equal(game.messages.at(-1).id, defense.id);
assert.throws(
  () => run(b, { kind: 'defense', attackId: attack.id, base: 3 }),
  /už obrana proběhla/,
);
assert.throws(
  () => run(b, { kind: 'apply', defenseId: defense.id, amount: 3 }),
  /pouze PJ/,
);
assert.equal(b.hp, 12);
const applied = run(pj, { kind: 'apply', defenseId: defense.id, amount: 3 });
assert.equal(b.hp, 9);
const appliedCount = game.messages.length;
run(pj, { kind: 'apply', defenseId: defense.id, amount: 3 }, applied);
assert.equal(b.hp, 9);
assert.equal(game.messages.length, appliedCount);
assert.throws(
  () => run(pj, { kind: 'apply', defenseId: defense.id, amount: 3 }),
  /už bylo potvrzené/,
);
assert.equal(b.hp, 9);
assert.equal(pendingCombat(game, a.id).length, 0);
run(a, {
  kind: 'attack',
  actor: { type: 'member', id: a.id },
  target: { type: 'member', id: b.id },
  base: 2,
});
const cancelledAttack = game.messages.at(-1);
run(b, { kind: 'defense', attackId: cancelledAttack.id, base: 2 });
const cancelledDefense = game.messages.at(-1);
run(pj, { kind: 'cancel', messageId: cancelledDefense.id });
assert(game.combatActions[cancelledAttack.id].mechanics.cancelled);
assert(game.combatActions[cancelledDefense.id].mechanics.cancelled);
assert.throws(
  () => run(pj, { kind: 'apply', defenseId: cancelledDefense.id, amount: 2 }),
  /Chybí vyhodnocená obrana/,
);
assert.equal(b.hp, 9);
game.monsters = [
  {
    id: 'hidden',
    name: 'Tajný strážce',
    levelId: 'ground',
    x: 1,
    y: 1,
    hidden: true,
    archived: false,
    hp: 8,
    maxHp: 8,
  },
];
run(pj, {
  kind: 'attack',
  actor: { type: 'monster', id: 'hidden' },
  target: { type: 'member', id: b.id },
  base: 2,
});
const secret = game.messages.at(-1);
assert.equal(secret.to, pj.id);
assert(!canReadMessage(secret, b.id));
assert.equal(pendingCombat(game, b.id).length, 0);
assert.throws(
  () => run(b, { kind: 'defense', attackId: secret.id, base: 2 }),
  /Útok není dostupný/,
);
assert.throws(
  () =>
    run(a, {
      kind: 'attack',
      actor: { type: 'member', id: a.id },
      target: { type: 'monster', id: 'hidden' },
      base: 2,
    }),
  /není v dohledu/,
);
const invalid = crypto.randomUUID();
assert.throws(
  () =>
    run(a, { kind: 'unknown', actor: { type: 'member', id: a.id } }, invalid),
  /druh hodu/,
);
assert(!game.mechanicsOperations.includes(a.id + ':' + invalid));
console.log(
  'PASS: combat dispatcher preserves replay identity, defense ownership, single damage application, linked cancellation and private hidden-monster rolls.',
);
