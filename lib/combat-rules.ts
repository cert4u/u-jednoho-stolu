export type CombatStats = { attack: number; defense: number; damage: number };

export function integer(v: unknown, min: number, max: number, label: string) {
  const n = Number(v);
  if (
    v === null ||
    v === '' ||
    typeof v === 'boolean' ||
    !Number.isInteger(n) ||
    n < min ||
    n > max
  )
    throw new Error(`${label}: zadej celé číslo od ${min} do ${max}.`);
  return n;
}
export function combatFields(
  b: Record<string, unknown>,
  previous?: CombatStats,
) {
  if (
    !['attackNumber', 'defenseNumber', 'damageBonus'].some(
      (k) => b[k] !== undefined,
    )
  )
    return previous;
  return {
    attack: integer(
      b.attackNumber ?? previous?.attack ?? 0,
      -50,
      100,
      'Útočné číslo',
    ),
    defense: integer(
      b.defenseNumber ?? previous?.defense ?? 0,
      0,
      100,
      'Obranné číslo',
    ),
    damage: integer(
      b.damageBonus ?? previous?.damage ?? 0,
      -50,
      100,
      'Útočnost',
    ),
  };
}
export function abilityBonus(value: number) {
  return value < 10
    ? Math.floor(value / 2) - 5
    : value <= 12
      ? 0
      : Math.floor((value - 11) / 2);
}
export const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
export function die(sides: number) {
  const limit = Math.floor(0x100000000 / sides) * sides;
  let value: number;
  do {
    value = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (value >= limit);
  return (value % sides) + 1;
}
export function rollDice(sides: number, explode = false, random = die) {
  const dice: number[] = [];
  do {
    if (dice.length === 100)
      throw new Error('Příliš dlouhá řada šestek. Zkus hod znovu.');
    dice.push(random(sides));
  } while (explode && dice.at(-1) === sides);
  return dice;
}
export function damageFor(attack: number, defense: number, damage: number) {
  return attack > defense ? Math.max(1, attack - defense + damage) : 0;
}
