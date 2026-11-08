'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  initialInteraction,
  sameMapSignals,
  transitionMap,
  type InteractionState,
  type MapSignals,
} from './interaction-state';

export function useMapInteraction(signals: MapSignals) {
  const [stored, setStored] = useState(() => initialInteraction(signals));
  let state = stored;
  // Adjust this component's own state before commit, once per changed input snapshot.
  if (!sameMapSignals(stored.signals, signals)) {
    state = transitionMap(stored, signals);
    setStored(state);
  }
  function setter<K extends 'mode' | 'tool' | 'preview' | 'inspection'>(
    key: K,
  ): Dispatch<SetStateAction<InteractionState[K]>> {
    return (value) =>
      setStored((previous) => ({
        ...previous,
        [key]: typeof value === 'function' ? value(previous[key]) : value,
      }));
  }
  return {
    ...state,
    setMode: setter('mode'),
    setTool: setter('tool'),
    setPreview: setter('preview'),
    setInspection: setter('inspection'),
  };
}
