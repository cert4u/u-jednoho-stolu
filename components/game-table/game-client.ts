import type { BestiaryEntry } from '../../lib/bestiary';
import type { GameView } from '../../app/api/game/view';
import type { Session } from './types';

export const sessionStorageKey = 'stul-session';

export function sameSession(current: Session | null, expected: Session) {
  return current?.room === expected.room && current.token === expected.token;
}

type ErrorPayload = { error?: string };
type ActionResult = {
  game: GameView;
  room: string;
  token?: string;
  recoveryCode?: string;
  generatedLevels?: string[];
};

function authorization(session: Session) {
  return { Authorization: `Bearer ${session.token}` };
}

export async function requestGame(session: Session, level: string) {
  const query = new URLSearchParams({ room: session.room, level });
  const response = await fetch(`/api/game?${query}`, {
    headers: authorization(session),
  });
  const data = (await response.json()) as GameView & ErrorPayload;
  return { response, data };
}

export async function sendGameAction(
  session: Session | null,
  levelId: string | undefined,
  action: string,
  values: Record<string, unknown>,
) {
  const response = await fetch('/api/game', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? authorization(session) : {}),
    },
    body: JSON.stringify({ action, room: session?.room, levelId, ...values }),
  });
  const data = (await response.json()) as ActionResult & ErrorPayload;
  if (!response.ok) throw new Error(data.error);
  return data;
}

export async function requestBackup(session: Session) {
  const query = new URLSearchParams({ room: session.room, download: 'backup' });
  const response = await fetch(`/api/game?${query}`, {
    headers: authorization(session),
  });
  const backup = (await response.json()) as ErrorPayload;
  if (!response.ok)
    throw new Error(backup.error || 'Zálohu se nepodařilo stáhnout.');
  return backup;
}

export async function requestBestiary(session: Session, signal: AbortSignal) {
  const query = new URLSearchParams({ room: session.room, catalog: 'bestiary' });
  const response = await fetch(`/api/game?${query}`, { headers: authorization(session), signal });
  if (!response.ok) throw new Error('Bestiář se nepodařilo načíst.');
  return await response.json() as BestiaryEntry[];
}
