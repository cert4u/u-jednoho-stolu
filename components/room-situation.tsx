'use client';

import {useId, useState} from 'react';
import {ScrollText} from 'lucide-react';
import type {Msg} from '../lib/game';

export function SituationCard({message, onDismiss}: {message: Msg; onDismiss?: () => void}) {
  const heading = useId();
  const {parchment, text} = message;
  if (!parchment) return null;

  return (
    <article
      className={onDismiss ? 'room-parchment situation-expanded' : 'room-parchment'}
      aria-labelledby={heading}
      onKeyDown={event => {
        if (onDismiss && event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <header>
        <span><ScrollText size={15} aria-hidden="true"/> Situace</span>
        <time dateTime={new Date(message.time).toISOString()}>
          {new Date(message.time).toLocaleTimeString('cs', {hour: '2-digit', minute: '2-digit'})}
        </time>
      </header>
      <h3 id={heading}>{parchment.roomNumber ? `${parchment.roomNumber} · ` : ''}{parchment.title}</h3>
      <p tabIndex={onDismiss ? 0 : undefined}>{text}</p>
      {onDismiss && <footer><button className="primary" onClick={onDismiss}>Pokračovat</button></footer>}
    </article>
  );
}

type SituationQueue = {
  session: string | undefined;
  messages: Msg[] | undefined;
  pending: Msg[];
};

export function useRoomSituations(session: string | undefined, messages: Msg[] | undefined) {
  const [state, setState] = useState<SituationQueue>({session, messages, pending: []});
  let current = state;

  // Update before rendering the chat so a new situation first appears on the map.
  if (state.session !== session || state.messages !== messages) {
    let pending: Msg[] = [];
    if (state.session === session && state.messages && messages) {
      const known = new Set(state.messages.map(message => message.id));
      pending = [...state.pending, ...messages.filter(message => message.parchment && !known.has(message.id))];
    }
    current = {session, messages, pending};
    setState(current);
  }

  return {
    next: current.pending[0],
    pendingIds: new Set(current.pending.map(message => message.id)),
    dismiss: () => setState(previous => ({...previous, pending: previous.pending.slice(1)})),
  };
}

export function SituationOverlay({message, onDismiss}: {message?: Msg; onDismiss: () => void}) {
  return (
    <div className="situation-overlay" aria-live="polite">
      {message && <SituationCard key={message.id} message={message} onDismiss={onDismiss}/>}
    </div>
  );
}
