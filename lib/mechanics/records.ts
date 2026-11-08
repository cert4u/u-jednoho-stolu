import type { Game, Msg } from '../game';
export function canReadMessage(m: Msg, id: string) {
  return m.audience
    ? m.audience.includes(id)
    : m.to === 'all' || m.from === id || m.to === id;
}
export function prepareCombat(g: Game) {
  if (!g.combatActions) {
    g.combatActions = {};
    for (const m of g.messages)
      if (m.mechanics?.kind === 'attack' || m.mechanics?.attackId)
        g.combatActions[m.id] = structuredClone(m);
    for (const m of Object.values(g.combatActions)) {
      const r = m.mechanics!;
      if (m.to !== 'all' && !m.audience) {
        const source = r.attackId ? g.combatActions[r.attackId] : undefined;
        m.audience = source?.audience || [
          source?.from || m.from,
          source?.to || m.to,
        ];
        const old = g.messages.find((old) => old.id === m.id);
        if (old) old.audience = m.audience;
      }
      if (
        (r.attackId && !g.combatActions[r.attackId]) ||
        (r.kind === 'attack' && r.defenseId && !g.combatActions[r.defenseId])
      ) {
        r.cancelled = true;
        const original = g.messages.find((old) => old.id === m.id);
        if (original?.mechanics) original.mechanics.cancelled = true;
      }
    }
  }
  return g.combatActions;
}
export function live(g: Game, m: Msg) {
  const r = m.mechanics;
  if (!r || r.cancelled) return false;
  if (r.kind === 'attack') {
    const defense = r.defenseId
      ? g.combatActions?.[r.defenseId]?.mechanics
      : undefined;
    return (
      !r.defenseId || (!!defense && !defense.applied && !defense.cancelled)
    );
  }
  return !!r.attackId && !r.applied;
}
export function pendingCombat(g: Game, id: string) {
  return Object.values(prepareCombat(g)).filter(
    (m) =>
      live(g, m) &&
      !(m.mechanics?.kind === 'attack' && m.mechanics.defenseId) &&
      canReadMessage(m, id),
  );
}
export function syncCombat(g: Game) {
  const records = prepareCombat(g);
  g.messages = g.messages.map((m) =>
    records[m.id] ? structuredClone(records[m.id]) : m,
  );
  const closed = Object.values(records)
    .filter((m) => !live(g, m))
    .sort((a, b) => b.time - a.time)
    .slice(0, 100);
  const keep = new Set(
    [...Object.values(records).filter((m) => live(g, m)), ...closed].map(
      (m) => m.id,
    ),
  );
  g.combatActions = Object.fromEntries(
    Object.entries(records).filter(([id]) => keep.has(id)),
  );
}
