import {ScrollText} from 'lucide-react';
import type {Msg} from '../lib/game';

export default function ParchmentMessage({message}: {message: Msg}) {
  const {parchment, text} = message;
  if (!parchment) return null;

  return (
    <article className="room-parchment">
      <header>
        <span><ScrollText size={15} aria-hidden="true"/> Objevený pergamen</span>
        <time dateTime={new Date(message.time).toISOString()}>
          {new Date(message.time).toLocaleTimeString('cs', {hour: '2-digit', minute: '2-digit'})}
        </time>
      </header>
      <h3>{parchment.roomNumber ? `${parchment.roomNumber} · ` : ''}{parchment.title}</h3>
      <p>{text}</p>
    </article>
  );
}
