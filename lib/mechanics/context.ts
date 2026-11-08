import type { Game, Member, Msg } from '../game';
import type { MechanicsRoll } from './types';
import { prepareCombat } from './records';
export function mechanicsContext(g: Game, me: Member) {
  const pj = g.members.find((m) => m.role === 'pj')!;
  const records = prepareCombat(g);
  const find = (id: unknown) =>
    records[String(id)] || g.messages.find((m) => m.id === id);
  const inherited = (m: Msg) =>
    m.to === 'all' ? undefined : m.audience || [m.from, m.to];
  const push = (
    text: string,
    to: string,
    result?: MechanicsRoll,
    audience?: string[],
  ) => {
    const msg: Msg = {
      id: crypto.randomUUID(),
      from: me.id,
      name: me.name,
      text,
      to,
      time: Date.now(),
      roll: true,
      ...(audience
        ? { audience }
        : to !== 'all'
          ? { audience: [me.id, to] }
          : {}),
      ...(result ? { mechanics: result } : {}),
    };
    g.messages.push(msg);
    if (result && (result.kind === 'attack' || result.attackId))
      records[msg.id] = msg;
    return msg;
  };
  return { game: g, member: me, pj, records, find, inherited, push };
}
export type MechanicsContext = ReturnType<typeof mechanicsContext>;
