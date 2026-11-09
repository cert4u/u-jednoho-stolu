'use client';
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Dices,
  Flame,
  MessageSquare,
  Send,
  Shield,
  Star,
  Users,
} from 'lucide-react';
import VoicePanel, { type VoicePresence } from '../voice-panel';
import { ChallengeCards } from '../challenges-panel';
import PendingActions from '../pending-actions';
import { SituationCard } from '../room-situation';
import type { RollSetup } from '../mechanics-panel';
import type { GameView, MemberView } from '../../app/api/game/view';
import type { GameAction, Session, ChatTab } from './types';
type ChatDraft = { text: string };

type Props = {
  game: GameView;
  me: MemberView;
  pj: boolean;
  session: Session;
  busy: boolean;
  tab: ChatTab;
  setTab: (tab: ChatTab) => void;
  pendingSituationIds: ReadonlySet<string>;
  draft: ChatDraft;
  setDraft: Dispatch<SetStateAction<ChatDraft>>;
  to: string;
  setTo: (to: string) => void;
  dice: string;
  setDice: (dice: string) => void;
  setVoicePresence: (presence: VoicePresence) => void;
  act: GameAction;
  openLoot: () => void;
  openChallenges: (id?: string, noteId?: string) => void;
  openRoll: (setup: RollSetup) => void;
};

export default function ChatPanel({
  game,
  me,
  pj,
  session,
  busy,
  tab,
  setTab,
  pendingSituationIds,
  draft,
  setDraft,
  to,
  setTo,
  dice,
  setDice,
  setVoicePresence,
  act,
  openLoot,
  openChallenges,
  openRoll,
}: Props) {
  const { text } = draft;
  const chatEnd = useRef<HTMLDivElement>(null);
  const chatMessages = game.messages.filter(
    (message) =>
      !pendingSituationIds.has(message.id) && (tab === 'chat' || message.roll),
  );
  const lastMessageId = chatMessages.at(-1)?.id;
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [lastMessageId, tab]);
  return (
    <aside className="chat-panel">
      <div className="chat-tabs">
        <button onClick={() => openLoot()}>Kořist</button>
        <button
          className={tab === 'chat' ? 'active' : ''}
          onClick={() => setTab('chat')}
        >
          <MessageSquare size={16} /> U stolu
        </button>
        <button
          className={tab === 'dice' ? 'active' : ''}
          onClick={() => setTab('dice')}
        >
          <Dices size={17} /> Kostky
        </button>
      </div>
      <VoicePanel
        key={session.room + session.token}
        session={session}
        onPresence={setVoicePresence}
      />
      <ChallengeCards
        items={game.challenges || []}
        me={me.id}
        pj={!!pj}
        busy={busy}
        onOpen={openChallenges}
        onAction={(values) => act('challenge', values)}
      />
      <div tabIndex={0} aria-label="Zprávy u stolu" className="messages">
        <PendingActions
          messages={game.pendingActions || []}
          me={me.id}
          pj={!!pj}
          busy={busy}
          onOpen={openRoll}
          onCancel={(id) => act('mechanics', { kind: 'cancel', messageId: id })}
        />
        {tab === 'dice' && (
          <div className="dice-info">
            <Dices size={30} />
            <h3>Nech rozhodnout náhodu.</h3>
            <p>Vyber kostku. Výsledek uvidí příjemce zprávy.</p>
          </div>
        )}
        {chatMessages.length === 0 && (
          <div className="welcome">
            <span className="welcome-icon">
              <Flame size={26} />
            </span>
            <span className="tiny">NOVÁ KAPITOLA</span>
            <h3>Dobrodružství začíná.</h3>
            <p>
              Pochodně hoří, kostky čekají.
              <br />
              První slovo má vaše družina.
            </p>
            <span className="welcome-line" />
          </div>
        )}
        {chatMessages.map((m) =>
          m.parchment ? (
            <SituationCard key={m.id} message={m} />
          ) : (
            <article
              key={m.id}
              className={
                'message ' +
                (m.roll ? 'roll' : '') +
                (m.to !== 'all' ? ' whisper' : '') +
                (m.experience ? ' experience-message' : '')
              }
            >
              <div>
                <strong>{m.name}</strong>
                <time>
                  {new Date(m.time).toLocaleTimeString('cs', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              {m.to !== 'all' && (
                <small>
                  Šeptání →{' '}
                  {game.members.find((x) => x.id === m.to)?.name || 'hráč'}
                </small>
              )}
              <p>
                {m.roll && <Dices size={17} />}{' '}
                {m.experience && <Star size={16} />} {m.text}
              </p>
              {m.mechanics?.kind === 'attack' &&
                !m.mechanics.defenseId &&
                !m.mechanics.cancelled &&
                (pj ||
                  (m.mechanics.target?.type === 'member' &&
                    m.mechanics.target.id === me.id)) && (
                  <button
                    className="roll-followup"
                    disabled={busy}
                    onClick={() => openRoll({ attackId: m.id })}
                  >
                    <Shield size={13} /> Hodit obranu
                  </button>
                )}
              {pj &&
                m.mechanics?.kind === 'defense' &&
                m.mechanics.attackId &&
                !m.mechanics.applied &&
                !m.mechanics.cancelled && (
                  <button
                    className="roll-followup"
                    disabled={busy}
                    onClick={() => openRoll({ defenseId: m.id })}
                  >
                    Potvrdit zranění
                  </button>
                )}
              {m.mechanics?.applied && (
                <small className="roll-confirmed">PJ potvrdil výsledek</small>
              )}
            </article>
          ),
        )}
        <div ref={chatEnd} />
      </div>
      <div className="chat-compose">
        <div className="dice-row">
          {[4, 6, 8, 10, 12, 20].map((n) => (
            <button
              key={n}
              title={`Hodit k${n}`}
              disabled={busy}
              onClick={() => act('roll', { text: `1k${n}`, to })}
            >
              <Dices size={15} />
              <span>k{n}</span>
            </button>
          ))}
        </div>
        {tab === 'dice' && (
          <form
            className="custom-roll"
            onSubmit={(e) => {
              e.preventDefault();
              act('roll', { text: dice, to });
            }}
          >
            <input
              aria-label="Vlastní hod"
              value={dice}
              onChange={(e) => setDice(e.target.value)}
              placeholder="2k6+1"
            />
            <button disabled={busy}>
              Hodit <ArrowRight size={14} />
            </button>
          </form>
        )}
        <label className="recipient">
          <Users size={14} />
          <select
            aria-label="Příjemce zprávy"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            <option value="all">Celé družině</option>
            {game.members
              .filter((m) => m.id !== me.id)
              .map((m) => (
                <option value={m.id} key={m.id}>
                  Šeptat: {m.name}
                </option>
              ))}
          </select>
          <ChevronDown size={13} />
        </label>
        <form
          className="message-input"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || !text.trim()) return;
            if (
              await act(text.startsWith('/hod ') ? 'roll' : 'chat', {
                text: text.replace(/^\/hod /, ''),
                to,
              })
            ) {
              // Acknowledging this send can only clear the draft it submitted.
              setDraft((current) =>
                current === draft ? { text: '' } : current,
              );
            }
          }}
        >
          <input
            aria-label="Zpráva"
            placeholder={
              to === 'all' ? 'Co se děje u stolu?' : 'Napiš tajnou zprávu…'
            }
            value={text}
            onChange={(e) => setDraft({ text: e.target.value })}
            maxLength={2000}
          />
          <button aria-label="Odeslat zprávu" disabled={busy || !text.trim()}>
            <Send size={17} />
          </button>
        </form>
        <small className="compose-hint">
          Enter odešle · /hod 2k6+1 hodí kostkami
        </small>
      </div>
    </aside>
  );
}
