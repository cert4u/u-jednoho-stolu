'use client';

import { useState, type RefObject } from 'react';
import type { GameView } from '../../app/api/game/view';
import type { MapNoteAlertView } from '../../lib/map-note-alerts';
import type { MapNoteView, NoteAnchor } from '../../lib/map-notes';
import type { DialogHandle } from '../guarded-dialog';
import type { EncounterTarget } from '../map-note-notifications';
import { requestGame } from './game-client';
import type { Session, ViewRequest } from './types';

type Options = {
  game: GameView | null;
  view: ViewRequest;
  isCurrentView: (view: ViewRequest) => boolean;
  acceptGame: (view: ViewRequest, game: GameView) => void;
  setEditorLevel: (levelId: string) => ViewRequest;
  setError: (message: string) => void;
  session: Session;
  isCurrentSession: () => boolean;
  dialog: RefObject<DialogHandle | null>;
  noteDialogOpen: boolean;
  showNote: () => void;
  showEncounter: (target: EncounterTarget) => void;
};

export function useMapNoteNavigation({
  game,
  view,
  isCurrentView,
  acceptGame,
  setEditorLevel,
  setError,
  session,
  isCurrentSession,
  dialog,
  noteDialogOpen,
  showNote,
  showEncounter,
}: Options) {
  const [noteSnapshot, setNoteSnapshot] = useState<MapNoteView | undefined>(),
    [noteOpenKey, setNoteOpenKey] = useState(0),
    [noteLevelName, setNoteLevelName] = useState('Přízemí'),
    [openingNote, setOpeningNote] = useState(false);
  const [noteAnchor, setNoteAnchor] = useState<NoteAnchor | null>(null),
    [notePublic, setNotePublic] = useState(false);
  const mapNote =
    (game?.exploration?.levelId || 'ground') === noteAnchor?.levelId
      ? game?.mapNotes?.find(
          (n) =>
            n.levelId === noteAnchor.levelId &&
            n.x === noteAnchor.x &&
            n.y === noteAnchor.y,
        )
      : noteDialogOpen
        ? noteSnapshot
        : undefined;

  function openMapNote(anchor: NoteAnchor, publicView: boolean) {
    const action = () => {
      if (!isCurrentSession()) return;
      setError('');
      setNoteSnapshot(undefined);
      setNoteOpenKey((k) => k + 1);
      setNoteLevelName(game?.exploration?.levelName || 'Přízemí');
      setNoteAnchor(anchor);
      setNotePublic(publicView);
      showNote();
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
    const isCurrent = () => isCurrentSession() && isCurrentView(view);
    const action = async () => {
      if (!isCurrent()) return;
      setOpeningNote(true);
      setError('');
      try {
        const { response, data } = await requestGame(session, alert.levelId);
        if (!isCurrent()) return;
        if (!response.ok)
          throw new Error(data.error || 'Přípravu se nepodařilo načíst.');
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
        acceptGame(setEditorLevel(alert.levelId), data);
        if (target) showEncounter(target);
        else {
          setNoteSnapshot(note);
          setNoteOpenKey((key) => key + 1);
          setNoteLevelName(alert.levelName);
          setNoteAnchor({ levelId: alert.levelId, x: note.x, y: note.y });
          setNotePublic(false);
          showNote();
          opened();
        }
      } catch (error) {
        if (!isCurrent()) return;
        setError(
          error instanceof Error
            ? error.message
            : 'Přípravu se nepodařilo otevřít.',
        );
      } finally {
        if (isCurrentSession()) setOpeningNote(false);
      }
    };
    if (dialog.current) dialog.current.run(() => void action());
    else void action();
  }

  return {
    selection: { noteAnchor, notePublic, noteOpenKey, mapNote, noteLevelName },
    openingNote,
    openMapNote,
    openNoteAlert,
  };
}
