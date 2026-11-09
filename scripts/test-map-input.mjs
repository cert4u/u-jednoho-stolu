import assert from 'node:assert/strict';
await import('./generator-test-import.mjs');
const { createMapCommands } = await import(
  '../components/dungeon-map/input-commands.ts'
);
const { handleMapKey } = await import(
  '../components/dungeon-map/keyboard-input.ts'
);
const { mapPointerGeometry } = await import(
  '../components/dungeon-map/pointer-geometry.ts'
);
const { W, H, WIDTH, HEIGHT, PAD, SIZE } = await import(
  '../components/dungeon-map/model.ts'
);
const { emptyDungeon } = await import('../lib/dungeon.ts');

for (const zoom of [0.4, 1, 1.6]) {
  const box = {
    left: 100,
    top: 60,
    width: WIDTH * zoom,
    height: HEIGHT * zoom,
  };
  const hit = mapPointerGeometry(
    {
      clientX: 100 + (PAD + 2.2 * SIZE) * zoom,
      clientY: 60 + (PAD + 3.05 * SIZE) * zoom,
    },
    box,
  );
  assert.deepEqual(hit.cell, [2, 3]);
  assert.deepEqual(hit.vertex, [2, 3]);
  assert.equal(hit.edge, 'h:2:3');
  assert(hit.nearEdge);
  const outside = mapPointerGeometry(
    {
      clientX: box.left + box.width + 500,
      clientY: box.top + box.height + 500,
    },
    box,
  );
  assert.deepEqual(outside.cell, [W - 1, H - 1]);
  assert.deepEqual(outside.vertex, [W, H]);
}
let retry = null;
const calls = [],
  lock = { current: false };
let succeed = false;
const onAction = async (action, payload) => {
  calls.push({ action, payload });
  return succeed;
};
const context = {
  onAction,
  exploration: { levelId: 'ground', enabled: true, battle: { id: 'fight' } },
  members: [{ id: 'hero', x: 3, y: 4 }],
  pj: false,
  me: 'hero',
  selected: '',
  canLead: false,
  busy: false,
  lock,
  retry,
  setRetry: (value) => {
    retry = typeof value === 'function' ? value(retry) : value;
  },
};
let commands = createMapCommands(context);
await commands.sendMap({ tool: 'floor', points: [[2, 3]] });
assert.equal(lock.current, false);
assert(retry);
const failed = retry;
assert(failed.requestId);
succeed = true;
commands = createMapCommands({ ...context, retry });
await commands.retryMap();
assert.equal(retry, null);
assert.deepEqual(calls[1], calls[0]);
assert.strictEqual(
  calls[1].payload,
  failed,
  'Retry reuses the payload and operation ID.',
);
await commands.moveCharacter([8, 8], 'other');
assert.equal(calls.length, 2);
await commands.moveCharacter([8, 8]);
assert.deepEqual(calls.at(-1).payload.expected, { x: 3, y: 4 });
assert.equal(calls.at(-1).payload.memberId, 'hero');
let release;
const pending = createMapCommands({
  ...context,
  onAction: async () =>
    await new Promise((resolve) => {
      release = resolve;
    }),
});
const inFlight = pending.sendExplore('move', { x: 4, y: 4 });
assert(lock.current);
assert.equal(await pending.placeParty([5, 4]), false);
assert.equal(await pending.moveMonster('m', [5, 4]), false);
assert.equal(await pending.sendMap({ tool: 'floor', points: [[5, 4]] }), false);
assert.equal(
  await createMapCommands({ ...context, retry: failed }).retryMap(),
  false,
);
assert.equal(
  calls.length,
  3,
  'overlapping writes cannot bypass the shared lock',
);
release(true);
await inFlight;
assert(!lock.current);
const broken = createMapCommands({
  ...context,
  onAction: async () => {
    throw new Error('offline');
  },
});
await assert.rejects(
  broken.sendMap({ tool: 'floor', points: [[1, 1]] }),
  /offline/,
);
assert(!lock.current);
await assert.rejects(broken.sendExplore('move'), /offline/);
assert(!lock.current);

const actions = [],
  mapCommands = [];
let cancelled = 0,
  sceneryCancelled = 0,
  prevented = 0;
const state = {
  effectiveTool: 'room',
  busy: false,
  preview: false,
  lock,
  retry: null,
  pj: true,
  me: 'pj',
  canLead: true,
  selected: 'hero',
  map: emptyDungeon(),
  keyboard: [2, 3],
  keyboardStart: null,
  onCancelScenery: () => sceneryCancelled++,
  cancel: () => cancelled++,
  setKeyboard: (value) => {
    state.keyboard =
      typeof value === 'function' ? value(state.keyboard) : value;
  },
  setKeyboardStart: (value) => {
    state.keyboardStart = value;
  },
  sendMap: (command) => mapCommands.push(command),
  onAction: async (action, data) => {
    actions.push({ action, data });
    return true;
  },
  onScenery: (point, id) => actions.push({ scenery: point, id }),
  setInspection: (value) => actions.push({ inspection: value }),
  onOpenNote: (anchor, publicView) => actions.push({ anchor, publicView }),
  onInspectMonster: (id) => actions.push({ monster: id }),
};
const key = (key) =>
  handleMapKey(
    { key, preventDefault: () => prevented++ },
    {
      ...createMapCommands({ ...state, members: context.members }),
      ...state,
    },
  );
key('Enter');
assert.deepEqual(state.keyboardStart, [2, 3]);
assert.equal(mapCommands.length, 0);
state.keyboard = [5, 6];
key('Enter');
assert.deepEqual(mapCommands.pop(), { tool: 'room', from: [2, 3], to: [5, 6] });
assert.equal(state.keyboardStart, null);
state.effectiveTool = 'door';
key('Enter');
assert.deepEqual(mapCommands.pop(), { tool: 'door', edges: ['h:5:6'] });
state.effectiveTool = 'erase';
key('Enter');
assert.deepEqual(mapCommands.pop(), {
  tool: 'erase',
  cells: [[5, 6]],
  edges: ['h:5:6'],
});
for (const blocking of ['busy', 'preview', 'retry']) {
  state[blocking] = true;
  key('Enter');
  state[blocking] = blocking === 'retry' ? null : false;
  assert.equal(mapCommands.length, 0);
}
lock.current = true;
key('Enter');
assert.equal(mapCommands.length, 0);
key('Escape');
assert.equal(cancelled, 1);
assert.equal(sceneryCancelled, 1);
lock.current = false;
state.keyboard = [W - 1, H - 1];
key('ArrowRight');
key('ArrowDown');
assert.deepEqual(state.keyboard, [W - 1, H - 1]);
state.keyboard = [0, 0];
key('ArrowLeft');
key('ArrowUp');
assert.deepEqual(state.keyboard, [0, 0]);
state.effectiveTool = 'move';
state.exploration = { enabled: true, battle: { id: 'fight' } };
key('Enter');
let sent = actions.pop();
assert.equal(sent.action, 'explore');
assert.equal(sent.data.op, 'battle-move');
assert.equal(sent.data.memberId, 'hero');
await new Promise(setImmediate);
state.exploration = { enabled: true };
state.canLead = false;
key('Enter');
assert.equal(actions.length, 0);
state.canLead = true;
key('Enter');
sent = actions.pop();
assert.equal(sent.data.op, 'move');
assert.equal(sent.data.x, 0);
assert.equal(sent.data.y, 0);
await new Promise(setImmediate);

const sharedTools = [
  [
    'monster',
    'monster',
    'move',
    (commands) => commands.moveMonster('m', [0, 0]),
  ],
  ['place', 'explore', 'place', (commands) => commands.placeParty([0, 0])],
  ['openDoor', 'explore', 'door', (commands) => commands.toggleDoor('h:0:0')],
];
state.selectedCreature = { id: 'm' };
for (const [tool, action, op, pointer] of sharedTools) {
  state.effectiveTool = tool;
  key('Enter');
  const fromKeyboard = actions.pop();
  await new Promise(setImmediate);
  await pointer(createMapCommands({ ...state, members: context.members }));
  const fromPointer = actions.pop();
  assert.equal(fromKeyboard.action, action);
  assert.equal(fromKeyboard.data.op, op);
  const { requestId: keyboardId, ...keyboardData } = fromKeyboard.data;
  const { requestId: pointerId, ...pointerData } = fromPointer.data;
  assert(keyboardId && pointerId && keyboardId !== pointerId);
  assert.deepEqual(keyboardData, pointerData);
}
state.effectiveTool = 'scenery';
state.surfaceBrush = { kind: 'water-area', op: 'add', hidden: false };
key('Enter');
assert.deepEqual(mapCommands.pop(), {
  tool: 'surface',
  ...state.surfaceBrush,
  points: [[0, 0]],
});
assert(prevented > 0);
console.log(
  'PASS: pointer projection across zooms, exact map retry IDs, shared exploration lock, ownership, exception cleanup and keyboard tools/guards/bounds.',
);
