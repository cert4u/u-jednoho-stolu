import type {Game} from './game';
import type {NoteAnchor} from './map-notes';
import {cellKey, dungeonFor} from './dungeon';
import {inspectArea} from './map-inspection';
export type MapNoteAlert={id:string;noteId:string;at:number};
export type EncounterLink = {kind:'challenge'|'loot'|'monster'; id:string; title:string};
export type MapNoteAlertView=MapNoteAlert & NoteAnchor & {title:string;levelName:string;encounter:EncounterLink[]};
export function recordNoteProximity(g:Game,previous:NoteAnchor|undefined,notified=new Set<string>(),current?:NoteAnchor,actorId?:string){
 const here=current||g.atlas?.location;if(!here)return;
 for(const note of g.mapNotes||[]){
  if(note.notify===false||note.levelId!==here.levelId||notified.has(note.id))continue;
  const radius=note.radius??2,near=(point:NoteAnchor|undefined)=>!!point&&point.levelId===note.levelId&&Math.hypot(point.x-note.x,point.y-note.y)<=radius;
  const alreadyNear=!!(g.atlas?.battle&&actorId&&g.members.some(m=>m.id!==actorId&&m.role==='player'&&!m.archived&&near({levelId:g.atlas!.battle!.levelId,x:m.x,y:m.y})));
  if(near(here)&&!near(previous)&&!alreadyNear){g.mapNoteAlerts=[...(g.mapNoteAlerts||[]),{id:crypto.randomUUID(),noteId:note.id,at:Date.now()}].slice(-200);notified.add(note.id);}
 }
}
export function mapNoteAlertViews(game: Game): MapNoteAlertView[] {
 const notes = game.mapNotes ?? [];
 const notesById = new Map(notes.map(note => [note.id, note]));
 const byNote = new Map<string, EncounterLink[]>();
 const availablePlayers = new Set(game.members.filter(member => member.role === 'player' && !member.archived).map(member => member.id));

 return (game.mapNoteAlerts ?? []).flatMap(alert => {
  const note = notesById.get(alert.noteId);
  if (!note || note.notify === false) return [];
  const level = game.atlas?.levels.find(item => item.id === note.levelId);
  let encounter = byNote.get(note.id);
  if (!encounter) {
   const map = level?.map ?? dungeonFor(game);
   const cells = new Set(inspectArea(map, [note.x, note.y]).cells);
   const linkedNotes = new Set(notes.filter(item => item.levelId === note.levelId && cells.has(cellKey(item.x, item.y))).map(item => item.id));
   linkedNotes.add(note.id);
   encounter = [];
   for (const challenge of game.challenges ?? []) {
    if (challenge.noteId && linkedNotes.has(challenge.noteId) && availablePlayers.has(challenge.memberId) &&
        (challenge.state === 'pending' || challenge.state === 'rolled')) {
     encounter.push({kind:'challenge', id:challenge.id, title:challenge.title});
    }
   }
   for (const monster of game.monsters ?? []) {
    if (monster.levelId === note.levelId && !monster.archived && monster.hp > 0 &&
        monster.x !== null && monster.y !== null && cells.has(cellKey(monster.x, monster.y))) {
     encounter.push({kind:'monster', id:monster.id, title:`${monster.name} #${monster.number}`});
    }
   }
   for (const loot of game.loot ?? []) {
    if (loot.noteId && linkedNotes.has(loot.noteId) && loot.state !== 'closed') {
     encounter.push({kind:'loot', id:loot.id, title:loot.title});
    }
   }
   byNote.set(note.id, encounter);
  }
  return [{...alert, levelId:note.levelId, x:note.x, y:note.y, title:note.title,
   levelName:level?.name ?? 'Přízemí', encounter}];
 });
}
