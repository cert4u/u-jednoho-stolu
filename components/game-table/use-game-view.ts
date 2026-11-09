'use client';

import { useCallback, useRef, useState } from 'react';
import type { GameView } from '../../app/api/game/view';
import type { ViewRequest } from './types';

export function useGameView() {
  const [game, setGame] = useState<GameView | null>(null);
  const [view, setView] = useState<ViewRequest>(() => ({ levelId: '' }));
  const current = useRef(view);

  // Identity distinguishes A → B → A at the same room revision.
  const isCurrentView = useCallback(
    (request: ViewRequest) => current.current === request,
    [],
  );
  const setEditorLevel = useCallback((levelId: string) => {
    if (current.current.levelId === levelId) return current.current;
    const next = { levelId };
    current.current = next;
    setView(next);
    return next;
  }, []);
  const resetView = useCallback((snapshot: GameView | null) => {
    const next = { levelId: '' };
    current.current = next;
    setView(next);
    setGame(snapshot);
  }, []);
  const acceptGame = useCallback(
    (request: ViewRequest, snapshot: GameView) => {
      if (!isCurrentView(request)) return;
      setGame((previous) =>
        !previous || snapshot.revision >= previous.revision
          ? snapshot
          : previous,
      );
    },
    [isCurrentView],
  );

  return { game, view, isCurrentView, setEditorLevel, resetView, acceptGame };
}
