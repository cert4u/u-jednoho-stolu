'use client';

import { ArrowRight, Check, Copy, Download, LogOut } from 'lucide-react';
import type { RefObject } from 'react';
import type { GameView, MemberView } from '../../app/api/game/view';
import type { Location } from '../../lib/exploration';
import type { InitiativeRef } from '../../lib/initiative';
import type { MapNoteView, NoteAnchor } from '../../lib/map-notes';
import GeneratorPanel from '../generator-panel';
import LifePanel from '../life-panel';
import EquipmentPanel from '../equipment-panel';
import LootPanel from '../loot-panel';
import ChallengesPanel from '../challenges-panel';
import StoryOutlinePanel from '../story-outline-panel';
import SessionRecapPanel from '../session-recap-panel';
import MapNoteEditor, { MapNoteReader } from '../map-note-panel';
import JourneyPanel from '../journey-panel';
import RecoveryPanel from '../recovery-panel';
import PowersPanel from '../powers-panel';
import ConditionsPanel from '../conditions-panel';
import { InitiativeSetup } from '../initiative-panel';
import SafeForm from '../safe-form';
import GuardedDialog, { type DialogHandle } from '../guarded-dialog';
import { RecoveryCard, RestoreForms, PartyAccess } from '../campaign-access';
import MechanicsPanel, { type RollSetup } from '../mechanics-panel';
import MonsterManager from '../monster-manager';
import CharacterJournal from './character-journal';
import ExperienceForm from './experience-form';
import type { GameAction, Session, ChatTab } from './types';

const panelDetails = {
  'story-outline': { label: 'Příběhová osnova' },
  generator: { label: 'Generátor jeskyně', className: 'generator-modal' },
  life: { label: 'Vyřazení postav' },
  equipment: { label: 'Výbava a měšec', className: 'loot-modal' },
  loot: { label: 'Kořist družiny', className: 'loot-modal' },
  challenges: { label: 'Zkoušky a pasti' },
  'map-note': { label: 'Poznámka k místu' },
  'session-recap': { label: 'Kronika družiny' },
  journey: { label: 'Čas a světlo' },
  recovery: { label: 'Odpočinek a léčení' },
  powers: { label: 'Kouzla a schopnosti' },
  conditions: { label: 'Stavy postav a příšer' },
  initiative: { label: 'Účastníci souboje' },
  mechanics: { label: 'Hody a souboj' },
  character: { label: 'Deník postavy', className: 'character-modal' },
  monsters: { label: 'Správa příšer', className: 'monster-modal' },
  experience: { label: 'Herní okno' },
  notes: { label: 'Herní okno' },
  account: { label: 'Herní okno' },
  help: { label: 'Herní okno' },
} satisfies Record<string, { label: string; className?: string }>;

export type TablePanel = keyof typeof panelDetails;

type PanelSelection = {
  lifeMemberId?: string;
  recoveryMemberId?: string;
  lootId: string;
  lootNoteId?: string;
  challengeId: string;
  challengeNoteId?: string;
  noteAnchor: NoteAnchor | null;
  notePublic: boolean;
  noteOpenKey: number;
  mapNote?: MapNoteView;
  noteLevelName: string;
  conditionTarget?: InitiativeRef;
  rollSetup: RollSetup;
  selectedMonster: string;
  recoveryCode: string;
  recoveryName: string;
};

type Props = {
  modal: TablePanel;
  dialog: RefObject<DialogHandle | null>;
  game: GameView;
  me: MemberView;
  session: Session;
  busy: boolean;
  error: string;
  selection: PanelSelection;
  act: GameAction;
  setModal: (modal: TablePanel | '') => void;
  setTab: (tab: ChatTab) => void;
  openPanel: (modal: TablePanel) => void;
  openRecovery: (id?: string) => void;
  openLife: (id?: string) => void;
  openLoot: (id?: string, noteId?: string) => void;
  openChallenges: (id?: string, noteId?: string) => void;
  openStoryPlace: (id: string) => void;
  locateRecap: (location: Location) => void;
  placeMonster: (id: string) => void;
  openRoll: (setup: RollSetup) => void;
  reloadEquipment: () => Promise<boolean>;
  copy: () => void;
  exportGame: () => void;
  leave: () => void;
};

export default function TableDialog({
  modal,
  dialog,
  game,
  me,
  session,
  busy,
  error,
  selection,
  act,
  setModal,
  setTab,
  openPanel,
  openRecovery,
  openLife,
  openLoot,
  openChallenges,
  openStoryPlace,
  locateRecap,
  placeMonster,
  openRoll,
  reloadEquipment,
  copy,
  exportGame,
  leave,
}: Props) {
  const pj = me.role === 'pj';
  const {
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
  } = selection;

  async function submitAndClose(
    action: string,
    values: Record<string, unknown>,
    showChat = false,
  ) {
    if (!(await act(action, values))) return false;
    if (showChat) setTab('chat');
    setModal('');
    return true;
  }

  function renderPanel() {
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
      case 'life':
        if (!pj) break;
        return (
          <LifePanel
            key={lifeMemberId || 'roster'}
            members={game.members}
            initialId={lifeMemberId}
            busy={busy}
            onRecovery={openRecovery}
            onAction={(values) => submitAndClose('life', values, true)}
          />
        );
      case 'equipment':
        return (
          <EquipmentPanel
            onReload={reloadEquipment}
            members={game.members}
            me={me.id}
            pj={!!pj}
            busy={busy}
            onAction={(values) => submitAndClose('equipment', values, true)}
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
        return <StoryOutlinePanel outline={game.storyOutline} busy={busy}
          onSave={values => submitAndClose('story-outline', values)} onOpenPlace={openStoryPlace} />;
      case 'session-recap':
        return (
          <SessionRecapPanel
            recap={game.sessionRecap}
            pj={!!pj}
            busy={busy}
            canCapture={
              !!game.exploration?.location && !game.exploration.battle
            }
            canLocate={
              !!pj ||
              game.sessionRecap?.location?.levelId === game.exploration?.levelId
            }
            onLocate={locateRecap}
            onSave={(values) => submitAndClose('session-recap', values)}
          />
        );
      case 'journey':
        return (
          <JourneyPanel
            exploration={game.exploration}
            members={game.members}
            onLighting={(values) =>
              act('explore', { op: 'lighting', ...values })
            }
            data={game.journey}
            pj={!!pj}
            busy={busy}
            onAction={(values) => act('journey', values)}
          />
        );
      case 'recovery':
        if (!pj) break;
        return (
          <RecoveryPanel
            key={recoveryMemberId || 'party'}
            initialMemberId={recoveryMemberId}
            members={game.members}
            busy={busy}
            onAction={(values) => submitAndClose('recovery', values, true)}
          />
        );
      case 'powers':
        return (
          <>
            <PowersPanel
              members={game.members}
              me={me.id}
              pj={!!pj}
              busy={busy}
              onAction={(values) => act('power', values)}
            />
            <button
              className="text-button"
              onClick={() => openPanel('character')}
            >
              Zpět do mého deníku
            </button>
          </>
        );
      case 'conditions':
        if (!pj) break;
        return (
          <ConditionsPanel
            members={game.members}
            monsters={game.monsters || []}
            participants={game.initiative?.order || []}
            initialTarget={conditionTarget}
            busy={busy}
            onAction={(values) => act('condition', values)}
          />
        );
      case 'initiative':
        if (!(pj && game.initiative)) break;
        return (
          <InitiativeSetup
            data={game.initiative}
            members={game.members}
            monsters={game.monsters || []}
            busy={busy}
            onSave={(values) => submitAndClose('initiative', values)}
          />
        );
      case 'mechanics':
        return (
          <MechanicsPanel
            key={JSON.stringify(rollSetup)}
            members={game.members}
            monsters={game.monsters || []}
            messages={[...game.messages, ...(game.pendingActions || [])]}
            me={me.id}
            pj={!!pj}
            busy={busy}
            setup={rollSetup}
            onRecovery={() => openPanel('recovery')}
            onChallenges={() => openChallenges()}
            onAction={(values) => submitAndClose('mechanics', values, true)}
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
      case 'experience':
        if (!pj) break;
        return (
          <ExperienceForm
            members={game.members}
            busy={busy}
            onAward={async (values) => {
              if (await act('experience', values)) {
                setTab('chat');
                setModal('');
              }
            }}
          />
        );
      case 'character':
        return (
          <CharacterJournal
            me={me}
            pj={pj}
            busy={busy}
            openLife={openLife}
            openPowers={() => openPanel('powers')}
            openRoll={openRoll}
            openEquipment={() => openPanel('equipment')}
            openLoot={openLoot}
            onSave={(patch) => submitAndClose('character', patch)}
          />
        );
      case 'notes':
        if (!pj) break;
        return (
          <>
            <span className="eyebrow">JEN PRO PÁNA JESKYNĚ</span>
            <h2>Za zástěnou</h2>
            <button
              className="secondary"
              onClick={() => openPanel('generator')}
            >
              Generátor jeskyně
            </button>
            <button className="secondary" onClick={() => openPanel('story-outline')}>Příběhová osnova</button>
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
      case 'account':
        return (
          <>
            <h2>Tvoje místo u stolu</h2>
            <p>
              Přihlášen jako <strong>{me.name}</strong>. Kód místnosti:
            </p>
            <div className="room-code">{session.room}</div>
            <p>
              Přístup si pamatuje tento prohlížeč. Pro návrat na jiném zařízení
              si ulož osobní obnovovací klíč. Postava i její deník zůstanou
              stejné.
            </p>
            <button className="primary" onClick={copy}>
              <Copy size={17} /> Zkopírovat pozvánku
            </button>
            {recoveryCode && (
              <RecoveryCard
                key={recoveryCode}
                code={recoveryCode}
                name={recoveryName}
              />
            )}
            <PartyAccess
              members={game.members}
              archived={game.archivedMembers || []}
              me={me.id}
              pj={!!pj}
              busy={busy}
              onAction={act}
            />
            {pj && (
              <button className="secondary" onClick={exportGame}>
                <Download size={17} /> Stáhnout úplnou zálohu kampaně
              </button>
            )}
            <RestoreForms busy={busy} onAction={act} />
            <button className="text-button danger" onClick={leave}>
              <LogOut size={16} /> Opustit stůl v tomto prohlížeči
            </button>
          </>
        );
    }
    return (
      <>
        <span className="eyebrow">V JEDNODUCHOSTI JE SÍLA</span>
        <h2>Vítej u jednoho stolu.</h2>
        <p>
          <strong>1. Svolej družinu.</strong> Pozvánku najdeš nahoře. Hlasový
          hovor najdeš u chatu, pokud ho správce serveru zapnul. Přístup k
          hostované aplikaci je zatím soukromý pro majitele.
        </p>
        <p>
          <strong>2. Otevři deník.</strong> Pravidla necháváme na vás.
          Vlastnosti i výbavu zapisuj volně.
        </p>
        <p>
          <strong>3. Prozkoumej mapu.</strong> Hráč vybírá a posouvá svou
          značku. PJ v přípravě kreslí zdi, místnosti a dveře. V odkrývání
          tažením odhaluje oblasti; skrytá kresba zůstává jen u něj. Pohled
          družiny ověří, co hráči vidí, a šipka Zpět vrátí poslední akci mapy.
        </p>
        <p>
          <strong>4. Nech kostky promluvit.</strong> V Hody a souboj hodíš na
          vlastnost (1k10 + bonus) nebo útok/obranu (1k6+). Cíl útoku odpoví
          tlačítkem Hodit obranu v chatu a PJ potvrdí zranění. Tlačítkem hodíš
          jednou kostkou, příkazem /hod 2k6+1 vlastním hodem. Příjemce přepneš
          na celou družinu nebo šeptání.
        </p>
        <p className="muted">
          MVP · až osm propojených pater · sdílení se obnovuje každé 2 sekundy ·
          bez automatického vyhodnocování pravidel.
        </p>
        <button className="primary" onClick={() => setModal('')}>
          Jdeme hrát <ArrowRight size={17} />
        </button>
      </>
    );
  }
  const details: { label: string; className?: string } = panelDetails[modal];
  return (
    <GuardedDialog
      ref={dialog}
      label={details.label}
      className={['modal', details.className].filter(Boolean).join(' ')}
      onClose={() => setModal('')}
    >
      {renderPanel()}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </GuardedDialog>
  );
}
