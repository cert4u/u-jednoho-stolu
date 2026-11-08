import type { RefObject } from 'react';
import type { GameView, MemberView } from '../../app/api/game/view';
import type { Location } from '../../lib/exploration';
import type { InitiativeRef } from '../../lib/initiative';
import type { MapNoteView, NoteAnchor } from '../../lib/map-notes';
import type { DialogHandle } from '../guarded-dialog';
import type { RollSetup } from '../mechanics-panel';
import type { GameAction, Session, ChatTab } from './types';
import type { TablePanel } from './table-panel-details';
export type PanelSelection = {
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

export type TableDialogProps = {
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

export type PanelContentProps = Omit<TableDialogProps, 'dialog' | 'error'> & {
  submitAndClose: (
    action: string,
    values: Record<string, unknown>,
    showChat?: boolean,
  ) => Promise<boolean>;
};
