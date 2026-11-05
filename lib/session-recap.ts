import type {Game} from './game';
import type {Location} from './exploration';
import {cellKey} from './dungeon';
import {EditConflict} from './sheets';

export const RECAP_SUMMARY_LIMIT = 1600;
export const RECAP_CLUES_LIMIT = 800;

export type SessionRecap = {
  summary: string;
  clues: string;
  revision: number;
  savedAt: number;
  location?: Location;
  requestId: string;
};

export type SessionRecapView = Omit<SessionRecap, 'requestId' | 'location'> & {
  location?: Location & {levelName: string};
};

export function saveSessionRecap(game: Game, input: Record<string, unknown>) {
  const previous = game.sessionRecap;
  const {requestId, summary, clues, mapPoint} = input;
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
    throw new Error('Chybí identifikátor uložení zápisu.');
  }
  if (previous?.requestId === requestId) return;
  if (input.expectedRevision !== (previous?.revision ?? null)) {
    throw new EditConflict('Zápis se mezitím změnil. Otevři jej znovu a zkontroluj poslední verzi.');
  }
  if (typeof summary !== 'string' || !summary.trim() || summary.length > RECAP_SUMMARY_LIMIT) {
    throw new Error(`Napiš shrnutí o délce 1 až ${RECAP_SUMMARY_LIMIT} znaků.`);
  }
  if (typeof clues !== 'string' || clues.length > RECAP_CLUES_LIMIT) {
    throw new Error(`Otevřené stopy mohou mít nejvýše ${RECAP_CLUES_LIMIT} znaků.`);
  }

  let location: Location | undefined;
  switch (mapPoint) {
    case 'keep': location = previous?.location; break;
    case 'clear': break;
    case 'current':
      if (!game.atlas?.location) throw new Error('Družina zatím nemá společnou polohu na mapě.');
      if (game.atlas.battle) throw new Error('Nejdřív seskup družinu po souboji, potom ulož její polohu.');
      location = {...game.atlas.location};
      break;
    default: throw new Error('Zvol způsob uložení místa na mapě.');
  }

  game.sessionRecap = {
    summary: summary.trim(),
    clues: clues.trim(),
    revision: (previous?.revision ?? 0) + 1,
    savedAt: Date.now(),
    requestId,
    ...(location ? {location} : {}),
  };
}

export function sessionRecapView(game: Game, pj: boolean): SessionRecapView | undefined {
  const recap = game.sessionRecap;
  if (!recap) return;
  const {summary, clues, revision, savedAt, location} = recap;
  const result = {summary, clues, revision, savedAt};
  if (!location) return result;
  const level = game.atlas?.levels.find(item => item.id === location.levelId);
  if (!level) return result;

  const cell = cellKey(location.x, location.y);
  const map = pj ? level.map : level.memory;
  if (!map.floors.includes(cell) || (!pj && !map.revealed.includes(cell))) return result;
  return {...result, location: {...location, levelName: level.name}};
}
