import type { Game, Member } from '../game';
import type { ActorRef } from './types';
export function ref(value: unknown): ActorRef {
  const r = value as ActorRef;
  if (!r || !['member', 'monster'].includes(r.type) || typeof r.id !== 'string')
    throw new Error('Vyber postavu nebo příšeru.');
  return { type: r.type, id: r.id };
}
export function entity(g: Game, r: ActorRef) {
  const e =
    r.type === 'member'
      ? g.members.find((m) => m.id === r.id && !m.archived)
      : g.monsters?.find((m) => m.id === r.id && !m.archived);
  if (!e) throw new Error('Postava nebo příšera už není dostupná.');
  return e;
}
export function mayRoll(me: Member, r: ActorRef) {
  if (me.role !== 'pj' && (r.type !== 'member' || r.id !== me.id))
    throw new Error('Házet můžeš pouze za svou postavu.');
}
