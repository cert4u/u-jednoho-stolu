'use client';
import { actionValues } from '../components/game-table/game-client';
import { CatalogProvider } from '../components/catalog-provider';
import { type VoicePresence } from '../components/voice-panel';
import { useCallback, useRef, useState } from 'react';
import type { Location } from '../lib/exploration';
import MapNoteNotifications from '../components/map-note-notifications';
import { type DialogHandle } from '../components/guarded-dialog';
import { downloadText } from '../components/campaign-access';
import {
  SituationOverlay,
  useRoomSituations,
} from '../components/room-situation';
import DungeonMap from '../components/dungeon-map';
import { X } from 'lucide-react';
import type { GameView as Game } from './api/game/view';
import type {
  Session,
  SessionScope,
  ChatTab,
} from '../components/game-table/types';
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
  sessionStorageKey,
} from '../components/game-table/game-client';
import { useGameView } from '../components/game-table/use-game-view';
import { useGamePolling } from '../components/game-table/use-game-polling';

import TableDialog from '../components/game-table/table-dialog';
import { useBrowserEntry } from '../components/game-table/use-browser-entry';
import { usePanelNavigation } from '../components/game-table/use-panel-navigation';
import { useMapNoteNavigation } from '../components/game-table/use-map-note-navigation';

export default function Home() {
  const { initial, ready } = useBrowserEntry();
  const [recapFocus, setRecapFocus] = useState<Location>();
  const [voicePresence, setVoicePresence] = useState<VoicePresence>({});
  const [generationPick, setGenerationPick] = useState(0);
  const [scope, setScope] = useState<SessionScope>(() => ({
    session: initial.session,
  }));
  const { session } = scope;
  const { game, view, isCurrentView, setEditorLevel, resetView, acceptGame } =
    useGameView();
  const editorLevel = view.levelId;
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(''),
    [code, setCode] = useState(initial.code),
    [joining, setJoining] = useState(initial.joining),
    [selected, setSelected] = useState(''),
    [tab, setTab] = useState<ChatTab>('chat'),
    [text, setText] = useState(''),
    [to, setTo] = useState('all'),
    [dice, setDice] = useState('1k6'),
    [copied, setCopied] = useState(false);
  const [connectionError, setConnectionError] = useState(''),
    [recoveryCode, setRecoveryCode] = useState(''),
    [recoveryName, setRecoveryName] = useState('');
  const sessionCurrent = useRef(scope);
  const dialog = useRef<DialogHandle>(null);
  const navigation = usePanelNavigation(dialog, setError);
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
    resetPanels,
    openRecovery,
    openLife,
    openLoot,
    openChallenges,
    openConditions,
    openRoll,
    openPanel,
    placeMonster,
    inspectMonster,
  } = navigation;
  const me = game?.members.find((m) => m.id === game.me);
  const pj = me?.role === 'pj';
  const {
    selection: noteSelection,
    openingNote,
    openMapNote,
    openNoteAlert,
    resetNotes,
  } = useMapNoteNavigation({
    game,
    view,
    isCurrentView,
    acceptGame,
    setEditorLevel,
    setError,
    scope,
    sessionCurrent,
    dialog,
    navigation,
  });
  const changeSession = useCallback(
    (next: Session | null, snapshot: Game | null = null) => {
      // Invalidate old requests immediately, before React commits the new table.
      const nextScope = { session: next };
      sessionCurrent.current = nextScope;
      setScope(nextScope);
      resetView(snapshot);
      setBusy(false);
      setError('');
      setConnectionError('');
      setSelected('');
      setRecapFocus(undefined);
      setGenerationPick(0);
      setVoicePresence({});
      setTab('chat');
      setText('');
      setTo('all');
      setDice('1k6');
      setCopied(false);
      setRecoveryCode('');
      setRecoveryName('');
      resetPanels();
      resetNotes();
      try {
        if (next) localStorage.setItem(sessionStorageKey, JSON.stringify(next));
        else localStorage.removeItem(sessionStorageKey);
      } catch {
        // The current tab can still play when browser storage is unavailable.
      }
    },
    [resetNotes, resetPanels, resetView],
  );
  useGamePolling({
    scope,
    sessionCurrent,
    view,
    isCurrentView,
    changeSession,
    acceptGame,
    setConnectionError,
  });
  const situations = useRoomSituations(
    session ? session.room + ':' + session.token : undefined,
    game?.messages,
  );
  async function act(action: string, values: Record<string, unknown> = {}) {
    const isCurrent = () => sessionCurrent.current === scope;
    if (!isCurrent() || !isCurrentView(view)) return false;
    values = actionValues(action, values);
    setBusy(true);
    setError('');
    try {
      const displayedLevel = editorLevel || game?.exploration?.levelId;
      const d = await sendGameAction(session, displayedLevel, action, values);
      if (!isCurrent()) return false;
      if (d.token) {
        changeSession({ room: d.room, token: d.token }, d.game);
        setModal('account');
      }
      if (d.recoveryCode) {
        setRecoveryCode(d.recoveryCode);
        const memberId = d.recoveryCode.split(':')[1];
        setRecoveryName(
          d.game.members.find((m) => m.id === memberId)?.name || 'Postava',
        );
      }
      if (!d.token && isCurrentView(view)) {
        if (action === 'generate' && d.generatedLevels?.[0]) {
          acceptGame(setEditorLevel(d.generatedLevels[0]), d.game);
          setGenerationPick((n) => n + 1);
        } else if (
          action === 'explore' &&
          ['travel', 'place'].includes(String(values.op))
        ) {
          acceptGame(setEditorLevel(''), d.game);
        } else {
          const returnedLevel = d.game.exploration?.levelId;
          const wantedLevel =
            editorLevel || d.game.exploration?.location?.levelId;
          if (!pj || !wantedLevel || returnedLevel === wantedLevel)
            acceptGame(view, d.game);
        }
      }
      return true;
    } catch (e) {
      if (isCurrent())
        setError(e instanceof Error ? e.message : 'Něco se nepodařilo.');
      return false;
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  function locateRecap(location: Location) {
    const action = () => {
      if (sessionCurrent.current !== scope) return;
      if (pj) setEditorLevel(location.levelId);
      setRecapFocus({ ...location });
      setModal('');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  async function reloadEquipment() {
    const isCurrent = () => sessionCurrent.current === scope;
    if (!session || !isCurrent() || !isCurrentView(view)) return false;
    setBusy(true);
    setError('');
    try {
      const { response, data } = await requestGame(session, editorLevel);
      if (!isCurrent() || !isCurrentView(view)) return false;
      if (!response.ok)
        throw new Error(data.error || 'Výbavu se nepodařilo načíst.');
      acceptGame(view, data);
      return true;
    } catch (e) {
      if (isCurrent() && isCurrentView(view)) {
        setError(
          e instanceof Error ? e.message : 'Výbavu se nepodařilo načíst.',
        );
      }
      return false;
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  function leave() {
    if (sessionCurrent.current === scope) changeSession(null);
  }
  async function copy() {
    if (!session || sessionCurrent.current !== scope) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${session.room}`,
      );
      if (sessionCurrent.current !== scope) return;
      setCopied(true);
      setTimeout(() => {
        if (sessionCurrent.current === scope) setCopied(false);
      }, 2500);
    } catch {
      if (sessionCurrent.current === scope) {
        setError('Odkaz nelze zkopírovat. Kód místnosti: ' + session.room);
      }
    }
  }
  async function exportGame() {
    if (!session || sessionCurrent.current !== scope) return;
    setError('');
    try {
      const value = await requestBackup(session);
      if (sessionCurrent.current !== scope) return;
      downloadText(
        'kampan-zaloha.json',
        JSON.stringify(value),
        'application/json',
      );
    } catch (e) {
      if (sessionCurrent.current === scope) {
        setError(
          e instanceof Error ? e.message : 'Zálohu se nepodařilo stáhnout.',
        );
      }
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
            setVoicePresence={(presence) => {
              if (sessionCurrent.current === scope) setVoicePresence(presence);
            }}
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
              ...noteSelection,
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
