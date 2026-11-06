import assert from 'node:assert/strict';
import { generateDungeon } from './generator-test-import.mjs';

const { adventureTemplates, resolveAdventureRooms } = await import('../lib/adventure-templates.ts');
const { findDungeonPreset } = await import('../lib/dungeon-presets.ts');
const base = process.argv[2] || 'http://127.0.0.1:5173';

async function post(action, data, session) {
  const response = await fetch(base + '/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session && { Authorization: 'Bearer ' + session.token }) },
    body: JSON.stringify({ action, requestId: crypto.randomUUID(), room: session?.room, ...data }),
  });
  return { status: response.status, ...await response.json() };
}
async function get(session, extra = {}, status = 200) {
  const query = new URLSearchParams({ room: session.room, ...extra });
  const response = await fetch(base + '/api/game?' + query, { headers: { Authorization: 'Bearer ' + session.token } });
  assert.equal(response.status, status);
  return response.json();
}

const listing = await fetch(base + '/api/adventures');
assert.equal(listing.status, 200);
assert.deepEqual(await listing.json(), adventureTemplates.map(({ id, title, summary }) => ({ id, title, summary })));
assert.equal((await post('create', { adventureId: '__proto__' })).status, 400);
const blank = await post('create', { name: 'Vlastní PJ' });
assert.equal(blank.status, 200);
assert.deepEqual(blank.game.dungeon.floors, []);

for (const template of adventureTemplates) {
  const draft = generateDungeon(findDungeonPreset(template.dungeonPreset).options);
  const rooms = resolveAdventureRooms(template, draft.floors);
  const pj = await post('create', { name: 'PJ předlohy', adventureId: template.id });
  assert.equal(pj.status, 200, pj.error);
  assert.equal(pj.game.title, template.title);
  assert.equal(pj.game.exploration.levels.length, draft.floors.length);
  const player = await post('join', { room: pj.room, name: 'Průzkumnice' });
  assert.equal(player.status, 200);
  const backup = await get(pj, { download: 'backup' });
  const restored = await post('restore', { backup });
  assert.equal(restored.status, 200, restored.error);

  const levelIds = pj.game.exploration.levels.map(level => level.id);
  const links = draft.stairs.map(({ from, to, a, b }) => ({
    a: { levelId: levelIds[from], x: a[0], y: a[1] },
    b: { levelId: levelIds[to], x: b[0], y: b[1] },
  }));
  const restoredBackup = await get(restored, { download: 'backup' });
  assert.equal(restoredBackup.version, backup.version);
  for (const field of ['atlas', 'mapNotes', 'monsters', 'generationRuns'])
    assert.deepEqual(restoredBackup.game[field], backup.game[field]);
  assert.deepEqual(backup.game.atlas.stairs.map(({ a, b }) => ({ a, b })), links);

  for (const [index, levelId] of levelIds.entries()) {
    const prepared = await get(pj, { level: levelId });
    const playerView = await get(player, { level: levelId });
    assert.deepEqual(playerView.dungeon.floors, []);
    assert.deepEqual(playerView.mapNotes, []);
    assert.deepEqual(playerView.monsters, []);
    assert.equal(playerView.notes, '');
    const forbidden = new Set(prepared.mapNotes.map(note => `${note.x},${note.y}`));
    for (const key of Object.keys(prepared.dungeon.stairMarks ?? {})) forbidden.add(key);
    for (const point of Object.values(prepared.dungeon.access ?? {})) forbidden.add(point.join(','));
    const occupied = new Set();
    const floorRooms = rooms.filter(({ placement }) => placement.floor === index + 1);
    let nextMonster = 0;
    for (const { room, roomNumber, placement } of floorRooms) {
      const note = prepared.mapNotes.find(note => note.roomNumber === roomNumber);
      assert.equal(note.title, placement.title);
      assert.equal(note.text, placement.playerText);
      assert.equal(note.secret, placement.gmNotes);
      assert.equal(Boolean(note.parchmentOnEntry), Boolean(placement.playerText));
      assert.equal(note.shared, false);
      const available = room.cells.filter(key => prepared.dungeon.floors.includes(key) && !forbidden.has(key) && !occupied.has(key));
      for (const [monsterIndex, id] of (placement.monsters ?? []).entries()) {
        const monster = prepared.monsters[nextMonster++];
        assert.equal(monster.templateId, id);
        assert(monster.portrait);
        if (monsterIndex >= available.length) {
          assert.equal(monster.x, null);
          assert.equal(monster.y, null);
        } else {
          const key = `${monster.x},${monster.y}`;
          assert(available.includes(key) && !occupied.has(key), `${template.id}: ${id} na ${key}`);
          occupied.add(key);
        }
      }
    }
    assert.equal(prepared.monsters.length, nextMonster);
  }

  const [levelId] = levelIds;
  const { mapNotes } = await get(pj, { level: levelId });
  const note = mapNotes.find(candidate => candidate.parchmentOnEntry);
  const values = {
    op: 'save', levelId, x: note.x, y: note.y, noteId: note.id,
    expectedRevision: note.revision, roomNumber: note.roomNumber, title: note.title,
    text: note.text, secret: note.secret, publish: false, showParchment: true,
  };
  assert.equal((await post('map-note', values, player)).status, 403);
  assert.equal((await post('map-note', values, pj)).status, 200);
  const revealed = await get(player);
  assert(revealed.messages.some(message => message.parchment?.title === note.title && message.text === note.text));
  assert(!JSON.stringify(revealed).includes(note.secret));
  assert(!JSON.stringify(revealed).includes(template.gmNotes));
}

const pj = blank;
const player = await post('join', { room: pj.room, name: 'Hráč bez katalogu' });
assert.equal((await get(pj, { catalog: 'bestiary' })).find(entry => entry.id === 'giant-rat').gmHint.length > 0, true);
assert.equal(typeof (await get(player, { catalog: 'bestiary' }, 403)).error, 'string');
assert.equal(typeof (await get({ ...pj, token: 'wrong-token' }, { catalog: 'bestiary' }, 401)).error, 'string');
console.log('PASS: všechna dobrodružství, propojení pater, obsah místností, rozmístění příšer, odhalení situace, soukromí a obnova.');
