'use client';

import { useSyncExternalStore } from 'react';

export type MapAppearance = 'classic' | 'hand-drawn';
const storageKey = 'stul-map-appearance';
const listeners = new Set<() => void>();
let memoryChoice: MapAppearance | undefined;

function snapshot(): MapAppearance {
  if (memoryChoice) return memoryChoice;
  try { return localStorage.getItem(storageKey) === 'hand-drawn' ? 'hand-drawn' : 'classic'; }
  catch { return 'classic'; }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== storageKey) return;
    memoryChoice = undefined;
    listener();
  };
  window.addEventListener('storage', storage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', storage);
  };
}

function chooseAppearance(value: MapAppearance) {
  try {
    localStorage.setItem(storageKey, value);
    memoryChoice = undefined;
  } catch {
    // Disabled storage must not prevent switching in this tab.
    memoryChoice = value;
  }
  for (const listener of listeners) listener();
}

export function useMapAppearance() {
  const appearance = useSyncExternalStore(subscribe, snapshot, () => 'classic' as const);
  return [appearance, chooseAppearance] as const;
}
