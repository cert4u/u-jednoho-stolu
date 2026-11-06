import { adventureTemplates } from './adventure-templates';
import { findDungeonPreset } from './dungeon-presets';
import { generationAction, generationState } from './generation';
import { monsterAction } from './monsters';
import type { Game, Member } from './game';

/** Copy a template into a new campaign before the first database write. */
export function startAdventure(game: Game, owner: Member, templateId: unknown) {
  const template = adventureTemplates.find((entry) => entry.id === templateId);
  if (!template) throw new Error('Předloha dobrodružství neexistuje.');
  const preset = findDungeonPreset(template.dungeonPreset);
  if (!preset) throw new Error('Předloha jeskyně neexistuje.');

  const levels = generationAction(game, owner, {
    options: preset.options,
    requestId: crypto.randomUUID(),
    expectedState: generationState(game).stamp,
  });

  game.title = template.title;
  game.scene = template.scene;
  game.notes = template.gmNotes;
  for (const room of template.rooms) {
    const levelId = levels[room.floor - 1];
    const floor = game.atlas?.levels.find((level) => level.id === levelId);
    const roomIndex = floor?.map.generation?.rooms.findIndex(
      (candidate) => candidate.role === room.role,
    );
    const note =
      roomIndex !== undefined && roomIndex >= 0
        ? game.mapNotes?.find(
            (note) =>
              note.levelId === levelId && note.roomNumber === roomIndex + 1,
          )
        : undefined;
    if (!note)
      throw new Error(
        `V předloze chybí cílová místnost na patře ${room.floor}.`,
      );

    note.title = room.title;
    note.text = room.playerText;
    note.secret = room.gmNotes;
    note.parchmentOnEntry = Boolean(room.playerText);
    for (const monsterId of room.monsters ?? []) {
      monsterAction(game, owner, {
        op: 'create',
        templateId: monsterId,
        levelId,
        requestId: crypto.randomUUID(),
      });
      const monster = game.monsters?.at(-1);
      if (!monster) throw new Error('Příšeru z předlohy se nepodařilo přidat.');
      // The generated note anchor is on a free floor tile away from stairs.
      monster.x = note.x;
      monster.y = note.y;
    }
  }
}
