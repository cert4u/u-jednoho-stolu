import type {CatalogResolver} from './catalogs/resolver';
import { emptyStoryBeat } from './story-phases';
import { adventureTemplates, resolveAdventureRooms } from './adventure-templates';
import { findDungeonPreset } from './dungeon-presets';
import { generationAction, generationState } from './generation';
import { roomFloorPoints } from './room-labels';
import { monsterAction } from './monsters';
import type { Game, Member } from './game';

/** Copy a template into a new campaign before the first database write. */
export function startAdventure(game: Game, owner: Member, templateId:unknown,library?:CatalogResolver) {
  const template=library?library.get('adventures',templateId)?.data:adventureTemplates.find(entry=>entry.id===templateId);
  if (!template) throw new Error('Předloha dobrodružství neexistuje.');
  const preset=library?library.get('dungeon-presets',template.dungeonPreset)?.data:findDungeonPreset(template.dungeonPreset);
  if (!preset) throw new Error('Předloha jeskyně neexistuje.');

  const levels = generationAction(game, owner, {
    options: preset.options,
    requestId: crypto.randomUUID(),
    expectedState: generationState(game).stamp,
  });

  game.title = template.title;
  game.scene = template.scene;
  game.notes = template.gmNotes;
  const floors = levels.map(id => {
    const level = game.atlas?.levels.find(candidate => candidate.id === id);
    if (!level?.map.generation) throw new Error('V předloze chybí vygenerované patro.');
    return { ...level, rooms: level.map.generation.rooms };
  });
  for (const { placement, room, roomNumber } of resolveAdventureRooms(template, floors)) {
    const floor = floors[placement.floor - 1];
    const levelId = floor.id;
    const notes = (game.mapNotes ?? []).filter(note => note.levelId === levelId);
    const note = notes.find(note => note.roomNumber === roomNumber);
    if (!note) throw new Error(`V předloze chybí značka místnosti na patře ${placement.floor}.`);

    const occupied = new Set(notes.map(({ x, y }) => `${x},${y}`));
    for (const monster of game.monsters ?? []) {
      if (monster.levelId === levelId && monster.x !== null && monster.y !== null)
        occupied.add(`${monster.x},${monster.y}`);
    }
    const free = roomFloorPoints(room, floor.map).filter(point => !occupied.has(point.join(',')));
    if (placement.phase) {
      game.storyOutline ??= { revision: 0, phases: {} };
      const beat = game.storyOutline.phases[placement.phase] ??= emptyStoryBeat();
      if (!beat.title) beat.title = placement.title;
      // The full original preparation stays on each note, including repeated phases.
      beat.noteIds.push(note.id);
    }
    note.title = placement.title;
    note.text = placement.playerText;
    note.secret = placement.gmNotes;
    note.parchmentOnEntry = Boolean(placement.playerText);
    for (const monsterId of placement.monsters ?? []) {
      monsterAction(game, owner, {
        op: 'create',
        templateId: monsterId,
        levelId,
        requestId: crypto.randomUUID(),
      },library);
      const monster = game.monsters?.at(-1);
      if (!monster) throw new Error('Příšeru z předlohy se nepodařilo přidat.');
      // Overflow stays in the manager so PJ can place it manually.
      const point = free.shift();
      if (point) [monster.x, monster.y] = point;
    }
  }
}
