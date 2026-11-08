import assert from 'node:assert/strict';
await import('./generator-test-import.mjs');
const { initialInteraction, transitionMap, sameMapSignals } = await import(
  '../components/dungeon-map/interaction-state.ts'
);
const { readBrowserEntry } = await import(
  '../components/game-table/use-browser-entry.ts'
);
const { omitFields } = await import('../lib/objects.ts');
const { makeBackup } = await import('../lib/backup.ts');
const { initialGame } = await import('../lib/game.ts');
const { replacementConfig } = await import('../deploy/updater/docker.mjs');

const signals = {
  levelId: 'ground',
  generationPick: 0,
  monsterPick: 0,
  selected: '',
  pj: true,
};
let state = initialInteraction(signals);
assert.equal(state.tool, 'wall');
state = {
  ...state,
  tool: 'scenery',
  preview: true,
  inspection: { point: [2, 2] },
};
assert(
  sameMapSignals(state.signals, { ...signals }),
  'polling with unchanged triggers must not reset manual choices',
);
const copied = structuredClone(state);
const nextFloor = transitionMap(state, { ...signals, levelId: 'cellar' });
assert.deepEqual(
  state,
  copied,
  'state transition must not mutate the previous render',
);
assert.equal(nextFloor.tool, 'scenery');
assert.equal(nextFloor.preview, true);
assert.equal(nextFloor.inspection, null);
assert(nextFloor.cancelStroke > state.cancelStroke);
assert(nextFloor.resetStart > state.resetStart);

const generated = transitionMap(state, { ...signals, generationPick: 1 });
assert.equal(generated.tool, 'hand');
assert.equal(generated.preview, false);
const manual = { ...generated, tool: 'door', mode: 'play', preview: true };
const polling = transitionMap(manual, { ...generated.signals });
assert.equal(polling.tool, 'door');
assert.equal(polling.mode, 'play');
assert.equal(polling.preview, true);
const battle = transitionMap(state, { ...signals, battleId: 'battle-1' });
assert.equal(battle.tool, 'move');
assert.equal(battle.preview, false);
const monster = transitionMap(battle, { ...battle.signals, monsterPick: 1 });
assert.equal(monster.tool, 'monster');
const hero = transitionMap(monster, { ...monster.signals, selected: 'hero' });
assert.equal(hero.tool, 'move');
assert.equal(
  initialInteraction({
    ...signals,
    generationPick: 1,
    battleId: 'battle-1',
    monsterPick: 1,
    selected: 'hero',
  }).tool,
  'move',
);
assert.equal(
  transitionMap(state, { ...signals, monsterPick: 1, pj: false }).tool,
  'scenery',
);
assert.equal(
  transitionMap(hero, { ...hero.signals, battleId: undefined, selected: '' })
    .resetStart,
  hero.resetStart,
);

const session = { room: 'ROOM', token: 'private-token' };
assert.deepEqual(
  readBrowserEntry({ getItem: () => JSON.stringify(session) }, '?room=INVITE'),
  { session, code: 'INVITE', joining: true },
);
assert.deepEqual(readBrowserEntry(), {
  session: null,
  code: '',
  joining: false,
});
assert.deepEqual(
  readBrowserEntry({
    getItem() {
      throw Error('storage disabled');
    },
  }),
  readBrowserEntry(),
);
assert.deepEqual(
  readBrowserEntry({ getItem: () => '{broken' }),
  readBrowserEntry(),
);

const input = {
  token: 'secret',
  recoveryHash: 'hash',
  recoveryReplay: { previousHash: 'prior' },
  name: 'Hráč',
  hp: 8,
};
assert.deepEqual(
  omitFields(input, ['token', 'recoveryHash', 'recoveryReplay']),
  { name: 'Hráč', hp: 8 },
);
assert.equal(input.token, 'secret');
const game = initialGame('PJ', 'secret-token');
Object.assign(game.members[0], {
  recoveryHash: 'secret-hash',
  recoveryReplay: { previousHash: 'secret-prior' },
});
const backup = makeBackup(game),
  member = backup.game.members[0];
for (const key of ['token', 'recoveryHash', 'recoveryReplay'])
  assert(!Object.hasOwn(member, key), 'backup must not contain ' + key);
assert.equal(game.members[0].token, 'secret-token');

const oldConfig = {
  Env: ['CUSTOM=keep'],
  WorkingDir: '/app',
  Hostname: 'old',
  Domainname: 'old',
  Image: 'old',
  Cmd: ['old'],
  Entrypoint: ['old'],
  Healthcheck: {},
  OnBuild: [],
};
const old = {
  Config: oldConfig,
  HostConfig: { Binds: ['/data:/data'] },
  NetworkSettings: { Networks: { table: {} } },
};
const replacement = replacementConfig(old, 'new-image');
for (const key of [
  'Hostname',
  'Domainname',
  'Cmd',
  'Entrypoint',
  'Healthcheck',
  'OnBuild',
])
  assert(!Object.hasOwn(replacement, key));
assert.equal(replacement.Image, 'new-image');
assert.deepEqual(replacement.Env, oldConfig.Env);
assert.deepEqual(replacement.HostConfig, old.HostConfig);
assert.equal(oldConfig.Image, 'old');
console.log(
  'PASS: map signal transitions retain manual choices and ordering, storage bootstrap, private backup fields and Docker replacement exclusions.',
);
