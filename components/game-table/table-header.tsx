'use client';
import Link from 'next/link';
import { usePublicPj } from './use-public-pj';

import { Swords, PenTool, Star, Check, Plus } from 'lucide-react';
import type { GameView, MemberView } from '../../app/api/game/view';

type Props = {
  game: Pick<GameView, 'title' | 'scene' | 'managedInvites'>;
  me: MemberView;
  pj: boolean;
  connectionError: string;
  copied: boolean;
  onEditScene: () => void;
  onAward: () => void;
  onAccount: () => void;
  onInvite: () => void;
};

export default function TableHeader({
  game,
  me,
  pj,
  connectionError,
  copied,
  onEditScene,
  onAward,
  onAccount,
  onInvite,
}: Props) {
  const publicMode = usePublicPj() === 'enabled';
  return (
    <header className="topbar">
      <a className="brand" href="#">
        <Swords /> U jednoho stolu
      </a>
      <div className="campaign">
        <span className="tiny">VAŠE DOBRODRUŽSTVÍ</span>
        <strong>{game.title}</strong>
      </div>
      <div className="current-scene">
        <span className="tiny">AKTUÁLNÍ SCÉNA</span>
        {pj ? (
          <button
            title="Upravit scénu"
            aria-label="Upravit scénu"
            onClick={onEditScene}
          >
            <span>{game.scene}</span>
            <PenTool size={12} />
          </button>
        ) : (
          <strong>{game.scene}</strong>
        )}
      </div>
      <span className="connection">
        <i />
        {connectionError ? 'Připojování…' : 'Stůl je připraven'}
      </span>
      {pj && (
        <button className="invite award-open" onClick={onAward}>
          <Star size={15} />
          <span>Přidělit zkušenosti</span>
        </button>
      )}
      {(!game.managedInvites || pj) && (
        <button onClick={onInvite} className="invite">
          {copied ? <Check size={15} /> : <Plus size={15} />}{' '}
          {copied ? 'Odkaz zkopírován' : 'Pozvat družinu'}
        </button>
      )}
      <button className="avatar" onClick={onAccount} title="Tvůj přístup">
        {me.name[0]}
      </button>
      {publicMode && pj && (
        <Link href="/pj" className="text-button pj-tables-link">
          Moje stoly
        </Link>
      )}
    </header>
  );
}
