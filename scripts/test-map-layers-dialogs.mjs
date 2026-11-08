import assert from 'node:assert/strict';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerReactTestLoader } from './test-support/react-loader.mjs';
await import('./generator-test-import.mjs');
const hook = registerReactTestLoader();
const originalError = console.error,
  warnings = [];
console.error = (...args) => {
  warnings.push(args);
  originalError(...args);
};
try {
  const { default: Canvas } = await import(
    '../components/dungeon-map/canvas.tsx'
  );
  const { default: Notes } = await import(
    '../components/dungeon-map/layers/map-notes.tsx'
  );
  const { default: Dialog } = await import(
    '../components/game-table/table-dialog.tsx'
  );
  const { panelDetails } = await import(
    '../components/game-table/table-panel-details.ts'
  );
  const { initialGame } = await import('../lib/game.ts');
  const { gameView } = await import('../app/api/game/view.ts');
  const { emptyDungeon, editDungeon, playerDungeon } = await import(
    '../lib/dungeon.ts'
  );
  const original = editDungeon(emptyDungeon(), {
    tool: 'room',
    from: [1, 1],
    to: [4, 4],
  });
  original.revealed = ['2,2'];
  const shown = playerDungeon(original),
    member = {
      id: 'hero',
      name: 'Borin',
      role: 'player',
      hp: 6,
      maxHp: 12,
      x: 2,
      y: 2,
      color: '#777',
    };
  const note = {
    id: 'note',
    title: 'TAJNÝ NÁZEV PJ',
    roomNumber: 9,
    published: { title: 'Veřejná síň', text: 'Popis', roomNumber: 2 },
    shared: true,
    levelId: 'ground',
    x: 2,
    y: 2,
  };
  let opens = 0,
    focused;
  const no = () => {};
  const input = {
    svg: createRef(),
    zoom: 1,
    stroke: null,
    keyboard: [0, 0],
    keyboardStart: null,
    setKeyboard: (point) => {
      focused = point;
    },
    begin: no,
    drag: no,
    finish: no,
    cancel: no,
    lostCapture: no,
    keyAction: no,
    ctrlPan: false,
    space: false,
    effectiveTool: 'move',
    tool: 'move',
  };
  const props = {
    appearance: 'classic',
    input,
    map: {
      shown,
      revealed: new Set(shown.revealed),
      lit: new Set(['2,2']),
      visible: true,
    },
    members: [
      member,
      { ...member, id: 'hidden-hero', name: 'TAJNÝ HRÁČ', x: 3, y: 3 },
    ],
    monsters: [
      {
        id: 'visible',
        name: 'Skřet',
        number: 1,
        x: 2,
        y: 2,
        visibleToPlayers: true,
      },
      {
        id: 'hidden',
        name: 'TAJNÁ PŘÍŠERA',
        number: 2,
        x: 3,
        y: 3,
        visibleToPlayers: false,
      },
    ],
    notes: [
      note,
      {
        ...note,
        id: 'secret-note',
        title: 'TAJNÁ POZNÁMKA',
        shared: false,
        x: 3,
        y: 3,
      },
    ],
    busy: false,
    pj: true,
    preview: true,
    selected: 'hero',
    selectedMonster: 'visible',
    onOpenNote: () => opens++,
  };
  const before = structuredClone({
    map: shown,
    members: props.members,
    monsters: props.monsters,
    notes: props.notes,
  });
  for (const appearance of ['classic', 'hand-drawn']) {
    const html = renderToStaticMarkup(
      createElement(Canvas, { ...props, appearance }),
    );
    assert(html.includes('data-token="hero"'));
    assert(html.includes('data-monster="visible"'));
    assert(html.includes('Veřejná síň'));
    assert(html.includes('data-map-note="note"'));
    for (const secret of [
      'TAJNÝ NÁZEV PJ',
      'TAJNÝ HRÁČ',
      'TAJNÁ PŘÍŠERA',
      'TAJNÁ POZNÁMKA',
    ])
      assert(!html.includes(secret), secret);
  }
  assert.deepEqual(
    {
      map: shown,
      members: props.members,
      monsters: props.monsters,
      notes: props.notes,
    },
    before,
  );
  const markup = renderToStaticMarkup(
    createElement(Canvas, {
      ...props,
      preview: false,
      input: { ...input, stroke: { token: 'hero', end: [4, 5] } },
    }),
  );
  assert(markup.includes('Borin, políčko 5, 6'));
  const notesProps = {
    notes: [note],
    appearance: 'classic',
    busy: false,
    pj: true,
    shown,
    visible: true,
    lit: new Set(['2,2']),
    stroke: null,
    effectiveTool: 'move',
    space: false,
    setKeyboard: input.setKeyboard,
    onOpenNote: props.onOpenNote,
  };
  function findNote(element) {
    if (Array.isArray(element)) return element.map(findNote).find(Boolean);
    if (!element?.props) return;
    return element.props['data-map-note']
      ? element
      : findNote(element.props.children);
  }
  const target = findNote(Notes(notesProps));
  let stopped = 0,
    prevented = 0;
  target.props.onFocus();
  assert.deepEqual(focused, [2, 2]);
  target.props.onClick({ stopPropagation: () => stopped++, ctrlKey: false });
  assert.equal(opens, 1);
  target.props.onClick({ stopPropagation: () => stopped++, ctrlKey: true });
  assert.equal(opens, 1);
  target.props.onKeyDown({
    key: 'Enter',
    stopPropagation: () => stopped++,
    preventDefault: () => prevented++,
  });
  assert.equal(opens, 2);
  assert.equal(prevented, 1);
  findNote(Notes({ ...notesProps, busy: true })).props.onClick({
    stopPropagation: () => stopped++,
  });
  assert.equal(opens, 2);
  assert(stopped > 0);
  const source = initialGame('PJ', 'owner');
  source.members.push({
    ...source.members[0],
    id: 'player',
    token: 'player-token',
    name: 'Borin',
    role: 'player',
  });
  const actions = [],
    base = {
      dialog: createRef(),
      session: { room: 'test-room', token: 'owner' },
      busy: false,
      error: '',
      selection: {
        lootId: '',
        challengeId: '',
        noteAnchor: null,
        notePublic: false,
        noteOpenKey: 0,
        noteLevelName: 'Přízemí',
        rollSetup: { kind: 'ability', actor: { type: 'member', id: 'player' } },
        selectedMonster: '',
        recoveryCode: '',
        recoveryName: '',
      },
      act: async () => false,
      setModal: (value) => actions.push(['close', value]),
      setTab: (value) => actions.push(['tab', value]),
      openPanel: no,
      openRecovery: no,
      openLife: no,
      openLoot: no,
      openChallenges: no,
      openStoryPlace: no,
      locateRecap: no,
      placeMonster: no,
      openRoll: no,
      reloadEquipment: async () => true,
      copy: no,
      exportGame: no,
      leave: no,
    };
  for (const who of source.members) {
    const game = gameView(source, who.id),
      me = game.members.find((m) => m.id === who.id);
    for (const modal of Object.keys(panelDetails)) {
      const html = renderToStaticMarkup(
        createElement(Dialog, { ...base, modal, game, me }),
      );
      assert(html.includes('role="dialog"'));
      assert(html.includes(`aria-label="${panelDetails[modal].label}"`));
      if (
        who.role !== 'pj' &&
        [
          'notes',
          'monsters',
          'life',
          'conditions',
          'experience',
          'generator',
        ].includes(modal)
      )
        assert(html.includes('Vítej u jednoho stolu.'));
    }
  }
  const game = gameView(source, source.members[0].id),
    me = game.members[0];
  const failed = Dialog({ ...base, modal: 'notes', game, me });
  const submit = failed.props.children[0].props.submitAndClose;
  assert.equal(await submit('notes', { notes: 'Draft' }, true), false);
  assert.deepEqual(actions, []);
  const success = Dialog({
    ...base,
    modal: 'notes',
    game,
    me,
    act: async () => true,
    error: 'Test chyby',
  });
  assert.equal(
    await success.props.children[0].props.submitAndClose('notes', {}, true),
    true,
  );
  assert.deepEqual(actions, [
    ['tab', 'chat'],
    ['close', ''],
  ]);
  assert.equal(success.props.children[1].props.role, 'alert');
  console.log(
    'PASS: actual canvas layers retain fog/private previews, drag positions and note input; all dialog routes preserve role guards, framing, errors and close-after-success.',
  );
  assert.equal(
    warnings.length,
    0,
    'Presentation must render without React warnings.',
  );
} finally {
  console.error = originalError;
  hook.deregister();
}
