'use client';

import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { GameView } from '../../app/api/game/view';
import type { Session } from './types';
import { requestGame, sameSession, sessionStorageKey } from './game-client';

type Options = {
  session: Session | null;
  sessionCurrent: RefObject<Session | null>;
  editorLevel: string;
  setSession: Dispatch<SetStateAction<Session | null>>;
  setGame: Dispatch<SetStateAction<GameView | null>>;
  setConnectionError: (message: string) => void;
};

export function useGamePolling({
  session,
  sessionCurrent,
  editorLevel,
  setSession,
  setGame,
  setConnectionError,
}: Options) {
  useEffect(() => {
    if (!session) return;
    const current = session;
    let disposed = false;
    let running = false;
    let etag: string | undefined;

    async function sync() {
      if (running) return;
      running = true;
      try {
        const { response, data, etag: nextEtag } = await requestGame(current, editorLevel, etag);
        if (disposed || !sameSession(sessionCurrent.current, current)) return;

        if (response.status === 304) {
          setConnectionError('');
          return;
        }
        if (!data) throw new Error('Chybí stav hry.');
        if (response.ok) {
          etag = nextEtag;
          setGame((previous) =>
            !previous || data.revision >= (previous.revision ?? -1)
              ? data
              : previous,
          );
          setConnectionError('');
          return;
        }

        setConnectionError(data.error ?? '');
        if (response.status === 401 || response.status === 404) {
          const stored = localStorage.getItem(sessionStorageKey);
          const latest = stored ? (JSON.parse(stored) as Session) : null;
          if (latest && latest.token !== current.token) {
            setSession(latest);
          } else {
            localStorage.removeItem(sessionStorageKey);
            setSession(null);
          }
        }
      } catch {
        if (!disposed)
          setConnectionError(
            'Spojení se přerušilo. Zkoušíme se znovu připojit…',
          );
      } finally {
        running = false;
      }
    }

    void sync();
    const timer = setInterval(sync, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [
    session,
    sessionCurrent,
    editorLevel,
    setSession,
    setGame,
    setConnectionError,
  ]);
}
