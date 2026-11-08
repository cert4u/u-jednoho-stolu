import { Check } from 'lucide-react';
import GeneratorPanel from '../generator-panel';
import LootPanel from '../loot-panel';
import ChallengesPanel from '../challenges-panel';
import StoryOutlinePanel from '../story-outline-panel';
import SessionRecapPanel from '../session-recap-panel';
import MapNoteEditor, { MapNoteReader } from '../map-note-panel';
import SafeForm from '../safe-form';
import MonsterManager from '../monster-manager';
import type { PanelContentProps } from './table-dialog-types';

// Render helpers return elements only; stateful hooks belong in the panel components.
export function renderAdventurePanels({
  modal,
  game,
  me,
  session,
  busy,
  act,
  setModal,
  setTab,
  openPanel,
  openLoot,
  openChallenges,
  openStoryPlace,
  locateRecap,
  placeMonster,
  openRoll,
  submitAndClose,
  selection,
}: PanelContentProps) {
  const pj = me.role === 'pj';
  const {
    lootId,
    lootNoteId,
    challengeId,
    challengeNoteId,
    noteAnchor,
    notePublic,
    noteOpenKey,
    mapNote,
    noteLevelName,
    selectedMonster,
  } = selection;
  switch (modal) {
    case 'generator':
      if (!(pj && game.generation)) break;
      return (
        <GeneratorPanel
          state={game.generation}
          busy={busy}
          onApply={(values) => submitAndClose('generate', values)}
        />
      );
    case 'loot':
      return (
        <LootPanel
          key={lootId || 'list'}
          items={game.loot || []}
          members={game.members}
          me={me.id}
          pj={!!pj}
          busy={busy}
          selectedId={lootId}
          noteId={lootNoteId}
          onOpen={openLoot}
          onAction={(values) => submitAndClose('loot', values, true)}
        />
      );
    case 'challenges':
      return (
        <ChallengesPanel
          key={challengeId || 'new:' + challengeNoteId}
          items={game.challenges || []}
          members={game.members}
          me={me.id}
          pj={!!pj}
          busy={busy}
          selectedId={challengeId}
          noteId={challengeNoteId}
          onOpen={openChallenges}
          onAction={(values) => submitAndClose('challenge', values, true)}
        />
      );
    case 'map-note':
      if (!noteAnchor) break;
      return pj && !notePublic ? (
        <MapNoteEditor
          suggestedNumber={
            Math.max(
              0,
              ...(game.mapNotes || []).map((n) => n.roomNumber || 0),
            ) + 1
          }
          key={noteOpenKey}
          anchor={noteAnchor}
          note={mapNote}
          map={
            (game.exploration?.levelId || 'ground') === noteAnchor.levelId
              ? game.dungeon
              : undefined
          }
          onChallenge={(id) => openChallenges('', id)}
          onLoot={(id) => openLoot('new', id)}
          levelName={noteLevelName}
          busy={busy}
          onAction={async (values) => {
            if (await act('map-note', values)) {
              if (values.showParchment) setTab('chat');
              setModal('');
              return true;
            }
            return false;
          }}
        />
      ) : (
        <MapNoteReader
          note={
            pj
              ? mapNote?.published
              : mapNote?.shared
                ? {
                    title: mapNote.title,
                    text: mapNote.text,
                    roomNumber: mapNote.roomNumber,
                  }
                : undefined
          }
        />
      );
    case 'story-outline':
      if (!pj || !game.storyOutline) break;
      return (
        <StoryOutlinePanel
          outline={game.storyOutline}
          busy={busy}
          onSave={(values) => submitAndClose('story-outline', values)}
          onOpenPlace={openStoryPlace}
        />
      );
    case 'session-recap':
      return (
        <SessionRecapPanel
          recap={game.sessionRecap}
          pj={!!pj}
          busy={busy}
          canCapture={!!game.exploration?.location && !game.exploration.battle}
          canLocate={
            !!pj ||
            game.sessionRecap?.location?.levelId === game.exploration?.levelId
          }
          onLocate={locateRecap}
          onSave={(values) => submitAndClose('session-recap', values)}
        />
      );
    case 'monsters':
      if (!pj) break;
      return (
        <MonsterManager
          session={session}
          monsters={game.monsters || []}
          initialId={selectedMonster}
          busy={busy}
          floorKeys={game.dungeon.floors}
          levelName={game.exploration?.levelName || 'Aktuální mapa'}
          onAction={(values) => act('monster', values)}
          onPlace={placeMonster}
          onRoll={(id) =>
            openRoll({ actor: { type: 'monster', id }, kind: 'attack' })
          }
        />
      );
    case 'notes':
      if (!pj) break;
      return (
        <>
          <span className="eyebrow">JEN PRO PÁNA JESKYNĚ</span>
          <h2>Za zástěnou</h2>
          <button className="secondary" onClick={() => openPanel('generator')}>
            Generátor jeskyně
          </button>
          <button
            className="secondary"
            onClick={() => openPanel('story-outline')}
          >
            Příběhová osnova
          </button>
          <SafeForm
            busy={busy}
            onSave={(patch) => submitAndClose('notes', patch)}
          >
            <label>
              Název dobrodružství
              <input name="title" defaultValue={game.title} maxLength={100} />
            </label>
            <label>
              Aktuální scéna
              <input name="scene" defaultValue={game.scene} maxLength={100} />
            </label>
            <label>
              Tajné poznámky
              <textarea name="notes" rows={9} defaultValue={game.notes} />
            </label>
            <button className="primary" disabled={busy}>
              Uložit přípravu <Check size={17} />
            </button>
          </SafeForm>
        </>
      );
  }
  return undefined;
}
