'use client';

import { useState, useSyncExternalStore } from 'react';
import { sessionStorageKey } from './game-client';
import type { Session } from './types';

export function readBrowserEntry(
  storage?: Pick<Storage, 'getItem'>,
  search = '',
) {
  const empty = { session: null as Session | null, code: '', joining: false };
  try {
    const stored = storage?.getItem(sessionStorageKey);
    const session = stored ? (JSON.parse(stored) as Session) : null;
    const code = new URLSearchParams(search).get('room') || '';
    return { session, code, joining: Boolean(code) };
  } catch {
    return empty;
  }
}
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function useBrowserEntry() {
  const [initial] = useState(() => {
    try {
      return typeof window === 'undefined'
        ? readBrowserEntry()
        : readBrowserEntry(window.localStorage, window.location.search);
    } catch {
      return readBrowserEntry();
    }
  });
  // SSR and the first hydration render both show the loading state. No effect copies storage into state.
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  return { initial, ready };
}
