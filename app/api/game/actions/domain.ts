import { saveStoryOutline } from '../../../../lib/story-outline';
import { saveSessionRecap } from '../../../../lib/session-recap';
import { generationAction } from '../../../../lib/generation';
import { lifeAction } from '../../../../lib/life';
import { equipmentAction } from '../../../../lib/equipment';
import { lootAction } from '../../../../lib/loot';
import { challengeAction } from '../../../../lib/challenges';
import { mapNoteAction } from '../../../../lib/map-notes';
import { journeyAction } from '../../../../lib/journey';
import { recoveryAction } from '../../../../lib/recovery';
import { powerAction } from '../../../../lib/powers';
import { conditionAction } from '../../../../lib/conditions';
import { initiativeAction } from '../../../../lib/initiative';
import { mechanicsAction } from '../../../../lib/mechanics';
import { monsterAction } from '../../../../lib/monsters';
import { awardExperience } from '../../../../lib/experience';
import { updateCharacter, EditConflict } from '../../../../lib/sheets';
import type { Game, Member } from '../../../../lib/game';
import type { CatalogResolver } from '../../../../lib/catalogs/resolver';
import { fail } from '../responses';

export type ActionResult = { recoveryCode?: string; generatedLevels?: string[] };
type Context = { game: Game; member: Member; body: Record<string, unknown>; library?: CatalogResolver };
type Definition = {
  deny?: (context: Context) => string | undefined;
  run: (context: Context) => void | ActionResult;
  failure: string;
  conflicts?: boolean;
};

// Permissions are transport policy. Domain validation stays in the lib modules.
const pjOnly = (message: string) => ({ member }: Context) =>
  member.role === 'pj' ? undefined : message;

const definitions: Record<string, Definition> = {
  'mechanics': {
    run: ({ game, member, body }) => { mechanicsAction(game, member, body); },
    failure: 'Hod se nepodařil.',
  },
  'character': {
    run: ({ member, body }) => { updateCharacter(member, body); },
    failure: 'Neplatný deník.',
    conflicts: true,
  },
  'experience': {
    deny: pjOnly('Zkušenosti může přidělovat pouze Pán jeskyně.'),
    run: ({ game, member, body }) => { awardExperience(game, member, body); },
    failure: 'Neplatná odměna.',
  },
  'generate': {
    deny: pjOnly('Jeskyni generuje pouze PJ.'),
    run: ({ game, member, body }) => ({ generatedLevels: generationAction(game, member, body) }),
    failure: 'Jeskyni se nepodařilo vytvořit.',
    conflicts: true,
  },
  'life': {
    deny: pjOnly('O vyřazení rozhoduje pouze PJ.'),
    run: ({ game, member, body }) => { lifeAction(game, member, body); },
    failure: 'Stav se nepodařilo uložit.',
    conflicts: true,
  },
  'equipment': {
    deny: ({ member, body }) => {
      if (member.role === 'pj') return;
      if (body.op === 'use-healing') return 'Léčení předmětem potvrzuje pouze Pán jeskyně.';
      if (body.memberId !== member.id) return 'Upravovat můžeš jen vlastní výbavu.';
    },
    run: ({ game, member, body }) => { equipmentAction(game, member, body); },
    failure: 'Výbavu se nepodařilo změnit.',
    conflicts: true,
  },
  'loot': {
    deny: ({ member, body }) => member.role !== 'pj' &&
      ['save', 'remove', 'close', 'reopen', 'split-coins'].includes(String(body.op))
        ? 'Přípravu a společné dělení kořisti spravuje pouze PJ.' : undefined,
    run: ({ game, member, body }) => { lootAction(game, member, body); },
    failure: 'Kořist se nepodařilo upravit.',
    conflicts: true,
  },
  'challenge': {
    deny: ({ member, body }) => member.role !== 'pj' &&
      ['create', 'resolve', 'cancel'].includes(String(body.op))
        ? 'Výzvy a následky zkoušek spravuje pouze PJ.' : undefined,
    run: ({ game, member, body }) => { challengeAction(game, member, body); },
    failure: 'Zkoušku se nepodařilo provést.',
    conflicts: true,
  },
  'map-note': {
    deny: pjOnly('Poznámky na mapě spravuje pouze Pán jeskyně.'),
    run: ({ game, member, body }) => { mapNoteAction(game, member, body); },
    failure: 'Poznámku se nepodařilo uložit.',
    conflicts: true,
  },
  'journey': {
    deny: pjOnly('Čas a světla spravuje pouze Pán jeskyně.'),
    run: ({ game, member, body }) => { journeyAction(game, member, body); },
    failure: 'Akce průzkumu se nepodařila.',
    conflicts: true,
  },
  'recovery': {
    deny: pjOnly('Odpočinek a léčení potvrzuje pouze Pán jeskyně.'),
    run: ({ game, member, body }) => { recoveryAction(game, member, body); },
    failure: 'Obnovu se nepodařilo provést.',
    conflicts: true,
  },
  'power': {
    deny: ({ member, body }) => member.role !== 'pj' && body.memberId !== member.id
      ? 'Kouzla a magenergii spravuje jejich hráč nebo PJ.' : undefined,
    run: ({ game, member, body }) => { powerAction(game, member, body); },
    failure: 'Akce se nepodařila.',
    conflicts: true,
  },
  'condition': {
    deny: pjOnly('Stavy spravuje pouze Pán jeskyně.'),
    run: ({ game, member, body }) => { conditionAction(game, member, body); },
    failure: 'Stav se nepodařilo změnit.',
    conflicts: true,
  },
  'initiative': {
    deny: pjOnly('Souboj řídí pouze Pán jeskyně.'),
    run: ({ game, member, body }) => { initiativeAction(game, member, body); },
    failure: 'Souboj se nepodařilo změnit.',
    conflicts: true,
  },
  'monster': {
    deny: pjOnly('Příšery spravuje pouze Pán jeskyně.'),
    run: ({ game, member, body, library }) => { monsterAction(game, member, body, library); },
    failure: 'Příšeru se nepodařilo uložit.',
    conflicts: true,
  },
  'story-outline': {
    deny: pjOnly('Příběhová osnova je pouze pro PJ.'),
    run: ({ game, member, body }) => { saveStoryOutline(game, member, body); },
    failure: 'Osnovu se nepodařilo uložit.',
    conflicts: true,
  },
  'session-recap': {
    deny: pjOnly('Zápis ze sezení upravuje pouze PJ.'),
    run: ({ game, body }) => { saveSessionRecap(game, body); },
    failure: 'Zápis se nepodařilo uložit.',
    conflicts: true,
  },
};

export function applyDomainAction(context: Context): ActionResult | Response {
  const action = context.body.action;
  // Never resolve Object.prototype names as action handlers.
  if (typeof action !== 'string' || !Object.hasOwn(definitions, action))
    return fail('Neznámá akce.');
  const definition = definitions[action];
  const denied = definition.deny?.(context);
  if (denied) return fail(denied, 403);
  try {
    return definition.run(context) ?? {};
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : definition.failure,
      definition.conflicts && error instanceof EditConflict ? 409 : 400,
    );
  }
}
