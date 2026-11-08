import { ABILITIES, abilityValues, type AbilityKey } from '../character';
import type { Member } from '../game';
import { monsterVisible } from '../monsters';
import { integer, rollDice, signed, abilityBonus } from '../combat-rules';
import { ref, entity, mayRoll } from './actors';
import { live } from './records';
import type { MechanicsRoll } from './types';
import type { MechanicsContext } from './context';
export function rollAction(
  { game: g, member: me, records, pj, push }: MechanicsContext,
  b: Record<string, unknown>,
) {
  if (
    b.kind === 'attack' &&
    Object.values(records).filter(
      (m) => live(g, m) && m.mechanics?.kind === 'attack',
    ).length >= 100
  )
    throw new Error('Dokonči nebo zruš starší rozpracované útoky (limit 100).');
  const actor = ref(b.actor);
  mayRoll(me, actor);
  const who = entity(g, actor);
  const kind = String(b.kind);
  if (!['ability', 'attack', 'defense'].includes(kind))
    throw new Error('Vyber druh hodu.');
  const target = b.target ? ref(b.target) : undefined;
  if (kind === 'attack' && !target) throw new Error('Vyber cíl útoku.');
  if (target && target.type === actor.type && target.id === actor.id)
    throw new Error('Vyber jiný cíl.');
  const victim = target ? entity(g, target) : undefined;
  const refs = [actor, ...(target ? [target] : [])];
  let privateRoll = b.audience === 'pj';
  for (const r of refs) {
    if (r.type !== 'monster') continue;
    const monster = g.monsters!.find((m) => m.id === r.id)!;
    if (
      me.role !== 'pj' &&
      !monsterVisible(g, monster, g.atlas?.location?.levelId || 'ground')
    )
      throw new Error('Příšera není v dohledu družiny.');
    if (!monsterVisible(g, monster, monster.levelId)) privateRoll = true;
  }
  const to = privateRoll ? pj.id : 'all';
  const modifier = integer(b.modifier ?? 0, -100, 100, 'Oprava');
  let base: number, label: string;
  let difficulty: number | undefined;
  if (kind === 'ability') {
    if (actor.type !== 'member')
      throw new Error('Vlastnosti se hází z deníku postavy.');
    const ability = ABILITIES.find((a) => a.key === b.ability);
    if (!ability) throw new Error('Vyber vlastnost.');
    base = abilityBonus(
      abilityValues(who as Member)[ability.key as AbilityKey],
    );
    label = `${ability.label} (bonus ${signed(base)})`;
    if (b.difficulty !== undefined && b.difficulty !== '')
      difficulty = integer(b.difficulty, -100, 200, 'Nebezpečnost');
  } else {
    base = integer(
      b.base,
      kind === 'defense' ? 0 : -50,
      100,
      kind === 'attack' ? 'Útočné číslo' : 'Obranné číslo',
    );
    label =
      kind === 'attack'
        ? `útok → ${victim!.name} (ÚČ ${base})`
        : `obrana (OČ ${base})`;
  }
  const dice = rollDice(kind === 'ability' ? 10 : 6, kind !== 'ability'),
    total = dice.reduce((a, n) => a + n, 0) + base + modifier;
  const damageBonus =
    kind === 'attack'
      ? integer(b.damageBonus ?? 0, -50, 100, 'Útočnost')
      : undefined;
  push(
    `${who.name} · ${label}: ${kind === 'ability' ? '1k10' : '1k6+'} [${dice.join(' + ')}] ${signed(base)} ${signed(modifier)} = ${total}${difficulty === undefined ? '' : ` vs. ${difficulty}: ${total >= difficulty ? 'úspěch' : 'neúspěch'}`}${kind === 'attack' ? `. Útočnost ${signed(damageBonus!)}. Čeká na obranu.` : '.'}`,
    to,
    {
      kind: kind as MechanicsRoll['kind'],
      actor,
      target,
      dice,
      base,
      modifier,
      total,
      damageBonus,
    },
  );
}
