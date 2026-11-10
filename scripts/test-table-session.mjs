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
const homeSlots = [];
let workspaceSlots = [];
let workspaceKey;
let slots = homeSlots;
let cursor = 0;
let pollEffect;
const react = {
  useState(initial) {
    const index = cursor++;
    const state = slots;
    if (!(index in state))
      state[index] = typeof initial === 'function' ? initial() : initial;
    return [
      state[index],
      (value) => {
        state[index] =
          typeof value === 'function' ? value(state[index]) : value;
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
const jsx = (type, props, key) => ({ type, props, key });
const requests = [];
const storage = new Map([['stul-session', JSON.stringify(roomA)]]);
const pollTimers = new Map();
const network = { onLine: true };
let timerId = 0;
const context = vm.createContext({
  AbortController,
  URLSearchParams,
  crypto,
  navigator: network,
  window: new EventTarget(),
  fetch(url, options) {
    return new Promise((finish, fail) => {
      requests.push({
        url,
        token: options.headers.Authorization,
        etag: options.headers['If-None-Match'],
        signal: options.signal,
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
  setTimeout(callback, delay) {
    const id = ++timerId;
    pollTimers.set(id, { callback, delay });
    return id;
  },
  clearTimeout: (id) => pollTimers.delete(id),
});

const realModules = new Set(
  [
    'app/page.tsx',
    'components/game-table/table-workspace.tsx',
    'components/game-table/use-table-session.ts',
    'components/game-table/game-client.ts',
    'lib/game-view-wire.ts',
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
    for (const extension of ['.ts', '.tsx'])
      if (realModules.has(path + extension)) return load(path + extension);
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
const Workspace = load(
  resolve('components/game-table/table-workspace.tsx'),
).default;
function render() {
  slots = homeSlots;
  cursor = 0;
  const root = Home();
  if (root.type !== Workspace) {
    workspaceSlots = [];
    workspaceKey = undefined;
    return root;
  }
  if (workspaceKey !== root.key) {
    workspaceSlots = [];
    workspaceKey = root.key;
  }
  slots = workspaceSlots;
  cursor = 0;
  return Workspace(root.props);
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
const header = (tree) => find(tree, './table-header');
const sidebar = (tree) => find(tree, './party-sidebar');
const notifications = (tree) => find(tree, '../map-note-notifications');
const dialog = (tree) => find(tree, './table-dialog');
const chat = (tree) => find(tree, './chat-panel');

render();
let stopPolling = pollEffect();
take(roomA).finish(response(gameA));
await flush();
stopPolling();

let table = render();
assert.equal(header(table).game.title, gameA.title);
chat(table).setDraft({ text: 'Rozepsaná zpráva z A' });
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
assert.equal(
  chat(table).draft.text,
  '',
  'a new workspace has no old chat draft',
);
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

table = render();
notifications(table).onOpen(
  { ...noteB, id: 'encounter-b', noteId: noteB.id },
  () => assert.fail('opening an encounter action must not dismiss the note'),
  { kind: 'loot', id: 'loot-b' },
);
take(renewed, 'cellar-b').finish(
  response({
    ...floor('cellar-b', 4),
    mapNotes: [{ id: noteB.id, levelId: noteB.levelId, x: 2, y: 3 }],
    noteAlerts: [
      { id: 'encounter-b', encounter: [{ kind: 'loot', id: 'loot-b' }] },
    ],
  }),
);
await flush();
table = render();
assert.equal(dialog(table).modal, 'loot');
assert.equal(dialog(table).selection.lootId, 'loot-b');

const slowAction = sidebar(table).act('notes', { notes: 'pomalý zápis' });
const slowRequest = requests.shift();
assert.equal(slowRequest.url, '/api/game');
const fastReload = dialog(table).reloadEquipment();
take(renewed, 'cellar-b').finish(response(floor('cellar-b', 4)));
assert.equal(await fastReload, true);
assert.equal(
  sidebar(render()).busy,
  true,
  'the write is still outstanding after reload completes',
);
slowRequest.finish(response({ game: floor('cellar-b', 5) }));
assert.equal(await slowAction, true);
assert.equal(sidebar(render()).busy, false);

const ChatPanel = load(resolve('components/game-table/chat-panel.tsx')).default;
function findControl(node, predicate) {
  if (Array.isArray(node))
    return node.map((child) => findControl(child, predicate)).find(Boolean);
  if (predicate(node)) return node.props;
  return node?.props ? findControl(node.props.children, predicate) : undefined;
}
function composer() {
  const props = chat(render());
  slots = [];
  cursor = 0;
  const panel = ChatPanel({ ...props, game: { ...props.game, messages: [] } });
  return {
    form: findControl(
      panel,
      (node) =>
        node?.type === 'form' && node.props.className === 'message-input',
    ),
    input: findControl(
      panel,
      (node) => node?.type === 'input' && node.props['aria-label'] === 'Zpráva',
    ),
  };
}
function typeMessage(text) {
  composer().input.onChange({ target: { value: text } });
}
function sendDraft() {
  const done = composer().form.onSubmit({ preventDefault() {} });
  const request = requests.shift();
  assert.equal(request.url, '/api/game');
  return { done, request };
}

typeMessage('První zpráva');
const firstMessage = sendDraft();
typeMessage('Druhá zpráva');
firstMessage.request.finish(response({ game: floor('cellar-b', 6) }));
await firstMessage.done;
assert.equal(composer().input.value, 'Druhá zpráva');

const repeatedText = sendDraft();
typeMessage('');
typeMessage('Druhá zpráva');
repeatedText.request.finish(response({ game: floor('cellar-b', 7) }));
await repeatedText.done;
assert.equal(
  composer().input.value,
  'Druhá zpráva',
  'retyping identical text is still a new draft',
);

const rejected = sendDraft();
rejected.request.finish(
  response({ error: 'Zprávu se nepodařilo odeslat' }, 400),
);
await rejected.done;
assert.equal(composer().input.value, 'Druhá zpráva');

const accepted = sendDraft();
accepted.request.finish(response({ game: floor('cellar-b', 8) }));
await accepted.done;
assert.equal(composer().input.value, '');
console.log(
  'PASS: the table stays busy until the last action finishes, and chat acknowledges only the submitted draft.',
);

// Drive the real polling effect with a stalled transport and a network flap.
context.window = new EventTarget();
pollTimers.clear();
assert.equal(requests.length, 0);
const { useGamePolling } = load(
  resolve('components/game-table/use-game-polling.ts'),
);
const scope = { session: roomA };
const updates = [];
let connection = '';
function PollingHarness() {
  useGamePolling({
    scope,
    sessionCurrent: { current: scope },
    view: { levelId: 'ground' },
    isCurrentView: () => true,
    changeSession: () =>
      assert.fail('a transport failure must preserve the session'),
    acceptGame: (_, game) => updates.push(game.revision),
    setConnectionError: (message) => {
      connection = message;
    },
  });
}
PollingHarness();
const stop = pollEffect();
function runTimer(delay) {
  assert.equal(pollTimers.size, 1);
  const [[id, timer]] = pollTimers;
  assert.equal(timer.delay, delay);
  pollTimers.delete(id);
  timer.callback();
}
const stalled = take(roomA, 'ground');
stalled.signal.addEventListener(
  'abort',
  () => stalled.fail(stalled.signal.reason),
  { once: true },
);
runTimer(30_000);
await flush();
assert.equal(stalled.signal.aborted, true);
assert(connection);
for (const delay of [2_000, 4_000, 8_000, 16_000, 30_000]) {
  runTimer(delay);
  take(roomA, 'ground').fail(new TypeError('lost network'));
  await flush();
}
assert.equal([...pollTimers.values()][0].delay, 30_000);
network.onLine = false;
context.window.dispatchEvent(new Event('offline'));
assert.equal(pollTimers.size, 0);
assert.equal(requests.length, 0);
network.onLine = true;
context.window.dispatchEvent(new Event('online'));
take(roomA, 'ground').finish(
  new Response(JSON.stringify(gameA), { headers: { ETag: '"known"' } }),
);
await flush();
assert.deepEqual(updates, [gameA.revision]);
assert.equal(connection, '');
runTimer(2_000);
const interrupted = take(roomA, 'ground');
assert.equal(interrupted.etag, '"known"');
network.onLine = false;
context.window.dispatchEvent(new Event('offline'));
assert.equal(interrupted.signal.aborted, true);
network.onLine = true;
context.window.dispatchEvent(new Event('online'));
const resumed = take(roomA, 'ground');
assert.equal(resumed.etag, '"known"');
resumed.finish(new Response(null, { status: 304 }));
interrupted.finish(response({ ...gameA, revision: 99 }));
await flush();
assert.deepEqual(updates, [gameA.revision]);
assert.equal(connection, '');
runTimer(2_000);
const obsolete = take(roomA, 'ground');
stop();
assert.equal(obsolete.signal.aborted, true);
obsolete.finish(response(gameB));
await flush();
assert.equal(pollTimers.size, 0);
assert.deepEqual(updates, [gameA.revision]);
console.log(
  'PASS: polling times out, backs off, waits offline, resumes immediately, reuses its ETag and ignores obsolete responses.',
);
