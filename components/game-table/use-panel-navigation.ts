'use client';

import { useState, type RefObject } from 'react';
import type { InitiativeRef } from '../../lib/initiative';
import type { DialogHandle } from '../guarded-dialog';
import type { RollSetup } from '../mechanics-panel';
import type { TablePanel } from './table-dialog';

// UI selection only: fetching, authentication and game mutations stay with the table.
export function usePanelNavigation(
  dialog: RefObject<DialogHandle | null>,
  setError: (message: string) => void,
) {
  const [modal, setModal] = useState<TablePanel | ''>('');
  const [recoveryMemberId, setRecoveryMemberId] = useState<string>();
  const [lifeMemberId, setLifeMemberId] = useState<string>();
  const [lootId, setLootId] = useState('');
  const [lootNoteId, setLootNoteId] = useState<string>();
  const [challengeId, setChallengeId] = useState('');
  const [challengeNoteId, setChallengeNoteId] = useState<string>();
  const [conditionTarget, setConditionTarget] = useState<InitiativeRef>();
  const [rollSetup, setRollSetup] = useState<RollSetup>({});
  const [selectedMonster, setSelectedMonster] = useState('');
  const [monsterPick, setMonsterPick] = useState(0);

  function open(panel: TablePanel, prepare?: () => void) {
    const action = () => {
      setError('');
      prepare?.();
      setModal(panel);
    };
    if (dialog.current) dialog.current.run(action);
    else action();
  }
  const openRecovery = (id?: string) =>
    open('recovery', () => setRecoveryMemberId(id));
  const openLife = (id?: string) => open('life', () => setLifeMemberId(id));
  const openLoot = (id = '', noteId?: string) =>
    open('loot', () => {
      setLootId(id);
      setLootNoteId(noteId);
    });
  const openChallenges = (id = '', noteId?: string) =>
    open('challenges', () => {
      setChallengeId(id);
      setChallengeNoteId(noteId);
    });
  const openConditions = (target?: InitiativeRef) =>
    open('conditions', () => setConditionTarget(target));
  const openRoll = (setup: RollSetup = {}) =>
    open('mechanics', () => setRollSetup(setup));

  function openPanel(panel: TablePanel) {
    if (panel === 'recovery') openRecovery();
    else if (panel === 'loot') openLoot();
    else if (panel === 'mechanics') openRoll();
    else open(panel);
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

  return {
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
  };
}
