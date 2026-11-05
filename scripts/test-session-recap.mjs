import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:5173';
async function post(session, action, data = {}, status = 200) {
  const response = await fetch(base + '/api/game', {
    method: 'POST',
    headers: {'Content-Type':'application/json', ...(session ? {Authorization:'Bearer '+session.token} : {})},
    body: JSON.stringify({action, room:session?.room, requestId:crypto.randomUUID(), ...data}),
  });
  const result = await response.json();
  assert.equal(response.status, status, result.error);
  return result;
}
async function get(session, query = '') {
  const response = await fetch(base + '/api/game?room=' + session.room + query, {
    headers: {Authorization:'Bearer '+session.token},
  });
  assert.equal(response.status, 200);
  return response.json();
}

const pj = await post(null, 'create', {name:'PJ kroniky'});
const player = await post(null, 'join', {room:pj.room, name:'Ela'});
const recap = {summary:'  Družina našla starý most.  ', clues:'Kdo rozsvěcí lucernu?', mapPoint:'current', expectedRevision:null};
assert.equal((await get(player)).sessionRecap, undefined);
await post(player, 'session-recap', recap, 403);
await post(pj, 'session-recap', recap, 400);
await post(pj, 'map', {tool:'room', from:[1,1], to:[8,8]});
await post(pj, 'explore', {op:'place', levelId:'ground', x:4, y:4});
await post(pj, 'session-recap', {...recap, summary:'  '}, 400);
await post(pj, 'session-recap', {...recap, clues:'x'.repeat(801)}, 400);
await post(pj, 'session-recap', {...recap, mapPoint:'other'}, 400);

const requestId = crypto.randomUUID();
const first = (await post(pj, 'session-recap', {...recap, requestId})).game.sessionRecap;
assert.equal(first.summary, recap.summary.trim());
assert.deepEqual(first.location, {levelId:'ground', levelName:'Přízemí', x:4, y:4});
assert.deepEqual((await get(player)).sessionRecap, first);
assert(!('requestId' in first));
assert.deepEqual((await post(pj, 'session-recap', {...recap, requestId})).game.sessionRecap, first);
await post(pj, 'session-recap', recap, 409);

const added = await post(pj, 'explore', {op:'level-add', name:'Sklep'});
const basement = added.game.exploration.levels[1].id;
await post(pj, 'map', {tool:'room', levelId:basement, from:[1,1], to:[8,8]});
await post(pj, 'explore', {op:'place', levelId:basement, x:5, y:5});
assert.deepEqual((await get(player)).sessionRecap.location, first.location, 'Moving the party does not move the saved point');
await post(pj, 'explore', {op:'battle-start', levelId:basement});
await post(pj, 'session-recap', {...recap, expectedRevision:first.revision}, 400);
await post(pj, 'map', {tool:'hide', levelId:'ground', from:[4,4], to:[4,4]});
const privateMapPoint = (await get(player)).sessionRecap;
assert.equal(privateMapPoint.location, undefined);
assert.equal(privateMapPoint.summary, first.summary);
assert.deepEqual((await get(pj)).sessionRecap.location, first.location);

const savedBackup = await get(pj, '&download=backup');
const restored = await post(null, 'restore', {backup:savedBackup});
assert.deepEqual(restored.game.sessionRecap, first);
const legacy = structuredClone(savedBackup);
delete legacy.game.sessionRecap;
assert.equal((await post(null, 'restore', {backup:legacy})).game.sessionRecap, undefined);

const keep = (await post(pj, 'session-recap', {...recap, mapPoint:'keep', summary:'Připsaná vzpomínka.', expectedRevision:first.revision})).game.sessionRecap;
assert.deepEqual(keep.location, first.location);
const cleared = (await post(pj, 'session-recap', {...recap, mapPoint:'clear', expectedRevision:keep.revision})).game.sessionRecap;
assert.equal(cleared.location, undefined);
assert.deepEqual((await get(player)).sessionRecap, cleared);
console.log('PASS: shared recap, GM-only edits, captured location, hidden map privacy, replay, conflicts and backup.');
