'use client';

import { useEffect, type RefObject } from 'react';
import type { GameView } from '../../app/api/game/view';
import type { Session, SessionScope, ViewRequest } from './types';
import { requestGame, sameSession, sessionStorageKey } from './game-client';

type Options = {
  scope: SessionScope;
  sessionCurrent: RefObject<SessionScope>;
  view: ViewRequest;
  isCurrentView: (view: ViewRequest) => boolean;
  changeSession: (session: Session | null) => void;
  acceptGame: (view: ViewRequest, game: GameView) => void;
  setConnectionError: (message: string) => void;
};

export function useGamePolling({
  scope,
  sessionCurrent,
  view,
  isCurrentView,
  changeSession,
  acceptGame,
  setConnectionError,
}: Options) {
  useEffect(() => {
    const { session } = scope;
    if (!session) return;
    const current = session;
    let disposed = false;
    let running = false;
    let etag: string | undefined;

    const isCurrent = () =>
      !disposed && sessionCurrent.current === scope && isCurrentView(view);

    async function sync() {
      if (running || !isCurrent()) return;
      running = true;
      try {
        const {
          response,
          data,
          etag: nextEtag,
        } = await requestGame(current, view.levelId, etag);
        if (!isCurrent()) return;

        if (response.status === 304) {
          setConnectionError('');
          return;
        }
        if (!data) throw new Error('Chybí stav hry.');
        if (response.ok) {
          etag = nextEtag;
          acceptGame(view, data);
          setConnectionError('');
          return;
        }

        if (response.status === 401 || response.status === 404) {
          let replacement: Session | null = null;
          try {
            const stored = localStorage.getItem(sessionStorageKey);
            const latest = stored ? (JSON.parse(stored) as Session) : null;
            if (
              typeof latest?.room === 'string' &&
              latest.room &&
              typeof latest.token === 'string' &&
              latest.token &&
              !sameSession(latest, current)
            ) {
              replacement = latest;
            }
          } catch {
            // A missing or unreadable saved login cannot replace an expired one.
          }
          changeSession(replacement);
          return;
        }
        setConnectionError(data.error ?? '');
      } catch {
        if (isCurrent())
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
    scope,
    sessionCurrent,
    view,
    isCurrentView,
    changeSession,
    acceptGame,
    setConnectionError,
  ]);
}
