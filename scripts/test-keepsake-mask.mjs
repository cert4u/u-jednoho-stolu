import assert from 'node:assert/strict';
import { createElement, createRef, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerReactTestLoader } from './test-support/react-loader.mjs';
await import('./generator-test-import.mjs');
const { keepsakeFootprint, keepsakeProjection } = await import(
  '../components/dungeon-map/keepsake-mask.ts'
);
const { WIDTH, HEIGHT, PAD, SIZE } = await import(
  '../components/dungeon-map/model.ts'
);
const { emptyDungeon, editDungeon, playerDungeon } = await import(
  '../lib/dungeon.ts'
);

const empty = keepsakeFootprint(emptyDungeon());
assert.deepEqual(empty, { floor: '', edges: '' });
const map = { ...emptyDungeon(), floors: ['2,3'], edges: { 'v:3:3': 'door' } };
const footprint = keepsakeFootprint(map);
assert.equal(
  footprint.floor,
  `M${PAD + 2 * SIZE} ${PAD + 3 * SIZE}h${SIZE}v${SIZE}h${-SIZE}Z`,
);
assert.equal(
  footprint.edges,
  `M${PAD + 3 * SIZE} ${PAD + 3 * SIZE}L${PAD + 3 * SIZE} ${PAD + 4 * SIZE}`,
);
const paper = {
  left: 100,
  top: 80,
  width: WIDTH * 0.75,
  height: HEIGHT * 0.75,
};
const corner = { left: 500, top: 450, width: 330, height: 160 };
assert.deepEqual(
  keepsakeProjection(paper, corner),
  [0.75, 0, 0, 0.75, -400, -370],
);
const moved = keepsakeProjection({ ...paper, left: 200 }, corner);
assert.equal(
  moved[4],
  -300,
  'panning must move the occlusion, not the fixed sketch',
);
const smaller = keepsakeProjection(paper, {
  ...corner,
  width: 165,
  height: 80,
});
assert.deepEqual(smaller, [1.5, 0, 0, 1.5, -800, -740]);
assert.equal(keepsakeProjection(paper, { ...corner, width: 0 }), undefined);

const hook = registerReactTestLoader();
try {
  const { default: Atmosphere } = await import(
    '../components/table-atmosphere.tsx'
  );
  const refs = { mapSvg: createRef(), viewport: createRef(), zoom: 0.8 };
  const markup = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(Atmosphere, { ...refs, shown: map }),
      createElement(Atmosphere, { ...refs, shown: emptyDungeon() }),
    ),
  );
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(
    new Set(ids).size,
    ids.length,
    'multiple tables must not share filter or mask IDs',
  );
  assert.equal((markup.match(/class="table-keepsakes"/g) || []).length, 2);
  assert(markup.includes('mask-type:luminance'));
  assert(markup.includes('data-map-occlusion="true"'));
  assert(markup.includes('data-occlusion-halo="true"'));
  assert(markup.includes(`stdDeviation="${SIZE / 3}"`));

  // Exercise the actual editor wiring with a deliberately private source map.
  const { default: Editor } = await import('../components/dungeon-map.tsx');
  const privateMap = editDungeon(emptyDungeon(), {
    tool: 'room',
    from: [1, 1],
    to: [8, 6],
  });
  privateMap.revealed = ['2,2'];
  const known = playerDungeon(privateMap);
  const exploration = {
    enabled: true,
    leaderId: 'hero',
    order: [],
    radius: 4,
    levelId: 'ground',
    levelName: 'Přízemí',
    levels: [{ id: 'ground', name: 'Přízemí' }],
    visible: ['2,2'],
    stairs: [],
    playerMap: known,
  };
  const html = renderToStaticMarkup(
    createElement(Editor, {
      map: privateMap,
      exploration,
      members: [],
      monsters: [],
      notes: [],
      loot: [],
      challenges: [],
      me: 'hero',
      pj: false,
      busy: false,
      canUndo: false,
      selected: '',
      selectedMonster: '',
      generationPick: 0,
      monsterPick: 0,
      onAction: async () => true,
      onSelect() {},
      onLevel() {},
      onOpenNote() {},
      onInspectMonster() {},
      onOpenLoot() {},
      onOpenChallenge() {},
      onGenerate() {},
    }),
  );
  const floorPath = html.match(/data-occlusion="floor" d="([^"]*)"/)[1];
  assert.equal(floorPath, keepsakeFootprint(known).floor);
  assert.notEqual(
    floorPath,
    keepsakeFootprint(privateMap).floor,
    'ornament masking must not disclose unexplored rooms',
  );
  assert(html.includes('data-map-floor="2,2"'));
  console.log(
    'PASS: map/sketch camera projection, pan/resize, empty paper, unique masks and actual player editor use only displayed geometry.',
  );
} finally {
  hook.deregister();
}
