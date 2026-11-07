import assert from 'node:assert/strict';
import { generateDungeon } from './generator-test-import.mjs';
const { adventureTemplates } = await import('../lib/adventure-templates.ts');
const base = process.argv[2] || 'http://127.0.0.1:5173';
async function post(session, action, values = {}, expected = 200) {
  const response = await fetch(base + '/api/game', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.token } : {}) },
    body: JSON.stringify({ action, room: session?.room, requestId: crypto.randomUUID(), ...values }) });
  const result = await response.json();
  if (expected !== null) assert.equal(response.status, expected, result.error);
  return { ...result, status: response.status };
}
async function get(session, query = '') {
  const response = await fetch(base + '/api/game?room=' + session.room + query, { headers: { Authorization: 'Bearer ' + session.token } });
  assert.equal(response.status, 200);
  return response.json();
}
const pj = await post(null, 'create', { name: 'PJ osnovy' });
const player = await post(null, 'join', { room: pj.room, name: 'Hráčka' });
assert.deepEqual(pj.game.storyOutline, { revision: null, phases: {}, places: [] });
assert(!('storyOutline' in player.game));
await post(player, 'story-outline', { expectedRevision: null, phases: { challenge: {} } }, 403);
await post(pj, 'map', { tool: 'room', from: [1,1], to: [8,8] });
async function note(levelId, x, y, title) {
  return (await post(pj, 'map-note', { op: 'save', levelId, x, y, title, text: '', secret: 'Příprava ' + title,
    publish: false, expectedRevision: null })).game.mapNotes.find(item => item.x === x && item.y === y);
}
const first = await note('ground', 2, 2, 'Zavřená brána');
const second = await note('ground', 3, 3, 'Hlasy ze studny');
const basement = (await post(pj, 'explore', { op: 'level-add', name: 'Sklep osnovy' })).game.exploration.levels.at(-1).id;
await post(pj, 'map', { tool: 'room', levelId: basement, from: [1,1], to: [6,6] });
const third = await note(basement, 2, 2, 'Ztracená pečeť');
const before = await get(pj, '&download=backup');
const values = { expectedRevision: null, phases: {
  'entrance-obstacle': { title: 'Smlouva', notes: 'TAJNÁ OSNOVA', noteIds: [first.id] },
  challenge: { noteIds: [first.id, second.id, third.id], played: true },
} };
const requestId = crypto.randomUUID();
let outline = (await post(pj, 'story-outline', { ...values, requestId })).game.storyOutline;
assert.equal(outline.revision, 1);
assert.equal(outline.phases.challenge.title, '');
assert.equal(outline.places.find(place => place.id === third.id).levelName, 'Sklep osnovy');
assert.equal(outline.phases.challenge.noteIds.length, 3);
assert(!('operations' in outline));
assert.deepEqual((await post(pj, 'story-outline', { ...values, requestId })).game.storyOutline, outline);
await post(pj, 'story-outline', values, 409);
await post(pj, 'story-outline', { expectedRevision: 1, phases: { invalid: {} } }, 400);
await post(pj, 'story-outline', { expectedRevision: 1, phases: { challenge: { notes: 'x'.repeat(3001) } } }, 400);
await post(pj, 'story-outline', { expectedRevision: 1, phases: { challenge: { noteIds: [first.id, first.id] } } }, 400);
await post(pj, 'story-outline', { expectedRevision: 1, phases: { challenge: { noteIds: ['missing-note'] } } }, 409);
const after = await get(pj, '&download=backup');
assert.deepEqual(after.game.atlas, before.game.atlas, 'Story preparation must not change geometry or exploration.');
const restored = await post(null, 'restore', { backup: after });
assert.deepEqual((await get(restored)).storyOutline, outline);
const old = structuredClone(after); delete old.game.storyOutline;
const legacy = await post(null, 'restore', { backup: old });
assert.equal(legacy.game.storyOutline.revision, null);
const corrupt = structuredClone(after); corrupt.game.storyOutline.phases.challenge.noteIds.push('missing');
await post(null, 'restore', { backup: corrupt }, 400);
assert(!JSON.stringify(await get(player)).includes('TAJNÁ OSNOVA'));
assert(!('storyOutline' in await get(player, '&level=' + basement)));
const download = await fetch(base + '/api/game?room=' + pj.room + '&download=backup', { headers: { Authorization: 'Bearer ' + player.token } });
assert.equal(download.status, 403);

// Renumbering and moving keep stable links, on another floor as well.
await post(pj, 'map-note', { op: 'save', levelId: 'ground', x: 2, y: 2, noteId: first.id, expectedRevision: first.revision,
  title: 'Nové jméno brány', roomNumber: 99, text: '', secret: '', publish: false });
await post(pj, 'map-note', { op: 'move', levelId: 'ground', x: 2, y: 2, noteId: first.id, expectedRevision: first.revision + 1, toX: 4, toY: 4 });
outline = (await get(pj)).storyOutline;
assert(outline.phases.challenge.noteIds.includes(first.id));
assert.equal(outline.places.find(place => place.id === first.id).x, 4);
assert.equal(outline.places.find(place => place.id === first.id).roomNumber, 99);
await post(pj, 'map-note', { op: 'remove', levelId: 'ground', x: 4, y: 4, noteId: first.id, expectedRevision: first.revision + 2 });
const cleaned = (await get(pj)).storyOutline;
assert.equal(cleaned.revision, outline.revision + 1);
assert.equal(cleaned.phases['entrance-obstacle'].notes, 'TAJNÁ OSNOVA');
assert.deepEqual(cleaned.phases['entrance-obstacle'].noteIds, []);
assert.deepEqual(cleaned.phases.challenge.noteIds, [second.id, third.id]);
assert(cleaned.phases.challenge.played);
await post(pj, 'story-outline', { expectedRevision: outline.revision, phases: { challenge: {} } }, 409);
const race = await Promise.all(['První PJ', 'Druhý PJ'].map(title => post(pj, 'story-outline', {
  expectedRevision: cleaned.revision, phases: { resolution: { title } },
}, null)));
assert.deepEqual(race.map(result => result.status).sort(), [200, 409]);
assert.equal((await get(pj)).storyOutline.revision, cleaned.revision + 1);

for (const template of adventureTemplates) {
  const session = await post(null, 'create', { name: 'PJ předlohy osnovy', adventureId: template.id });
  const backup = await get(session, '&download=backup');
  for (const phase of new Set(template.rooms.map(room => room.phase).filter(Boolean))) {
    const placements = template.rooms.filter(room => room.phase === phase);
    const beat = session.game.storyOutline.phases[phase];
    assert.equal(beat.noteIds.length, placements.length);
    assert.deepEqual(beat.noteIds.map(id => backup.game.mapNotes.find(note => note.id === id)?.title).sort(), placements.map(room => room.title).sort());
  }
  if (!template.rooms.some(room => room.phase)) assert(!backup.game.storyOutline);
  else {
    const levelId = session.game.exploration.levels[0].id;
    const changed = await post(session, 'map', { levelId, tool: 'room', from: [24,18], to: [27,19] });
    assert.deepEqual(changed.game.storyOutline, session.game.storyOutline, 'Manual geometry edits must retain the outline.');
    const edited = await get(session, '&download=backup');
    assert.equal(edited.game.atlas.levels[0].map.generation.status, 'modified');
    assert.deepEqual((await post(null, 'restore', { backup: edited })).game.storyOutline, session.game.storyOutline);
  }
  const observer = await post(null, 'join', { room: session.room, name: 'Hráč předlohy' });
  assert(!('storyOutline' in observer.game));
}
const demo = adventureTemplates.find(template => template.id === 'dum-svetla');
assert.equal(new Set(demo.rooms.map(room => room.phase)).size, 5);
// Existing pure generator still runs without story fields.
const generated = generateDungeon({ version: 'v1', style: 'castle', variant: 0, name: 'Stará mapa', levels: 1, rooms: 6, size: 'small', corridors: 'direct', connections: 0, separateExit: false, seed: 'story-legacy' });
assert(!('storyOutline' in generated));
console.log('PASS: private optional story outline, multiple/shared/cross-floor links, edits, stable note IDs, deletion cleanup, replay/CAS races, templates with repeated/no phases, legacy and complete backups, unchanged geometry.');
