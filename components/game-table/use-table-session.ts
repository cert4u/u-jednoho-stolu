'use client';

import { useCallback, useRef, useState } from 'react';
import type { GameView } from '../../app/api/game/view';
import { downloadText } from '../campaign-access';
import {
  actionValues,
  requestBackup,
  requestGame,
  sendGameAction,
  sessionStorageKey,
} from './game-client';
import type { Session, SessionScope } from './types';
import { useGamePolling } from './use-game-polling';
import { useGameView } from './use-game-view';

export function useTableSession(initialSession: Session | null) {
  const [scope, setScope] = useState<SessionScope>(() => ({
    session: initialSession,
    id: 0,
    openAccount: false,
  }));
  const { session } = scope;
  const sessionCurrent = useRef(scope);
  const isCurrentSession = () => sessionCurrent.current === scope;
  const { game, view, isCurrentView, setEditorLevel, resetView, acceptGame } =
    useGameView();
  const editorLevel = view.levelId;
  const [error, setError] = useState('');
  const [pendingActions, setPendingActions] = useState(0);
  const [connectionError, setConnectionError] = useState('');
  const [copied, setCopied] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryName, setRecoveryName] = useState('');
  const [generationPick, setGenerationPick] = useState(0);
  const me = game?.members.find((member) => member.id === game.me);

  const changeSession = useCallback(
    (next: Session | null, snapshot: GameView | null = null) => {
      // Invalidate pending work before React renders the workspace for the new session.
      const nextScope = {
        session: next,
        id: sessionCurrent.current.id + 1,
        openAccount: snapshot !== null,
      };
      sessionCurrent.current = nextScope;
      setScope(nextScope);
      resetView(snapshot);
      setPendingActions(0);
      setError('');
      setConnectionError('');
      setGenerationPick(0);
      setCopied(false);
      setRecoveryCode('');
      setRecoveryName('');
      try {
        if (next) localStorage.setItem(sessionStorageKey, JSON.stringify(next));
        else localStorage.removeItem(sessionStorageKey);
      } catch {
        // The current tab can still play when browser storage is unavailable.
      }
    },
    [resetView],
  );

  useGamePolling({
    scope,
    sessionCurrent,
    view,
    isCurrentView,
    changeSession,
    acceptGame,
    setConnectionError,
  });

  function reportError(message: string) {
    if (isCurrentSession()) setError(message);
  }

  async function act(action: string, values: Record<string, unknown> = {}) {
    if (!isCurrentSession() || !isCurrentView(view)) return false;
    values = actionValues(action, values);
    setPendingActions((count) => count + 1);
    setError('');
    try {
      const displayedLevel = editorLevel || game?.exploration?.levelId;
      const d = await sendGameAction(session, displayedLevel, action, values);
      if (!isCurrentSession()) return false;
      if (d.token) changeSession({ room: d.room, token: d.token }, d.game);
      if (d.recoveryCode) {
        setRecoveryCode(d.recoveryCode);
        const memberId = d.recoveryCode.split(':')[1];
        setRecoveryName(
          d.game.members.find((m) => m.id === memberId)?.name || 'Postava',
        );
      }
      if (!d.token && isCurrentView(view)) {
        if (action === 'generate' && d.generatedLevels?.[0]) {
          acceptGame(setEditorLevel(d.generatedLevels[0]), d.game);
          setGenerationPick((n) => n + 1);
        } else if (
          action === 'explore' &&
          ['travel', 'place'].includes(String(values.op))
        ) {
          acceptGame(setEditorLevel(''), d.game);
        } else {
          const returnedLevel = d.game.exploration?.levelId;
          const wantedLevel =
            editorLevel || d.game.exploration?.location?.levelId;
          if (
            me?.role !== 'pj' ||
            !wantedLevel ||
            returnedLevel === wantedLevel
          )
            acceptGame(view, d.game);
        }
      }
      return true;
    } catch (e) {
      if (isCurrentSession())
        setError(e instanceof Error ? e.message : 'Něco se nepodařilo.');
      return false;
    } finally {
      if (isCurrentSession()) setPendingActions((count) => count - 1);
    }
  }
  async function reloadEquipment() {
    if (!session || !isCurrentSession() || !isCurrentView(view)) return false;
    setPendingActions((count) => count + 1);
    setError('');
    try {
      const { response, data } = await requestGame(session, editorLevel);
      if (!isCurrentSession() || !isCurrentView(view)) return false;
      if (!response.ok)
        throw new Error(data.error || 'Výbavu se nepodařilo načíst.');
      acceptGame(view, data);
      return true;
    } catch (e) {
      if (isCurrentSession() && isCurrentView(view)) {
        setError(
          e instanceof Error ? e.message : 'Výbavu se nepodařilo načíst.',
        );
      }
      return false;
    } finally {
      if (isCurrentSession()) setPendingActions((count) => count - 1);
    }
  }
  function leave() {
    if (isCurrentSession()) changeSession(null);
  }
  async function copyInvite() {
    if (!session || !isCurrentSession()) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${session.room}`,
      );
      if (!isCurrentSession()) return;
      setCopied(true);
      setTimeout(() => {
        if (isCurrentSession()) setCopied(false);
      }, 2500);
    } catch {
      if (isCurrentSession()) {
        setError('Odkaz nelze zkopírovat. Kód místnosti: ' + session.room);
      }
    }
  }
  async function exportGame() {
    if (!session || !isCurrentSession()) return;
    setError('');
    try {
      const value = await requestBackup(session);
      if (!isCurrentSession()) return;
      downloadText(
        'kampan-zaloha.json',
        JSON.stringify(value),
        'application/json',
      );
    } catch (e) {
      if (isCurrentSession()) {
        setError(
          e instanceof Error ? e.message : 'Zálohu se nepodařilo stáhnout.',
        );
      }
    }
  }

  return {
    session,
    sessionId: scope.id,
    openAccount: scope.openAccount,
    isCurrentSession,
    game,
    me,
    view,
    isCurrentView,
    setEditorLevel,
    acceptGame,
    generationPick,
    busy: pendingActions > 0,
    error,
    setError: reportError,
    connectionError,
    copied,
    recoveryCode,
    recoveryName,
    act,
    reloadEquipment,
    copyInvite,
    exportGame,
    leave,
  };
}
