'use client';

import { ArrowRight, BookOpen, Flame, Plus } from 'lucide-react';
import type { GameView, MemberView } from '../../app/api/game/view';
import type { InitiativeRef } from '../../lib/initiative';
import type { VoicePresence } from '../voice-panel';
import CharacterAvatar from '../character-avatar';
import ConditionBadges from '../condition-badges';
import { LifeBadge, LifeSummary } from '../life-panel';
import { JourneySummary } from '../journey-panel';
import { InitiativeTracker } from '../initiative-panel';
import { PartyOrder, SidebarLevels } from '../party-sidebar';
import JournalShortcuts from './journal-shortcuts';
import type { TablePanel } from './table-dialog';
import type { GameAction } from './types';

type PartyControlsProps = {
  game: GameView;
  me: MemberView;
  pj: boolean;
  busy: boolean;
  act: GameAction;
  onOpen: (panel: TablePanel) => void;
  onLife: (id?: string) => void;
  onConditions: (target?: InitiativeRef) => void;
  onLevel: (id: string) => void;
};

type SidebarProps = PartyControlsProps & {
  selected: string;
  voicePresence: VoicePresence;
  onSelectMember: (id: string) => void;
  onInvite: () => void;
  onHelp: () => void;
};

export default function PartySidebar({
  game,
  me,
  pj,
  busy,
  act,
  onOpen,
  onLife,
  onConditions,
  onLevel,
  selected,
  voicePresence,
  onSelectMember,
  onInvite,
  onHelp,
}: SidebarProps) {
  return (
    <aside className="party" tabIndex={0} aria-label="Družina a příprava">
      <JournalShortcuts pj={pj} onOpen={onOpen} />
      <InitiativeTracker
        data={game.initiative}
        pj={!!pj}
        busy={busy}
        onAction={(values) => act('initiative', values)}
        onEdit={() => onOpen('initiative')}
        onConditions={onConditions}
      />
      <div className="section-title">
        <span>DRUŽINA</span>
        <span>{game.members.length}/12</span>
      </div>
      <LifeSummary members={game.members} pj={!!pj} onOpen={onLife} />
      <div className="party-list">
        {game.members.map((m) => (
          <button
            key={m.id}
            className={
              'member ' +
              (selected === m.id ? 'chosen' : '') +
              (voicePresence[m.id]?.speaking ? ' voice-speaking' : '')
            }
            onClick={() => onSelectMember(m.id)}
          >
            <CharacterAvatar member={m} />
            <span className="member-info">
              <strong>
                {voicePresence[m.id] && (
                  <span
                    className="voice-member"
                    title={
                      voicePresence[m.id].speaking
                        ? 'Právě mluví'
                        : voicePresence[m.id].muted
                          ? 'V hovoru · mikrofon vypnutý'
                          : 'V hovoru'
                    }
                    aria-label={
                      voicePresence[m.id].speaking
                        ? 'Právě mluví'
                        : 'V hovoru'
                    }
                  >
                    ●{' '}
                  </span>
                )}
                {m.name} {m.id === me.id && <small>(ty)</small>}
              </strong>
              <small>
                {m.role === 'pj'
                  ? 'Pán jeskyně'
                  : `${(m.experience ?? 0).toLocaleString('cs-CZ')} zk. · ${m.profession || 'Dobrodruh'}`}
              </small>
              {m.role !== 'pj' && (
                <span className="health">
                  <i style={{ width: `${(m.hp / m.maxHp) * 100}%` }} />
                </span>
              )}
              <LifeBadge hp={m.hp} life={m.life} />
              <ConditionBadges items={m.conditions} />
            </span>
            {m.role !== 'pj' && (
              <span className="hp">
                {m.hp}
                <small>/{m.maxHp}</small>
              </span>
            )}
          </button>
        ))}
      </div>
      <button className="add-party" onClick={onInvite}>
        <Plus size={16} /> Pozvat dalšího hráče
      </button>
      {game.exploration && (
        <PartyOrder
          data={game.exploration}
          members={game.members}
          me={me.id}
          pj={pj}
          busy={busy}
          onAction={(op, values) => act('explore', { op, ...values })}
          onLevel={onLevel}
        />
      )}
      <div className="sidebar-bottom">
        <JourneySummary
          data={game.journey}
          onOpen={() => onOpen('journey')}
        />
        {game.exploration && (
          <SidebarLevels
            data={game.exploration}
            members={game.members}
            me={me.id}
            pj={pj}
            busy={busy}
            onAction={(op, values) => act('explore', { op, ...values })}
            onLevel={onLevel}
          />
        )}
        <div className="quote">
          <Flame size={21} />
          <p>
            „Ne všechna zlata se třpytí.
            <br />
            Některá se hází kostkou.“
          </p>
        </div>
        <button onClick={onHelp}>
          <BookOpen size={17} /> Jak se hraje <ArrowRight size={14} />
        </button>
        <span className="version">U jednoho stolu · první výprava</span>
      </div>
    </aside>
  );
}

export function MobilePartyPanels({
  game,
  me,
  pj,
  busy,
  act,
  onOpen,
  onLife,
  onConditions,
  onLevel,
}: PartyControlsProps) {
  return (
    <>
      <details
        className="mobile-initiative-panel"
        hidden={!pj && !game.initiative?.active}
      >
        <summary>
          Souboj
          {game.initiative?.active
            ? ` · kolo ${game.initiative.round}`
            : ''}
        </summary>
        <InitiativeTracker
          data={game.initiative}
          pj={!!pj}
          busy={busy}
          onAction={(values) => act('initiative', values)}
          onEdit={() => onOpen('initiative')}
          onConditions={onConditions}
        />
      </details>
      <details className="mobile-party-panel">
        <summary>Družina, čas a patra</summary>
        {pj && (
          <button
            className="secondary"
            onClick={() => onOpen('generator')}
          >
            Generátor jeskyně
          </button>
        )}
        <LifeSummary members={game.members} pj={!!pj} onOpen={onLife} />
        <JourneySummary
          data={game.journey}
          onOpen={() => onOpen('journey')}
        />
        {game.exploration && (
          <>
            <PartyOrder
              data={game.exploration}
              members={game.members}
              me={me.id}
              pj={pj}
              busy={busy}
              onAction={(op, values) => act('explore', { op, ...values })}
              onLevel={onLevel}
            />
            <SidebarLevels
              compact
              data={game.exploration}
              members={game.members}
              me={me.id}
              pj={pj}
              busy={busy}
              onAction={(op, values) => act('explore', { op, ...values })}
              onLevel={onLevel}
            />

    </>
            )}
          </details>
    </>
  );
}
