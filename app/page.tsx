'use client';
import {CatalogProvider} from '../components/catalog-provider';
import { type VoicePresence } from '../components/voice-panel';
import { LifeBadge, LifeSummary } from '../components/life-panel';
import { useState, useEffect, useRef } from 'react';
import type { Location } from '../lib/exploration';
import MapNoteNotifications, {
  type EncounterTarget,
} from '../components/map-note-notifications';
import type { MapNoteAlertView } from '../lib/map-note-alerts';
import type { MapNoteView, NoteAnchor } from '../lib/map-notes';
import { JourneySummary } from '../components/journey-panel';
import ConditionBadges from '../components/condition-badges';
import { InitiativeTracker } from '../components/initiative-panel';
import type { InitiativeRef } from '../lib/initiative';
import { PartyOrder, SidebarLevels } from '../components/party-sidebar';
import { type DialogHandle } from '../components/guarded-dialog';
import { downloadText } from '../components/campaign-access';
import { type RollSetup } from '../components/mechanics-panel';
import {
  SituationOverlay,
  useRoomSituations,
} from '../components/room-situation';
import CharacterAvatar from '../components/character-avatar';
import DungeonMap from '../components/dungeon-map';
import {
  Swords,
  BookOpen,
  ScrollText,
  Dices,
  Plus,
  ArrowRight,
  Check,
  PenTool,
  X,
  Flame,
  Star,
  Skull,
} from 'lucide-react';
import type { GameView as Game } from './api/game/view';
import type { Session, ChatTab } from '../components/game-table/types';
import Lobby from '../components/game-table/lobby';
import ChatPanel from '../components/game-table/chat-panel';
import {
  requestGame,
  sendGameAction,
  requestBackup,
  sameSession,
  sessionStorageKey,
} from '../components/game-table/game-client';
import { useGamePolling } from '../components/game-table/use-game-polling';

import TableDialog, {
  type TablePanel,
} from '../components/game-table/table-dialog';

export default function Home() {
  const [recapFocus, setRecapFocus] = useState<Location>();
  const [voicePresence, setVoicePresence] = useState<VoicePresence>({});
  const [generationPick, setGenerationPick] = useState(0);
  const [recoveryMemberId, setRecoveryMemberId] = useState<
    string | undefined
  >();
  const [lifeMemberId, setLifeMemberId] = useState<string | undefined>();
  const [lootId, setLootId] = useState(''),
    [lootNoteId, setLootNoteId] = useState<string | undefined>();
  const [challengeId, setChallengeId] = useState(''),
    [challengeNoteId, setChallengeNoteId] = useState<string | undefined>();
  const [session, setSession] = useState<Session | null>(null),
    [game, setGame] = useState<Game | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [joining, setJoining] = useState(false),
    [editorLevel, setEditorLevel] = useState(''),
    [selected, setSelected] = useState(''),
    [selectedMonster, setSelectedMonster] = useState(''),
    [monsterPick, setMonsterPick] = useState(0),
    [tab, setTab] = useState<ChatTab>('chat'),
    [modal, setModal] = useState<TablePanel | ''>(''),
    [text, setText] = useState(''),
    [to, setTo] = useState('all'),
    [dice, setDice] = useState('1k6'),
    [copied, setCopied] = useState(false);
  const [connectionError, setConnectionError] = useState(''),
    [recoveryCode, setRecoveryCode] = useState(''),
    [recoveryName, setRecoveryName] = useState('');
  const sessionCurrent = useRef<Session | null>(session);
  sessionCurrent.current = session;
  const dialog = useRef<DialogHandle>(null);
  const [noteSnapshot, setNoteSnapshot] = useState<MapNoteView | undefined>(),
    [noteOpenKey, setNoteOpenKey] = useState(0),
    [noteLevelName, setNoteLevelName] = useState('Přízemí'),
    [openingNote, setOpeningNote] = useState(false);
  const [noteAnchor, setNoteAnchor] = useState<NoteAnchor | null>(null),
    [notePublic, setNotePublic] = useState(false);
  const [conditionTarget, setConditionTarget] = useState<
    InitiativeRef | undefined
  >();
  const [rollSetup, setRollSetup] = useState<RollSetup>({});
  const me = game?.members.find((m) => m.id === game.me);
  const pj = me?.role === 'pj';
  const mapNote =
    (game?.exploration?.levelId || 'ground') === noteAnchor?.levelId
      ? game?.mapNotes?.find(
          (n) =>
            n.levelId === noteAnchor.levelId &&
            n.x === noteAnchor.x &&
            n.y === noteAnchor.y,
        )
      : modal === 'map-note'
        ? noteSnapshot
        : undefined;
  useEffect(() => {
    try {
      const s = localStorage.getItem(sessionStorageKey);
      if (s) setSession(JSON.parse(s));
      const invite = new URLSearchParams(location.search).get('room');
      if (invite) {
        setCode(invite);
        setJoining(true);
      }
    } catch {}
    setReady(true);
  }, []);
  useGamePolling({
    session,
    sessionCurrent,
    editorLevel,
    setSession,
    setGame,
    setConnectionError,
  });
  const situations = useRoomSituations(
    session ? session.room + ':' + session.token : undefined,
    game?.messages,
  );
  async function act(action: string, values: Record<string, unknown> = {}) {
    if (
      [
        'explore',
        'monster',
        'mechanics',
        'initiative',
        'condition',
        'power',
        'recovery',
        'journey',
        'map-note',
        'challenge',
        'loot',
        'equipment',
        'life',
        'generate',
      ].includes(action) &&
      !values.requestId
    )
      values = { ...values, requestId: crypto.randomUUID() };
    const current = sessionCurrent.current;
    const sessionChanged = () =>
      Boolean(current && !sameSession(sessionCurrent.current, current));
    setBusy(true);
    setError('');
    try {
      const d = await sendGameAction(
        current,
        editorLevel || game?.exploration?.levelId,
        action,
        values,
      );
      if (sessionChanged()) return false;
      if (d.recoveryCode) {
        setRecoveryCode(d.recoveryCode);
        const memberId = d.recoveryCode.split(':')[1];
        setRecoveryName(
          d.game.members.find((m) => m.id === memberId)?.name || 'Postava',
        );
      }
      if (d.token) {
        setBusy(false);
        setRecapFocus(undefined);
        setNoteSnapshot(undefined);
        setEditorLevel('');
        setSelected('');
        setSelectedMonster('');
        const s = { room: d.room, token: d.token };
        sessionCurrent.current = s;
        localStorage.setItem(sessionStorageKey, JSON.stringify(s));
        setSession(s);
        setModal('account');
      }
      if (action === 'generate' && d.generatedLevels?.[0]) {
        setEditorLevel(d.generatedLevels[0]);
        setGenerationPick((n) => n + 1);
      }
      if (
        action === 'explore' &&
        ['travel', 'place'].includes(String(values.op))
      )
        setEditorLevel('');
      setGame((previous) =>
        d.token || !previous || d.game.revision >= (previous.revision ?? -1)
          ? d.game
          : previous,
      );
      return true;
    } catch (e) {
      if (!sessionChanged())
        setError(e instanceof Error ? e.message : 'Něco se nepodařilo.');
      return false;
    } finally {
      if (!sessionChanged()) setBusy(false);
    }
  }
  function locateRecap(location: Location) {
    const action = () => {
      if (pj) setEditorLevel(location.levelId);
      setRecapFocus({ ...location });
      setModal('');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  function openMapNote(anchor: NoteAnchor, publicView: boolean) {
    const action = () => {
      setError('');
      setNoteSnapshot(undefined);
      setNoteOpenKey((k) => k + 1);
      setNoteLevelName(game?.exploration?.levelName || 'Přízemí');
      setNoteAnchor(anchor);
      setNotePublic(publicView);
      setModal('map-note');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  function openNoteAlert(
    alert: Pick<MapNoteAlertView, 'noteId' | 'levelId' | 'levelName'> & {id?: string},
    opened: () => void,
    target?: EncounterTarget,
  ) {
    const action = async () => {
      const current = sessionCurrent.current;
      if (!current) return;
      setOpeningNote(true);
      setError('');
      try {
        const { response, data } = await requestGame(current, alert.levelId);
        if (!response.ok)
          throw new Error(data.error || 'Přípravu se nepodařilo načíst.');
        if (!sameSession(sessionCurrent.current, current)) return;
        const note = data.mapNotes?.find((item) => item.id === alert.noteId);
        if (!note) throw new Error('Poznámka už není dostupná.');
        if (target) {
          const links =
            data.noteAlerts?.find((item) => item.id === alert.id)?.encounter ??
            [];
          const available =
            target.kind === 'combat'
              ? links.some((item) => item.kind === 'monster')
              : links.some(
                  (item) => item.kind === target.kind && item.id === target.id,
                );
          if (!available)
            throw new Error('Tato část setkání už není dostupná.');
        }
        setEditorLevel(alert.levelId);
        setGame((previous) =>
          !previous || data.revision >= previous.revision ? data : previous,
        );
        switch (target?.kind) {
          case 'challenge':
            setChallengeId(target.id);
            setChallengeNoteId(undefined);
            setModal('challenges');
            break;
          case 'loot':
            setLootId(target.id);
            setLootNoteId(undefined);
            setModal('loot');
            break;
          case 'monster':
            setSelectedMonster(target.id);
            setModal('monsters');
            break;
          case 'combat':
            setModal('initiative');
            break;
          default:
            setNoteSnapshot(note);
            setNoteOpenKey((key) => key + 1);
            setNoteLevelName(alert.levelName);
            setNoteAnchor({ levelId: alert.levelId, x: note.x, y: note.y });
            setNotePublic(false);
            setModal('map-note');
        }
        if (!target) opened();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Přípravu se nepodařilo otevřít.',
        );
      } finally {
        setOpeningNote(false);
      }
    };
    if (dialog.current) dialog.current.run(() => void action());
    else void action();
  }
  async function reloadEquipment() {
    const current = sessionCurrent.current;
    if (!current) return false;
    setBusy(true);
    setError('');
    try {
      const { response, data } = await requestGame(current, editorLevel);
      if (!response.ok)
        throw new Error(data.error || 'Výbavu se nepodařilo načíst.');
      if (!sameSession(sessionCurrent.current, current)) return false;
      setGame((previous) =>
        !previous || data.revision >= previous.revision ? data : previous,
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Výbavu se nepodařilo načíst.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  function openRecovery(id?: string) {
    const action = () => {
      setError('');
      setRecoveryMemberId(id);
      setModal('recovery');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  function openLife(id?: string) {
    const action = () => {
      setError('');
      setLifeMemberId(id);
      setModal('life');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  function openLoot(id = '', noteId?: string) {
    const action = () => {
      setError('');
      setLootId(id);
      setLootNoteId(noteId);
      setModal('loot');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  function openChallenges(id = '', noteId?: string) {
    const action = () => {
      setError('');
      setChallengeId(id);
      setChallengeNoteId(noteId);
      setModal('challenges');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  function openConditions(target?: InitiativeRef) {
    const action = () => {
      setError('');
      setConditionTarget(target);
      setModal('conditions');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  function openRoll(setup: RollSetup = {}) {
    const action = () => {
      setError('');
      setRollSetup(setup);
      setModal('mechanics');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  function openPanel(name: TablePanel) {
    if (name === 'recovery') {
      openRecovery();
      return;
    }
    if (name === 'loot') {
      openLoot();
      return;
    }
    if (name === 'mechanics') openRoll();
    else {
      const action = () => {
        setError('');
        setModal(name);
      };
      if (dialog.current) dialog.current.run(action);
      else action();
    }
  }
  function placeMonster(id: string) {
    setSelectedMonster(id);
    setMonsterPick((n) => n + 1);
    setModal('');
  }
  function inspectMonster(id = '') {
    setSelectedMonster(id);
    setModal('monsters');
  }
  function leave() {
    sessionCurrent.current = null;
    setBusy(false);
    setRecapFocus(undefined);
    setNoteSnapshot(undefined);
    localStorage.removeItem(sessionStorageKey);
    setSession(null);
    setGame(null);
    setRecoveryCode('');
    setModal('');
    setConnectionError('');
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${session?.room}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Odkaz nelze zkopírovat. Kód místnosti: ' + session?.room);
    }
  }
  async function exportGame() {
    setError('');
    try {
      if (!session) return;
      const value = await requestBackup(session);
      downloadText(
        'kampan-zaloha.json',
        JSON.stringify(value, null, 2),
        'application/json',
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Zálohu se nepodařilo stáhnout.',
      );
    }
  }

  if (!ready) return <div className="loading">Rozsvěcujeme pochodně…</div>;
  if (!session)
    return (
      <Lobby
        name={name}
        code={code}
        joining={joining}
        busy={busy}
        error={error}
        setName={setName}
        setCode={setCode}
        setJoining={setJoining}
        setError={setError}
        act={act}
      />
    );
  if (!game || !me)
    return (
      <div className="loading">
        {error || 'Připravujeme váš stůl…'}
        <button onClick={leave}>Zpět</button>
      </div>
    );
  return (
    <CatalogProvider session={session} pj={me.role==='pj'} visuals={game.contentVisuals}><main className="app">
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
              onClick={() => setModal('notes')}
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
          <button
            className="invite award-open"
            onClick={() => setModal('experience')}
          >
            <Star size={15} />
            <span>Přidělit zkušenosti</span>
          </button>
        )}
        <button onClick={copy} className="invite">
          {copied ? <Check size={15} /> : <Plus size={15} />}{' '}
          {copied ? 'Odkaz zkopírován' : 'Pozvat družinu'}
        </button>
        <button
          className="avatar"
          onClick={() => setModal('account')}
          title="Tvůj přístup"
        >
          {me.name[0]}
        </button>
      </header>
      {(error || connectionError) && (
        <div className="error-banner" role="alert">
          {error || connectionError}
          {error && (
            <button onClick={() => setError('')} aria-label="Zavřít zprávu">
              <X size={14} />
            </button>
          )}
        </div>
      )}
      <MapNoteNotifications
        key={session.room + ':' + me.id}
        alerts={pj ? game.noteAlerts || [] : []}
        room={session.room}
        me={me.id}
        loading={openingNote}
        blocked={!!modal}
        onOpen={openNoteAlert}
      />
      <div className="workspace">
        <aside className="party" tabIndex={0} aria-label="Družina a příprava">
          <JournalShortcuts pj={pj} onOpen={openPanel} />
          <InitiativeTracker
            data={game.initiative}
            pj={!!pj}
            busy={busy}
            onAction={(values) => act('initiative', values)}
            onEdit={() => openPanel('initiative')}
            onConditions={openConditions}
          />
          <div className="section-title">
            <span>DRUŽINA</span>
            <span>{game.members.length}/12</span>
          </div>
          <LifeSummary members={game.members} pj={!!pj} onOpen={openLife} />
          <div className="party-list">
            {game.members.map((m) => (
              <button
                key={m.id}
                className={
                  'member ' +
                  (selected === m.id ? 'chosen' : '') +
                  (voicePresence[m.id]?.speaking ? ' voice-speaking' : '')
                }
                onClick={() => {
                  setSelected(m.id);
                  if (m.id === me.id) setModal('character');
                }}
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
          <button className="add-party" onClick={copy}>
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
              onLevel={setEditorLevel}
            />
          )}
          <div className="sidebar-bottom">
            <JourneySummary
              data={game.journey}
              onOpen={() => openPanel('journey')}
            />
            {game.exploration && (
              <SidebarLevels
                data={game.exploration}
                members={game.members}
                me={me.id}
                pj={pj}
                busy={busy}
                onAction={(op, values) => act('explore', { op, ...values })}
                onLevel={setEditorLevel}
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
            <button onClick={() => setModal('help')}>
              <BookOpen size={17} /> Jak se hraje <ArrowRight size={14} />
            </button>
            <span className="version">U jednoho stolu · první výprava</span>
          </div>
        </aside>
        <section className="table">
          <JournalShortcuts mobile pj={pj} onOpen={openPanel} />
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
              onEdit={() => openPanel('initiative')}
              onConditions={openConditions}
            />
          </details>
          <details className="mobile-party-panel">
            <summary>Družina, čas a patra</summary>
            {pj && (
              <button
                className="secondary"
                onClick={() => openPanel('generator')}
              >
                Generátor jeskyně
              </button>
            )}
            <LifeSummary members={game.members} pj={!!pj} onOpen={openLife} />
            <JourneySummary
              data={game.journey}
              onOpen={() => openPanel('journey')}
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
                  onLevel={setEditorLevel}
                />
                <SidebarLevels
                  compact
                  data={game.exploration}
                  members={game.members}
                  me={me.id}
                  pj={pj}
                  busy={busy}
                  onAction={(op, values) => act('explore', { op, ...values })}
                  onLevel={setEditorLevel}
                />
              </>
            )}
          </details>
          <DungeonMap
            recapFocus={recapFocus}
            loot={game.loot || []}
            challenges={game.challenges || []}
            onOpenLoot={(id) => openLoot(id)}
            onOpenChallenge={(id) => openChallenges(id)}
            generationPick={generationPick}
            onGenerate={() => openPanel('generator')}
            notes={game.mapNotes || []}
            onOpenNote={openMapNote}
            monsters={game.monsters || []}
            selectedMonster={selectedMonster}
            monsterPick={monsterPick}
            onInspectMonster={inspectMonster}
            map={game.dungeon}
            members={game.members}
            me={me.id}
            pj={pj}
            busy={
              busy ||
              Boolean(
                pj && editorLevel && game.exploration?.levelId !== editorLevel,
              )
            }
            canUndo={game.canUndoMap}
            exploration={game.exploration}
            onLevel={setEditorLevel}
            selected={selected}
            onSelect={setSelected}
            onAction={act}
          />
          <SituationOverlay
            message={modal ? undefined : situations.next}
            onDismiss={situations.dismiss}
          />
        </section>
        <ChatPanel
          game={game}
          me={me}
          pj={pj}
          session={session}
          busy={busy}
          tab={tab}
          setTab={setTab}
          pendingSituationIds={situations.pendingIds}
          text={text}
          setText={setText}
          to={to}
          setTo={setTo}
          dice={dice}
          setDice={setDice}
          setVoicePresence={setVoicePresence}
          act={act}
          openLoot={openLoot}
          openChallenges={openChallenges}
          openRoll={openRoll}
        />
      </div>
      {modal && (
        <TableDialog
          key={session.room + ':' + session.token + ':' + modal}
          modal={modal}
          dialog={dialog}
          game={game}
          me={me}
          session={session}
          busy={busy}
          error={error}
          selection={{
            lifeMemberId,
            recoveryMemberId,
            lootId,
            lootNoteId,
            challengeId,
            challengeNoteId,
            noteAnchor,
            notePublic,
            noteOpenKey,
            mapNote,
            noteLevelName,
            conditionTarget,
            rollSetup,
            selectedMonster,
            recoveryCode,
            recoveryName,
          }}
          act={act}
          setModal={setModal}
          setTab={setTab}
          openPanel={openPanel}
          openRecovery={openRecovery}
          openLife={openLife}
          openLoot={openLoot}
          openChallenges={openChallenges}
          openStoryPlace={id => {
            const place = game.storyOutline?.places.find(item => item.id === id);
            if (place) openNoteAlert({ noteId: id, levelId: place.levelId, levelName: place.levelName }, () => {});
          }}
          locateRecap={locateRecap}
          placeMonster={placeMonster}
          openRoll={openRoll}
          reloadEquipment={reloadEquipment}
          copy={copy}
          exportGame={exportGame}
          leave={leave}
        />
      )}
    </main></CatalogProvider>
  );
}

function JournalShortcuts({
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
