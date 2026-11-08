'use client';

import { ArrowRight, BookOpen, Dices, ScrollText, Skull } from 'lucide-react';
import type { TablePanel } from './table-dialog';

export default function JournalShortcuts({
  pj,
  mobile = false,
  onOpen,
}: {
  pj: boolean;
  mobile?: boolean;
  onOpen: (modal: TablePanel) => void;
}) {
  return (
    <nav
      className={'journal-shortcuts ' + (mobile ? 'mobile-journals' : '')}
      aria-label="Deníky a příprava"
    >
      <button onClick={() => onOpen('character')}>
        <ScrollText size={18} />
        <span>Můj deník</span>
        <ArrowRight size={13} />
      </button>
      <button
        aria-label={pj ? 'Zápisník Pána jeskyně' : 'Jak se hraje'}
        onClick={() => onOpen(pj ? 'notes' : 'help')}
      >
        <BookOpen size={18} />
        <span>{pj ? 'Zápisník PJ' : 'Jak se hraje'}</span>
        <ArrowRight size={13} />
      </button>
      <button onClick={() => onOpen('session-recap')}>
        <BookOpen size={18} />
        <span>Kde jsme skončili</span>
        <ArrowRight size={13} />
      </button>
      <button className="mechanics-open" onClick={() => onOpen('mechanics')}>
        <Dices size={18} />
        <span>Hody a souboj</span>
        <ArrowRight size={13} />
      </button>
      {pj && (
        <button onClick={() => onOpen('monsters')}>
          <Skull size={18} />
          <span>Příšery</span>
          <ArrowRight size={13} />
        </button>
      )}
    </nav>
  );
}
