'use client';

import { useState, useSyncExternalStore } from 'react';
import { sessionStorageKey } from './game-client';
import type { GameInvitation } from '../../lib/game-invitation';
import type { Session } from './types';

function invitationFromHash(
  room: string,
  hash: string,
): GameInvitation | undefined {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('invite');
  return room && token ? { room, token } : undefined;
}

export function readBrowserEntry(
  storage?: Pick<Storage, 'getItem'>,
  search = '',
  hash = '',
): {
  session: Session | null;
  code: string;
  joining: boolean;
  invitation?: GameInvitation;
} {
  const code = new URLSearchParams(search).get('room') || '';
  const invitation = invitationFromHash(code, hash);
  let session: Session | null = null;
  try {
    const stored = storage?.getItem(sessionStorageKey);
    if (stored) session = JSON.parse(stored) as Session;
  } catch {
    // The invitation can still be used with no readable saved session.
  }
  if (invitation && session?.room !== code) session = null;
  return {
    session,
    code,
    joining: Boolean(code),
    ...(invitation && { invitation }),
  };
}

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const clientHash = () => window.location.hash;
const serverHash = () => '';
function subscribeHash(change: () => void) {
  window.addEventListener('hashchange', change);
  return () => window.removeEventListener('hashchange', change);
}

export function useBrowserEntry() {
  const [initial] = useState(() => {
    try {
      return typeof window === 'undefined'
        ? readBrowserEntry()
        : readBrowserEntry(
            window.localStorage,
            window.location.search,
            window.location.hash,
          );
    } catch {
      return readBrowserEntry(
        undefined,
        window.location.search,
        window.location.hash,
      );
    }
  });
  // SSR and the first hydration render both show the loading state. No effect copies storage into state.
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const hash = useSyncExternalStore(subscribeHash, clientHash, serverHash);
  return {
    initial: { ...initial, invitation: invitationFromHash(initial.code, hash) },
    ready,
  };
}
