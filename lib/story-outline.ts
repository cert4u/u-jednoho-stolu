import { z } from 'zod';
import type { Game, Member } from './game';
import { EditConflict } from './sheets';
import { storyPhaseSchema, storyBeatSchema, type StoryOutline } from './story-phases';

export type StoryPlace = { id: string; title: string; roomNumber?: number; levelId: string; levelName: string; x: number; y: number };
export type StoryOutlineView = { revision: number | null; phases: StoryOutline['phases']; places: StoryPlace[] };

/** A role check here also protects callers outside the HTTP dispatcher. */
export function storyOutlineView(game: Game, actor: Member): StoryOutlineView | undefined {
  if (actor.role !== 'pj') return;
  return {
    revision: game.storyOutline?.revision ?? null,
    phases: structuredClone(game.storyOutline?.phases ?? {}),
    places: (game.mapNotes ?? []).map(({ id, title, roomNumber, levelId, x, y }) => ({
      id, title, roomNumber, levelId, x, y,
      levelName: game.atlas?.levels.find(level => level.id === levelId)?.name ?? 'Přízemí',
    })),
  };
}

export function saveStoryOutline(game: Game, actor: Member, input: Record<string, unknown>) {
  if (actor.role !== 'pj') throw new Error('Příběhovou osnovu spravuje pouze PJ.');
  const previous = game.storyOutline;
  const requestId = input.requestId;
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw new Error('Chybí identifikátor uložení osnovy.');
  if (previous?.operations?.includes(requestId)) return;
  if (input.expectedRevision !== (previous?.revision ?? null))
    throw new EditConflict('Osnova se mezitím změnila. Rozepsaný text zůstává zachovaný; otevři panel znovu pro poslední verzi.');
  const parsed = z.partialRecord(storyPhaseSchema, storyBeatSchema).safeParse(input.phases);
  if (!parsed.success || !Object.keys(parsed.data).length) throw new Error('Vyplň platnou fázi osnovy: nadpis nejvýše 100 a poznámka 3000 znaků.');
  const ids = new Set((game.mapNotes ?? []).map(note => note.id));
  if (Object.values(parsed.data).some(beat => beat.noteIds.some(id => !ids.has(id))))
    throw new EditConflict('Některé přiřazené místo už neexistuje. Otevři osnovu znovu a zkontroluj vazby.');
  game.storyOutline = {
    revision: (previous?.revision ?? 0) + 1,
    phases: { ...previous?.phases, ...parsed.data },
    operations: [...(previous?.operations ?? []), requestId].slice(-256),
  };
}

/** Remove only deleted links, retaining all prose and played flags. */
export function pruneStoryLinks(game: Game) {
  if (!game.storyOutline) return;
  const ids = new Set((game.mapNotes ?? []).map(note => note.id));
  let changed = false;
  for (const beat of Object.values(game.storyOutline.phases)) {
    const next = beat.noteIds.filter(id => ids.has(id));
    if (next.length !== beat.noteIds.length) { beat.noteIds = next; changed = true; }
  }
  if (changed) game.storyOutline.revision++;
}
