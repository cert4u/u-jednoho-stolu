import { registerReactTestLoader } from './test-support/react-loader.mjs';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
await import('./generator-test-import.mjs');

// Render the real presentation components, as in the generator preview tests.
const hook = registerReactTestLoader();
try {
  const { default: Header } = await import('../components/game-table/table-header.tsx');
  const { default: Sidebar, MobilePartyPanels } = await import('../components/game-table/party-sidebar.tsx');
  const { initialGame } = await import('../lib/game.ts');
  const { gameView } = await import('../app/api/game/view.ts');
  const original = initialGame('Pán jeskyně', 'owner-token');
  const owner = original.members[0];
  original.members.push({ ...owner, id: 'player', token: 'player-token', name: 'Borin', role: 'player', hp: 6, profession: 'Válečník' });
  const render = (Component, props) => renderToStaticMarkup(createElement(Component, props));
  for (const member of original.members) {
    const game = gameView(original, member.id), me = game.members.find(m => m.id === member.id);
    const props = { game, me, pj: member.role === 'pj', busy: false, act: async () => true,
      onOpen() {}, onLife() {}, onConditions() {}, onLevel() {}, selected: 'player',
      voicePresence: { player: { speaking: true, muted: false } }, onSelectMember() {}, onInvite() {}, onHelp() {},
      copied: false, connectionError: '', onEditScene() {}, onAward() {}, onAccount() {} };
    const header = render(Header, props), sidebar = render(Sidebar, props), mobile = render(MobilePartyPanels, props);
    assert(header.includes(game.title));
    assert(header.includes(game.scene));
    assert.equal(header.includes('Přidělit zkušenosti'), props.pj);
    assert.equal(header.includes('aria-label="Upravit scénu"'), props.pj);
    assert(sidebar.includes('chosen voice-speaking'));
    assert(sidebar.includes('aria-label="Právě mluví"'));
    assert(sidebar.includes('width:50%'));
    assert(sidebar.includes('Borin'));
    assert.equal(sidebar.includes('Zápisník PJ'), props.pj);
    assert.equal(mobile.includes('Generátor jeskyně'), props.pj);
    assert(mobile.includes('Družina, čas a patra'));
    assert(render(Header, { ...props, copied: true, connectionError: 'offline' }).includes('Připojování…'));
    assert(render(Header, { ...props, copied: true }).includes('Odkaz zkopírován'));
  }
  console.log('PASS: actual table layout retains PJ/player controls, desktop/mobile panels, selected speaking member, health and connection/invite states.');
} finally {
  hook.deregister();
}
