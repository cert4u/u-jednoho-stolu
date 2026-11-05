import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:5173';
async function post(session, action, values, status = 200) {
  const response = await fetch(base + '/api/game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? {Authorization: 'Bearer ' + session.token} : {}),
    },
    body: JSON.stringify({room: session?.room, action, requestId: crypto.randomUUID(), ...values}),
  });
  const result = await response.json();
  assert.equal(response.status, status, result.error);
  return result;
}
async function get(session, query = '') {
  const response = await fetch(base + '/api/game?room=' + session.room + query, {
    headers: {Authorization: 'Bearer ' + session.token},
  });
  assert.equal(response.status, 200);
  return response.json();
}

const pj = await post(null, 'create', {name: 'PJ pergamenů'});
const leader = await post(null, 'join', {room: pj.room, name: 'Vedoucí'});
const player = await post(null, 'join', {room: pj.room, name: 'Hráč'});
const draw = (tool, values) => post(pj, 'map', {tool, ...values});
const explore = (session, op, values) => post(session, 'explore', {op, ...values});
const parchmentMessages = async session => (await get(session)).messages.filter(message => message.parchment);
const secret = 'Tajné číslo pod poklopem';
const draft = {
  op: 'save', levelId: 'ground', x: 8, y: 6, expectedRevision: null,
  title: 'Kamenná síň', text: 'Pod kroky tiše křupe štěrk.\nOdněkud zní kapání.',
  secret, roomNumber: 2, publish: false, parchmentOnEntry: true,
};

await draw('room', {from: [1, 1], to: [14, 9]});
for (const x of [5, 10]) {
  await draw('wall', {points: [[x, 1], [x, 10]]});
  await draw('door', {edges: [`v:${x}:5`]});
}
await draw('reveal', {from: [1, 1], to: [14, 9]});
await explore(pj, 'enable');
await explore(pj, 'settings', {leaderId: leader.game.me, radius: 12});
await post(player, 'map-note', {...draft, showParchment: true}, 403);
await post(pj, 'map-note', {...draft, text: ''}, 400);
await post(pj, 'map-note', {...draft, parchmentOnEntry: 'true'}, 400);
const prepared = await post(pj, 'map-note', draft);
const note = prepared.game.mapNotes[0];

await explore(pj, 'place', {x: 8, y: 5});
assert.equal((await parchmentMessages(leader)).length, 0, 'PJ placement does not fire a walk-in event');
await explore(pj, 'place', {x: 3, y: 5});
for (const x of [5, 10]) await explore(pj, 'door', {edge: `v:${x}:5`});
const seenFromOutside = await get(player);
assert(seenFromOutside.exploration.visible.includes('8,6'));
assert(!JSON.stringify(seenFromOutside).includes(draft.title));
assert(!JSON.stringify(seenFromOutside).includes(draft.text));
assert(!JSON.stringify(seenFromOutside).includes(secret));

const setup = await explore(pj, 'battle-start', {});
await explore(leader, 'battle-move', {
  battleId: setup.game.exploration.battle.id, memberId: leader.game.me,
  x: 8, y: 5, expected: {x: 3, y: 5},
});
assert.equal((await parchmentMessages(player)).length, 0);
const battle = (await get(pj)).exploration.battle;
await explore(pj, 'battle-end', {battleId: battle.id, expectedRevision: battle.revision, x: 3, y: 5});

const moveId = crypto.randomUUID();
await explore(leader, 'move', {x: 12, y: 5, requestId: moveId});
const [message] = await parchmentMessages(player);
assert.deepEqual(message.parchment, {title: draft.title, roomNumber: draft.roomNumber});
assert.equal(message.text, draft.text);
assert.equal(message.from, pj.game.me);
assert(!JSON.stringify(await get(player)).includes(secret));
assert(!JSON.stringify(await get(player)).includes('parchmentOnEntry'));
await explore(leader, 'move', {x: 12, y: 5, requestId: moveId});
await explore(leader, 'move', {x: 3, y: 5});
assert.equal((await parchmentMessages(player)).length, 1);
await post(pj, 'map-note', {...draft, noteId: note.id, expectedRevision: note.revision}, 409);

const basement = (await explore(pj, 'level-add', {name: 'Sklep'})).game.exploration.levels[1].id;
await draw('room', {levelId: basement, from: [1, 1], to: [8, 8]});
await post(pj, 'map-note', {...draft, title: 'Sklepní pergamen', levelId: basement});
await explore(pj, 'stairs-add', {
  levelId: 'ground', x: 3, y: 5, destinationLevelId: basement, destinationX: 3, destinationY: 5,
});
const stair = (await get(pj)).exploration.stairs.find(item => item.x === 3 && item.y === 5);
await explore(leader, 'travel', {stairId: stair.id});
assert.equal((await parchmentMessages(player)).at(-1).parchment.title, 'Sklepní pergamen');

const manual = {...draft, levelId: basement, x: 5, title: 'Ruční pergamen', roomNumber: 3, parchmentOnEntry: false, showParchment: true, requestId: crypto.randomUUID()};
const shown = await post(pj, 'map-note', manual);
await post(pj, 'map-note', manual);
assert.equal((await parchmentMessages(player)).length, 3);
const manualNote = shown.game.mapNotes.find(item => item.title === manual.title);
await post(pj, 'map-note', {...manual, requestId: crypto.randomUUID(), noteId: manualNote.id, expectedRevision: manualNote.revision, title: 'Upravená příprava'});
assert.equal((await parchmentMessages(player)).length, 3);
assert.equal((await parchmentMessages(player)).at(-1).parchment.title, manual.title);

const backup = await get(pj, '&download=backup');
const restored = await post(null, 'restore', {backup});
assert.deepEqual(restored.game.messages.filter(m => m.parchment), await parchmentMessages(pj));
assert(restored.game.mapNotes.every(item => item.parchmentRevealed === true));
console.log('PASS: parchment entry, intermediate crossing, floor travel, manual publishing, privacy, revisions, replay and backup.');
