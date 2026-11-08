import { integer, rollDice, damageFor, signed } from '../combat-rules';
import { entity, mayRoll } from './actors';
import { live, canReadMessage } from './records';
import type { MechanicsContext } from './context';
export function cancelCombat(
  { game: g, member: me, find, inherited, push }: MechanicsContext,
  b: Record<string, unknown>,
) {
  if (me.role !== 'pj') throw new Error('Akci ruší pouze PJ.');
  const msg = find(b.messageId),
    r = msg?.mechanics;
  if (!msg || !r || !live(g, msg))
    throw new Error('Akce už není rozpracovaná.');
  r.cancelled = true;
  if (r.defenseId && find(r.defenseId)?.mechanics)
    find(r.defenseId)!.mechanics!.cancelled = true;
  if (r.attackId && find(r.attackId)?.mechanics)
    find(r.attackId)!.mechanics!.cancelled = true;
  push('PJ zrušil rozpracovanou akci.', msg.to, undefined, inherited(msg));
}
export function applyDamage(
  { game: g, member: me, find, inherited, push }: MechanicsContext,
  b: Record<string, unknown>,
) {
  if (me.role !== 'pj') throw new Error('Zranění potvrzuje pouze PJ.');
  const msg = find(b.defenseId),
    r = msg?.mechanics,
    attack = find(r?.attackId)?.mechanics;
  if (
    !msg ||
    r?.kind !== 'defense' ||
    r.cancelled ||
    !attack?.target ||
    attack.cancelled
  )
    throw new Error('Chybí vyhodnocená obrana.');
  if (r.applied) throw new Error('Toto zranění už bylo potvrzené.');
  const amount = integer(b.amount, 0, 9999, 'Zranění'),
    target = entity(g, attack.target);
  const lost = Math.min(target.hp, amount);
  target.hp = Math.max(0, target.hp - amount);
  r.applied = true;
  msg.text = msg.text.replace('Čeká na PJ.', 'PJ potvrdil výsledek.');
  push(
    `PJ potvrzuje: ${target.name} −${lost} životů (zranění ${amount}).`,
    msg.to,
    undefined,
    inherited(msg),
  );
}
export function defendAttack(
  { game: g, member: me, find, inherited, push }: MechanicsContext,
  b: Record<string, unknown>,
) {
  const attackMsg = find(b.attackId),
    attack = attackMsg?.mechanics;
  if (
    !attackMsg ||
    attack?.kind !== 'attack' ||
    attack.cancelled ||
    !attack.target ||
    !canReadMessage(attackMsg, me.id)
  )
    throw new Error('Útok není dostupný.');
  if (attack.defenseId)
    throw new Error('Proti tomuto útoku už obrana proběhla.');
  mayRoll(me, attack.target);
  const defender = entity(g, attack.target);
  const base = integer(b.base, 0, 100, 'Obranné číslo'),
    modifier = integer(b.modifier ?? 0, -100, 100, 'Oprava'),
    dice = rollDice(6, true),
    total = dice.reduce((a, n) => a + n, 0) + base + modifier,
    damage = damageFor(attack.total, total, attack.damageBonus ?? 0);
  const msg = push(
    `${defender.name} · obrana: 1k6+ [${dice.join(' + ')}] + OČ ${base} ${signed(modifier)} = ${total}. Útok ${attack.total}: ${damage ? `zásah, návrh zranění ${damage}` : 'minutí'}. Čeká na PJ.`,
    attackMsg.to,
    {
      kind: 'defense',
      actor: attack.target,
      dice,
      base,
      modifier,
      total,
      attackId: attackMsg.id,
      proposedDamage: damage,
      applied: false,
    },
    inherited(attackMsg),
  );
  attack.defenseId = msg.id;
  attackMsg.text = attackMsg.text.replace(
    'Čeká na obranu.',
    'Obrana vyhodnocena.',
  );
}
