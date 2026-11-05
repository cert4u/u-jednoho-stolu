import type {Game, Member} from './game';
import {cellKey} from './dungeon';
import type {Level, Location} from './exploration';
import {inspectArea} from './map-inspection';
import type {MapNote} from './map-notes';

export function publishParchment(game: Game, note: MapNote, pj: Member) {
  if (note.parchmentRevealed || !note.text) return;

  note.parchmentRevealed = true;
  note.revision++;
  game.messages.push({
    id: crypto.randomUUID(),
    from: pj.id,
    name: pj.name,
    text: note.text,
    to: 'all',
    time: Date.now(),
    parchment: {title: note.title, roomNumber: note.roomNumber},
  });
  game.messages = game.messages.slice(-500);
}

export function trackRoomEntries(game: Game, level: Level) {
  const candidates = (game.mapNotes ?? []).filter(note =>
    note.levelId === level.id && note.parchmentOnEntry && !note.parchmentRevealed && note.text
  );
  const pj = game.members.find(member => member.role === 'pj');
  const areas = candidates.map(note => ({
    note,
    cells: new Set(inspectArea(level.map, [note.x, note.y]).cells),
  }));

  return (previous: Location, current: Location) => {
    if (!pj || current.levelId !== level.id) return;
    const previousCell = cellKey(previous.x, previous.y);
    const currentCell = cellKey(current.x, current.y);
    for (const {note, cells} of areas) {
      if (cells.has(currentCell) && (previous.levelId !== level.id || !cells.has(previousCell))) {
        publishParchment(game, note, pj);
      }
    }
  };
}
