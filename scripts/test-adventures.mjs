import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:5173';
async function post(action, data, session) {
  const response = await fetch(base + '/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session && { Authorization: 'Bearer ' + session.token }) },
    body: JSON.stringify({ action, room: session?.room, ...data }),
  });
  return { status: response.status, ...await response.json() };
}
async function get(session, extra = {}) {
  const query = new URLSearchParams({ room: session.room, ...extra });
  const response = await fetch(base + '/api/game?' + query, { headers: { Authorization: 'Bearer ' + session.token } });
  assert.equal(response.status, 200);
  return response.json();
}

const listing = await fetch(base + '/api/adventures');
assert.equal(listing.status, 200);
const catalog = await listing.json();
assert(catalog.some(entry => entry.id === 'ztraceny-zvon'));
for (const entry of catalog) assert.deepEqual(Object.keys(entry).sort(), ['id', 'summary', 'title']);
assert.equal((await post('create', { adventureId: '__proto__' })).status, 400);
const blank = await post('create', { name: 'Vlastní PJ' });
assert.equal(blank.status, 200);
assert.deepEqual(blank.game.dungeon.floors, []);

const pj = await post('create', { name: 'PJ předlohy', adventureId: 'ztraceny-zvon' });
assert.equal(pj.status, 200, pj.error);
assert.equal(pj.game.title, 'Ztracený zvon');
assert.equal(pj.game.exploration.levels.length, 2);
const entrance = pj.game.mapNotes.find(note => note.title === 'Zavalená vrátnice');
assert(entrance.parchmentOnEntry && entrance.secret && !entrance.shared);

const lastLevel = pj.game.exploration.levels[1].id;
const prepared = await get(pj, { level: lastLevel });
const goal = prepared.mapNotes.find(note => note.title === 'Zvon pod hladinou');
assert(goal.parchmentOnEntry && goal.secret && !goal.shared);
assert(prepared.monsters.some(monster => monster.templateId === 'vodnik' && monster.x === goal.x && monster.y === goal.y));

const player = await post('join', { room: pj.room, name: 'Průzkumnice' });
assert.equal(player.status, 200);
const playerView = await get(player, { level: lastLevel });
assert.deepEqual(playerView.dungeon.floors, []);
assert.deepEqual(playerView.mapNotes, []);
assert.deepEqual(playerView.monsters, []);
assert.equal(playerView.notes, '');

const backup = await get(pj, { download: 'backup' });
const restored = await post('restore', { backup });
assert.equal(restored.status, 200, restored.error);
const restoredLevel = await get(restored, { level: lastLevel });
assert.deepEqual(restoredLevel.mapNotes, prepared.mapNotes);
assert.deepEqual(restoredLevel.monsters, prepared.monsters);
console.log('PASS: katalog bez tajné přípravy, vytvoření předlohy, skryté místnosti a příšery, úplná záloha a obnova.');
