'use client';

import { useEffect, type RefObject } from 'react';
import type { GameView } from '../../app/api/game/view';
import type { Session, SessionScope, ViewRequest } from './types';
import { requestGame, sameSession, sessionStorageKey } from './game-client';

const POLL_INTERVAL = 2_000;
const MAX_RETRY_DELAY = 30_000;
const REQUEST_TIMEOUT = 30_000;
const CONNECTION_LOST = 'Spojení se přerušilo. Zkoušíme se znovu připojit…';

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
    let active: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = POLL_INTERVAL;
    let etag: string | undefined;

    const isCurrent = () =>
      !disposed && sessionCurrent.current === scope && isCurrentView(view);
    const isOffline = () => navigator.onLine === false;

    function suspend() {
      clearTimeout(timer);
      const pending = active;
      active = undefined;
      pending?.abort();
      if (isCurrent()) setConnectionError(CONNECTION_LOST);
    }

    function resume() {
      clearTimeout(timer);
      retryDelay = POLL_INTERVAL;
      void sync();
    }

    async function sync() {
      if (active || !isCurrent()) return;
      if (isOffline()) {
        setConnectionError(CONNECTION_LOST);
        return;
      }
      const controller = new AbortController();
      active = controller;
      const deadline = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      let succeeded = false;
      try {
        const {
          response,
          data,
          etag: nextEtag,
        } = await requestGame(current, view.levelId, etag, controller.signal);
        if (!isCurrent() || active !== controller) return;

        if (response.status === 304) {
          succeeded = true;
          setConnectionError('');
          return;
        }
        if (!data) throw new Error('Chybí stav hry.');
        if (response.ok) {
          succeeded = true;
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
        setConnectionError(data.error ?? CONNECTION_LOST);
      } catch {
        if (isCurrent() && active === controller)
          setConnectionError(CONNECTION_LOST);
      } finally {
        clearTimeout(deadline);
        if (active === controller) {
          active = undefined;
          if (isCurrent() && !isOffline()) {
            const delay = succeeded ? POLL_INTERVAL : retryDelay;
            retryDelay = succeeded
              ? POLL_INTERVAL
              : Math.min(retryDelay * 2, MAX_RETRY_DELAY);
            timer = setTimeout(sync, delay);
          }
        }
      }
    }

    window.addEventListener('offline', suspend);
    window.addEventListener('online', resume);
    void sync();
    return () => {
      disposed = true;
      suspend();
      window.removeEventListener('offline', suspend);
      window.removeEventListener('online', resume);
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
