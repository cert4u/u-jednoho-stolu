import type { Game, Member } from './game';
import { mechanicsContext } from './mechanics/context';
import { syncCombat } from './mechanics/records';
import {
  cancelCombat,
  applyDamage,
  defendAttack,
} from './mechanics/combat-actions';
import { rollAction } from './mechanics/roll-action';
export {
  abilityBonus,
  combatFields,
  damageFor,
  die,
  integer,
  rollDice,
  signed,
} from './combat-rules';
export type { CombatStats } from './combat-rules';

export type { ActorRef, MechanicsRoll } from './mechanics/types';
export {
  canReadMessage,
  prepareCombat,
  pendingCombat,
} from './mechanics/records';
export function mechanicsAction(
  g: Game,
  me: Member,
  b: Record<string, unknown>,
) {
  if (
    typeof b.requestId !== 'string' ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(b.requestId)
  )
    throw new Error('Chybí identifikátor hodu.');
  const operation = me.id + ':' + b.requestId;
  if (g.mechanicsOperations?.includes(operation)) return;
  const context = mechanicsContext(g, me);
  if (b.kind === 'cancel') cancelCombat(context, b);
  else if (b.kind === 'apply') applyDamage(context, b);
  else if (b.kind === 'defense' && b.attackId) defendAttack(context, b);
  else rollAction(context, b);
  syncCombat(g);
  g.messages = g.messages.slice(-500);
  g.mechanicsOperations = [...(g.mechanicsOperations || []), operation].slice(
    -256,
  );
}
