'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { GameView } from '../../app/api/game/view';
import type { Location } from '../../lib/exploration';
import { CatalogProvider } from '../catalog-provider';
import DungeonMap from '../dungeon-map';
import type { DialogHandle } from '../guarded-dialog';
import MapNoteNotifications from '../map-note-notifications';
import { SituationOverlay, useRoomSituations } from '../room-situation';
import type { VoicePresence } from '../voice-panel';
import ChatPanel from './chat-panel';
import JournalShortcuts from './journal-shortcuts';
import PartySidebar, { MobilePartyPanels } from './party-sidebar';
import TableDialog from './table-dialog';
import TableHeader from './table-header';
import type { ChatTab, Session } from './types';
import { useMapNoteNavigation } from './use-map-note-navigation';
import { usePanelNavigation } from './use-panel-navigation';
import type { useTableSession } from './use-table-session';

type Props = {
  table: ReturnType<typeof useTableSession> & {
    session: Session;
    game: GameView;
  };
  me: GameView['members'][number];
};

export default function TableWorkspace({ table, me }: Props) {
  const {
    game,
    session,
    openAccount,
    isCurrentSession,
    view,
    isCurrentView,
    acceptGame,
    setEditorLevel,
    generationPick,
    error,
    setError,
    busy,
    connectionError,
    recoveryCode,
    recoveryName,
    copied,
    act,
    reloadEquipment,
    copyInvite,
    exportGame,
    leave,
  } = table;
  const editorLevel = view.levelId;
  const pj = me.role === 'pj';
  const [recapFocus, setRecapFocus] = useState<Location>();
  const [voicePresence, setVoicePresence] = useState<VoicePresence>({});
  const [selected, setSelected] = useState('');
  const [tab, setTab] = useState<ChatTab>('chat');
  const [draft, setDraft] = useState({ text: '' });
  const [to, setTo] = useState('all');
  const [dice, setDice] = useState('1k6');
  const dialog = useRef<DialogHandle>(null);
  const navigation = usePanelNavigation(
    dialog,
    setError,
    openAccount ? 'account' : '',
  );
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
    openRecovery,
    openLife,
    openLoot,
    openChallenges,
    openConditions,
    openRoll,
    openPanel,
    placeMonster,
    inspectMonster,
    showEncounter,
  } = navigation;
  const {
    selection: noteSelection,
    openingNote,
    openMapNote,
    openNoteAlert,
  } = useMapNoteNavigation({
    game,
    view,
    isCurrentView,
    acceptGame,
    setEditorLevel,
    setError,
    session,
    isCurrentSession,
    dialog,
    noteDialogOpen: modal === 'map-note',
    showNote: () => setModal('map-note'),
    showEncounter,
  });
  const situations = useRoomSituations(
    session.room + ':' + session.token,
    game.messages,
  );

  function locateRecap(location: Location) {
    const action = () => {
      if (!isCurrentSession()) return;
      if (pj) setEditorLevel(location.levelId);
      setRecapFocus({ ...location });
      setModal('');
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
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
          onInvite={copyInvite}
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
            onInvite={copyInvite}
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
            draft={draft}
            setDraft={setDraft}
            to={to}
            setTo={setTo}
            dice={dice}
            setDice={setDice}
            setVoicePresence={(presence) => {
              if (isCurrentSession()) setVoicePresence(presence);
            }}
            act={act}
            openLoot={openLoot}
            openChallenges={openChallenges}
            openRoll={openRoll}
          />
        </div>
        {modal && (
          <TableDialog
            key={modal}
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
            copy={copyInvite}
            exportGame={exportGame}
            leave={leave}
          />
        )}
      </main>
    </CatalogProvider>
  );
}
