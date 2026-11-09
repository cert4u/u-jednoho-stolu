import { cellKey, type Dungeon } from '../../lib/dungeon';
import type { MapNoteView, NoteAnchor } from '../../lib/map-notes';

type Props = {
  notes: MapNoteView[];
  shown: Dungeon;
  visible: boolean;
  pj: boolean;
  busy: boolean;
  levelName?: string;
  onFindRoom: (note: MapNoteView) => void;
  onOpenNote: (anchor: NoteAnchor, publicView: boolean) => void;
};

export default function MapRoomList({
  notes,
  shown,
  visible,
  pj,
  busy,
  levelName,
  onFindRoom,
  onOpenNote,
}: Props) {
  const roomNotes = notes
    .filter(
      (n) =>
        (!visible || n.shared) &&
        n.roomNumber &&
        (!visible ||
          (shown.floors.includes(cellKey(n.x, n.y)) &&
            shown.revealed.includes(cellKey(n.x, n.y)))),
    )
    .map((n) =>
      visible && pj
        ? {
            ...n,
            roomNumber: n.published?.roomNumber,
            title: n.published?.title || n.title,
          }
        : n,
    )
    .filter((n) => n.roomNumber)
    .sort((a, b) => a.roomNumber! - b.roomNumber!);
  return (
    <section className="map-room-list" aria-label="Místnosti na patře">
      <strong>Místnosti · {levelName || 'Přízemí'}</strong>
      {roomNotes.length ? (
        roomNotes.map((n) => (
          <div key={n.id}>
            <button
              disabled={busy}
              onClick={() => onFindRoom(n)}
              title="Najít v mapě"
            >
              {n.roomNumber} · {n.title}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                onOpenNote({ levelId: n.levelId, x: n.x, y: n.y }, visible)
              }
              aria-label={`Otevřít místo ${n.roomNumber}`}
            >
              {visible ? 'Popis' : 'Příprava'}
            </button>
          </div>
        ))
      ) : (
        <p>
          {pj && !visible
            ? 'Nástrojem Označit místo klikni do místnosti a zadej její číslo a název.'
            : 'Zatím neznáte žádné označené místnosti.'}
        </p>
      )}
    </section>
  );
}
