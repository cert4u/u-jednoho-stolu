import type { Game, Member, Msg } from './game';
import { die } from './mechanics';

export type MessageOperation = { actor: string; requestId: string; fingerprint: string; messageId: string };
export class MessageReplayError extends Error {}
async function fingerprint(b: Record<string, unknown>) {
  const text = JSON.stringify([b.action, String(b.text || '').trim().slice(0, 2000), String(b.to || 'all')]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
}

export async function messageReplay(g: Game, me: Member, b: Record<string, unknown>) {
  if (!['chat', 'roll'].includes(String(b.action)) || b.requestId === undefined) return;
  if (typeof b.requestId !== 'string' || (!/^[a-zA-Z0-9_-]{1,100}$/.test(b.requestId) || ['__proto__', 'constructor', 'prototype'].includes(b.requestId)))
    throw new Error('Neplatný identifikátor zprávy.');
  const previous = g.messageOperations?.find(op => op.actor === me.id && op.requestId === b.requestId);
  if (previous && previous.fingerprint !== await fingerprint(b))
    throw new MessageReplayError('Tento identifikátor už patří jiné zprávě.');
  return previous;
}

export async function appendMessage(g: Game, me: Member, b: Record<string, unknown>, prepared?: Msg) {
  if (await messageReplay(g, me, b)) return;
  let text = String(b.text || '').trim().slice(0, 2000);
  const to = String(b.to || 'all');
  if (!text) throw new Error('Napiš zprávu.');
  if (to !== 'all' && !g.members.some(m => m.id === to)) throw new Error('Příjemce není u stolu.');
  if (b.action === 'roll') {
    const match = /^(\d{1,2})[kd](4|6|8|10|12|20|100)([+-]\d{1,3})?$/i.exec(text.replaceAll(' ', ''));
    if (!match || +match[1] > 20 || +match[1] < 1) throw new Error('Použij například 2k6+1 (nejvýše 20 kostek).');
    if (!prepared) {
      const rolls = Array.from({ length: +match[1] }, () => die(+match[2]));
      text = `${text} → ${rolls.reduce((a, c) => a + c, 0) + Number(match[3] || 0)} (${rolls.join(' + ')}${match[3] || ''})`;
    }
  }
  const message = prepared ?? { id: crypto.randomUUID(), from: me.id, name: me.name, text, to, time: Date.now(), roll: b.action === 'roll' };
  g.messages.push(message);
  g.messages = g.messages.slice(-500);
  if (typeof b.requestId === 'string')
    g.messageOperations = [...(g.messageOperations ?? []), { actor: me.id, requestId: b.requestId, fingerprint: await fingerprint(b), messageId: message.id }].slice(-256);
}
