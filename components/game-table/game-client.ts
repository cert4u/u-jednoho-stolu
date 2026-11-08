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

type GameResponse = { response: Response; data: GameView & ErrorPayload; etag?: string };
export function requestGame(session: Session, level: string): Promise<GameResponse>;
export function requestGame(session: Session, level: string, etag: string | undefined): Promise<Omit<GameResponse, 'data'> & { data?: GameResponse['data'] }>;
export async function requestGame(session: Session, level: string, etag?: string): Promise<Omit<GameResponse, 'data'> & { data?: GameResponse['data'] }> {
  const query = new URLSearchParams({ room: session.room, level });
  const response = await fetch(`/api/game?${query}`, {
    headers: { ...authorization(session), ...(etag ? { 'If-None-Match': etag } : {}) },
  });
  const data = response.status === 304 ? undefined : (await response.json()) as GameView & ErrorPayload;
  return { response, data, etag: response.headers.get('etag') ?? undefined };
}

/** Every invocation is a new intent; only its transport retries share the operation ID. */
export async function sendGameAction(
  session: Session | null,
  levelId: string | undefined,
  action: string,
  values: Record<string, unknown>,
) {
  const replayableMessage = ['chat', 'roll'].includes(action) && Boolean(session);
  if (replayableMessage && !values.requestId)
    values = { ...values, requestId: crypto.randomUUID() };
  const body = JSON.stringify({ action, room: session?.room, levelId, ...values });
  const attempts = replayableMessage ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response;
    let data: ActionResult & ErrorPayload;
    try {
      response = await fetch('/api/game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? authorization(session) : {}),
        },
        body,
      });
      if (response.status >= 500 && attempt + 1 < attempts) { await response.body?.cancel(); continue; }
      data = await response.json();
    } catch (error) {
      if (attempt + 1 < attempts) continue;
      throw error;
    }
    if (!response.ok) throw new Error(data.error || 'Požadavek se nepodařil.');
    return data;
  }
  throw new Error('Odpověď se nepodařilo potvrdit. Zkontroluj historii u stolu.');
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

export function actionValues(action: string, values: Record<string, unknown>) {
  const replayable = ['explore', 'monster', 'mechanics', 'initiative', 'condition',
    'power', 'recovery', 'journey', 'map-note', 'challenge', 'loot', 'equipment', 'life', 'generate'];
  return replayable.includes(action) && !values.requestId
    ? { ...values, requestId: crypto.randomUUID() } : values;
}
