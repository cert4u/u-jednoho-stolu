import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const roomA = { room: 'A', token: 'expired-a' };
const roomB = { room: 'B', token: 'valid-b' };
const members = [{ id: 'pj', role: 'pj' }];
const gameA = { title: 'Kampaň A', revision: 12, members, me: 'pj' };
const gameB = { title: 'Kampaň B', revision: 1, members, me: 'pj' };
const noteA = { id: 'note-a', levelId: 'cellar-a', levelName: 'Starý sklep' };
const noteB = { id: 'note-b', levelId: 'cellar-b', levelName: 'Nový sklep' };

// Execute the actual table and its session hooks. Drive renders and network
// completions independently so the expired requests cannot win by timing.
const slots = [];
let cursor = 0;
let pollEffect;
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in slots))
      slots[index] = typeof initial === 'function' ? initial() : initial;
    return [
      slots[index],
      (value) => {
        slots[index] =
          typeof value === 'function' ? value(slots[index]) : value;
      },
    ];
  },
  useRef(current) {
    const index = cursor++;
    return (slots[index] ??= { current });
  },
  useCallback: (callback) => callback,
  useEffect: (effect) => {
    pollEffect = effect;
  },
};
const jsx = (type, props) => ({ type, props });
const requests = [];
const storage = new Map([['stul-session', JSON.stringify(roomA)]]);
const context = vm.createContext({
  URLSearchParams,
  fetch(url, options) {
    return new Promise((finish, fail) => {
      requests.push({
        url,
        token: options.headers.Authorization,
        finish,
        fail,
      });
    });
  },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  setInterval: () => 1,
  clearInterval: () => {},
});

const realModules = new Set(
  [
    'app/page.tsx',
    'components/game-table/game-client.ts',
    'components/game-table/use-game-polling.ts',
    'components/game-table/use-game-view.ts',
    'components/game-table/use-map-note-navigation.ts',
    'components/game-table/use-panel-navigation.ts',
  ].map((file) => resolve(file)),
);
const loaded = new Map();
function load(file) {
  if (loaded.has(file)) return loaded.get(file);
  const exports = {};
  loaded.set(file, exports);
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const execute = vm.runInContext(
    `(function (exports, require) {${outputText}\n})`,
    context,
    { filename: file },
  );
  execute(exports, (id) => {
    if (id === 'react') return react;
    if (id === 'react/jsx-runtime')
      return { jsx, jsxs: jsx, Fragment: 'fragment' };
    const path = resolve(dirname(file), id);
    if (realModules.has(path + '.ts')) return load(path + '.ts');
    if (id.endsWith('/use-browser-entry'))
      return {
        useBrowserEntry: () => ({
          initial: { session: roomA, code: '', joining: false },
          ready: true,
        }),
      };
    if (id.endsWith('/room-situation'))
      return {
        useRoomSituations: () => ({ pendingIds: [] }),
        SituationOverlay: 'situation-overlay',
      };
    return new Proxy(
      { __esModule: true, default: id },
      {
        get: (target, name) => target[name] ?? name,
      },
    );
  });
  return exports;
}

const Home = load(resolve('app/page.tsx')).default;
function render() {
  cursor = 0;
  return Home();
}
function find(tree, type) {
  if (Array.isArray(tree))
    return tree.map((node) => find(node, type)).find(Boolean);
  if (tree?.type === type) return tree.props;
  return tree?.props ? find(tree.props.children, type) : undefined;
}
function take(room, level = '') {
  const request = requests.shift();
  assert.equal(
    new URL(request.url, 'http://localhost').searchParams.get('room'),
    room.room,
  );
  assert.equal(
    new URL(request.url, 'http://localhost').searchParams.get('level'),
    level,
  );
  assert.equal(request.token, 'Bearer ' + room.token);
  return request;
}
const flush = () => new Promise(setImmediate);
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status });
const header = (tree) => find(tree, '../components/game-table/table-header');
const sidebar = (tree) => find(tree, '../components/game-table/party-sidebar');
const notifications = (tree) =>
  find(tree, '../components/map-note-notifications');
const dialog = (tree) => find(tree, '../components/game-table/table-dialog');

render();
let stopPolling = pollEffect();
take(roomA).finish(response(gameA));
await flush();
stopPolling();

let table = render();
assert.equal(header(table).game.title, gameA.title);
sidebar(table).onLevel('floor-a');
table = render();
header(table).onAccount();
table = render();
const oldDialog = dialog(table);
const oldEquipment = oldDialog.reloadEquipment();
const equipmentA = take(roomA, 'floor-a');
notifications(table).onOpen({ ...noteA, noteId: noteA.id }, () =>
  assert.fail('obsolete note opened'),
);
const preparationA = take(roomA, 'cellar-a');

storage.set('stul-session', JSON.stringify(roomB));
stopPolling = pollEffect();
take(roomA, 'floor-a').finish(response({ error: 'Relace vypršela' }, 401));
await flush();
stopPolling();
table = render();
assert.equal(
  header(table),
  undefined,
  'the old campaign must disappear while B loads',
);

stopPolling = pollEffect();
take(roomB).finish(response(gameB));
await flush();
table = render();
assert.equal(
  header(table).game.title,
  gameB.title,
  'B starts at its own lower revision',
);
assert.equal(
  dialog(table),
  undefined,
  'the old panel closes at the session boundary',
);
assert.equal(notifications(table).loading, false);
assert.equal(await oldDialog.reloadEquipment(), false);
assert.equal(
  requests.length,
  0,
  'stale UI cannot initiate work in the new session',
);

header(table).onAccount();
table = render();
const newEquipment = dialog(table).reloadEquipment();
const equipmentB = take(roomB);
let opened = false;
notifications(table).onOpen({ ...noteB, noteId: noteB.id }, () => {
  opened = true;
});
const preparationB = take(roomB, 'cellar-b');

equipmentA.fail(new Error('stará chyba výbavy'));
preparationA.finish(response({ error: 'stará chyba přípravy' }, 403));
assert.equal(await oldEquipment, false);
await flush();
table = render();
assert.equal(dialog(table).busy, true);
assert.equal(dialog(table).error, '');
assert.equal(notifications(table).loading, true);

equipmentB.finish(response(gameB));
assert.equal(await newEquipment, true);
preparationB.finish(
  response({
    ...gameB,
    mapNotes: [{ id: noteB.id, levelId: noteB.levelId, x: 2, y: 3 }],
  }),
);
await flush();
table = render();
assert.equal(opened, true);
assert.equal(notifications(table).loading, false);
assert.equal(dialog(table).modal, 'map-note');
assert.equal(dialog(table).selection.mapNote.id, noteB.id);
stopPolling();

storage.set('stul-session', '{neplatný záznam');
stopPolling = pollEffect();
take(roomB, 'cellar-b').finish(response({ error: 'Místnost nenalezena' }, 404));
await flush();
stopPolling();
table = render();
assert.equal(header(table), undefined);
const lobby = find(table, '../components/game-table/lobby');
assert.equal(lobby.busy, false);
assert.equal(storage.has('stul-session'), false);

const recoveryCode = 'B:pj:recovery';
const recovered = lobby.act('recover', { room: roomB.room, recoveryCode });
const recovery = requests.shift();
assert.equal(recovery.token, undefined);
recovery.finish(
  response({ room: roomB.room, token: 'renewed-b', recoveryCode, game: gameB }),
);
assert.equal(await recovered, true);
table = render();
assert.equal(header(table).game.title, gameB.title);
assert.equal(dialog(table).modal, 'account');
assert.equal(dialog(table).selection.recoveryCode, recoveryCode);

console.log(
  'PASS: expired table adopts another campaign at a lower revision, resets its UI and isolates late equipment and note failures.',
);

const renewed = { ...roomB, token: 'renewed-b' };
const floor = (levelId, revision = 2) => ({
  ...gameB,
  revision,
  exploration: { levelId },
});
sidebar(table).onLevel('first');
table = render();
stopPolling = pollEffect();
const oldFloorPoll = take(renewed, 'first');
const oldFloorEquipment = dialog(table).reloadEquipment();
const lateEquipment = take(renewed, 'first');
const lateAction = sidebar(table).act('notes', { notes: 'test' });
const lateWrite = requests.shift();
assert.equal(lateWrite.url, '/api/game');

sidebar(table).onLevel('second');
table = render();
const stopSecond = pollEffect();
take(renewed, 'second').finish(response(floor('second')));
await flush();
table = render();
assert.equal(header(table).game.exploration.levelId, 'second');

lateEquipment.finish(response(floor('first')));
assert.equal(await oldFloorEquipment, false);
lateWrite.finish(response({ game: floor('first', 3) }));
assert.equal(await lateAction, true, 'the server still completed the mutation');
table = render();
assert.equal(header(table).game.exploration.levelId, 'second');
stopSecond();

sidebar(table).onLevel('first');
table = render();
const stopFirstAgain = pollEffect();
take(renewed, 'first').finish(
  response({ ...floor('first', 3), title: 'Aktuální A' }),
);
await flush();
// Deliberately deliver the first request before its effect cleanup can help.
oldFloorPoll.finish(response({ ...floor('first', 3), title: 'Staré A' }));
await flush();
table = render();
assert.equal(header(table).game.title, 'Aktuální A');
stopPolling();
stopFirstAgain();

let staleNoteOpened = false;
notifications(table).onOpen({ ...noteB, noteId: noteB.id }, () => {
  staleNoteOpened = true;
});
const lateNote = take(renewed, 'cellar-b');
sidebar(table).onLevel('second');
lateNote.finish(
  response({
    ...floor('cellar-b', 3),
    mapNotes: [{ id: noteB.id, levelId: noteB.levelId, x: 2, y: 3 }],
  }),
);
await flush();
table = render();
assert.equal(notifications(table).loading, false);
assert.equal(staleNoteOpened, false);
stopPolling = pollEffect();
take(renewed, 'second').finish(response(floor('second', 3)));
await flush();
assert.equal(header(render()).game.exploration.levelId, 'second');
stopPolling();

console.log(
  'PASS: delayed equipment, action, polling and note replies cannot replace a newer floor selection, even across A → B → A.',
);
