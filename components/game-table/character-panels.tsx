import LifePanel from '../life-panel';
import EquipmentPanel from '../equipment-panel';
import JourneyPanel from '../journey-panel';
import RecoveryPanel from '../recovery-panel';
import PowersPanel from '../powers-panel';
import ConditionsPanel from '../conditions-panel';
import { InitiativeSetup } from '../initiative-panel';
import MechanicsPanel from '../mechanics-panel';
import CharacterJournal from './character-journal';
import ExperienceForm from './experience-form';
import type { PanelContentProps } from './table-dialog-types';

// Render helpers return elements only; stateful hooks belong in the panel components.
export function renderCharacterPanels({
  modal,
  game,
  me,
  busy,
  act,
  setModal,
  setTab,
  openPanel,
  openRecovery,
  openLife,
  openLoot,
  openChallenges,
  openRoll,
  reloadEquipment,
  submitAndClose,
  selection,
}: PanelContentProps) {
  const pj = me.role === 'pj';
  const { lifeMemberId, recoveryMemberId, conditionTarget, rollSetup } =
    selection;
  switch (modal) {
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
    case 'journey':
      return (
        <JourneyPanel
          exploration={game.exploration}
          members={game.members}
          onLighting={(values) => act('explore', { op: 'lighting', ...values })}
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
  }
  return undefined;
}
