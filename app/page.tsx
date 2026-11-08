'use client';
import { actionValues } from '../components/game-table/game-client';
import { CatalogProvider } from '../components/catalog-provider';
import { type VoicePresence } from '../components/voice-panel';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { Location } from '../lib/exploration';
import MapNoteNotifications, {
  type EncounterTarget,
} from '../components/map-note-notifications';
import type { MapNoteAlertView } from '../lib/map-note-alerts';
import type { MapNoteView, NoteAnchor } from '../lib/map-notes';
import { type DialogHandle } from '../components/guarded-dialog';
import { downloadText } from '../components/campaign-access';
import {
  SituationOverlay,
  useRoomSituations,
} from '../components/room-situation';
import DungeonMap from '../components/dungeon-map';
import { X } from 'lucide-react';
import type { GameView as Game } from './api/game/view';
import type { Session, ChatTab } from '../components/game-table/types';
import Lobby from '../components/game-table/lobby';
import TableHeader from '../components/game-table/table-header';
import PartySidebar, {
  MobilePartyPanels,
} from '../components/game-table/party-sidebar';
import JournalShortcuts from '../components/game-table/journal-shortcuts';
import ChatPanel from '../components/game-table/chat-panel';
import {
  requestGame,
  sendGameAction,
  requestBackup,
  sameSession,
  sessionStorageKey,
} from '../components/game-table/game-client';
import { useGamePolling } from '../components/game-table/use-game-polling';

import TableDialog from '../components/game-table/table-dialog';
import { usePanelNavigation } from '../components/game-table/use-panel-navigation';

export default function Home() {
  const [recapFocus, setRecapFocus] = useState<Location>();
  const [voicePresence, setVoicePresence] = useState<VoicePresence>({});
  const [generationPick, setGenerationPick] = useState(0);
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
    [tab, setTab] = useState<ChatTab>('chat'),
    [text, setText] = useState(''),
    [to, setTo] = useState('all'),
    [dice, setDice] = useState('1k6'),
    [copied, setCopied] = useState(false);
  const [connectionError, setConnectionError] = useState(''),
    [recoveryCode, setRecoveryCode] = useState(''),
    [recoveryName, setRecoveryName] = useState('');
  const sessionCurrent = useRef<Session | null>(session);
  useLayoutEffect(() => {
    sessionCurrent.current = session;
  }, [session]);
  const dialog = useRef<DialogHandle>(null);
  const [noteSnapshot, setNoteSnapshot] = useState<MapNoteView | undefined>(),
    [noteOpenKey, setNoteOpenKey] = useState(0),
    [noteLevelName, setNoteLevelName] = useState('Přízemí'),
    [openingNote, setOpeningNote] = useState(false);
  const [noteAnchor, setNoteAnchor] = useState<NoteAnchor | null>(null),
    [notePublic, setNotePublic] = useState(false);
  const {
    modal,
    setModal,
    recoveryMemberId,
    lifeMemberId,
    lootId,
    lootNoteId,
    challengeId,
    challengeNoteId,
    conditionTarget,
    rollSetup,
    selectedMonster,
    monsterPick,
    setLootId,
    setLootNoteId,
    setChallengeId,
    setChallengeNoteId,
    setSelectedMonster,
    openRecovery,
    openLife,
    openLoot,
    openChallenges,
    openConditions,
    openRoll,
    openPanel,
    placeMonster,
    inspectMonster,
  } = usePanelNavigation(dialog, setError);
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
    values = actionValues(action, values);
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
    alert: Pick<MapNoteAlertView, 'noteId' | 'levelId' | 'levelName'> & {
      id?: string;
    },
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
        JSON.stringify(value),
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
    <CatalogProvider session={session} pj={pj} visuals={game.contentVisuals}>
      <main className="app">
        <TableHeader
          game={game}
          me={me}
          pj={pj}
          connectionError={connectionError}
          copied={copied}
          onEditScene={() => setModal('notes')}
          onAward={() => setModal('experience')}
          onAccount={() => setModal('account')}
          onInvite={copy}
        />
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
          <PartySidebar
            game={game}
            me={me}
            pj={pj}
            busy={busy}
            act={act}
            onOpen={openPanel}
            onLife={openLife}
            onConditions={openConditions}
            onLevel={setEditorLevel}
            selected={selected}
            voicePresence={voicePresence}
            onSelectMember={(id) => {
              setSelected(id);
              if (id === me.id) setModal('character');
            }}
            onInvite={copy}
            onHelp={() => setModal('help')}
          />
          <section className="table">
            <JournalShortcuts mobile pj={pj} onOpen={openPanel} />
            <MobilePartyPanels
              game={game}
              me={me}
              pj={pj}
              busy={busy}
              act={act}
              onOpen={openPanel}
              onLife={openLife}
              onConditions={openConditions}
              onLevel={setEditorLevel}
            />
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
                  pj &&
                    editorLevel &&
                    game.exploration?.levelId !== editorLevel,
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
            openStoryPlace={(id) => {
              const place = game.storyOutline?.places.find(
                (item) => item.id === id,
              );
              if (place)
                openNoteAlert(
                  {
                    noteId: id,
                    levelId: place.levelId,
                    levelName: place.levelName,
                  },
                  () => {},
                );
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
      </main>
    </CatalogProvider>
  );
}
