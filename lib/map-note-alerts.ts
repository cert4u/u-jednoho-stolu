import type {Game} from './game';
import type {NoteAnchor} from './map-notes';
export type MapNoteAlert={id:string;noteId:string;at:number};
export type MapNoteAlertView=MapNoteAlert & NoteAnchor & {title:string;levelName:string};
export function recordNoteProximity(g:Game,previous:NoteAnchor|undefined,notified=new Set<string>()){
 const here=g.atlas?.location;if(!here)return;
 for(const note of g.mapNotes||[]){
  if(note.notify===false||note.levelId!==here.levelId||notified.has(note.id))continue;
  const radius=note.radius??2,near=(point:NoteAnchor|undefined)=>!!point&&point.levelId===note.levelId&&Math.hypot(point.x-note.x,point.y-note.y)<=radius;
  if(near(here)&&!near(previous)){g.mapNoteAlerts=[...(g.mapNoteAlerts||[]),{id:crypto.randomUUID(),noteId:note.id,at:Date.now()}].slice(-200);notified.add(note.id);}
 }
}
export function mapNoteAlertViews(g:Game):MapNoteAlertView[]{return (g.mapNoteAlerts||[]).flatMap(alert=>{const note=g.mapNotes?.find(n=>n.id===alert.noteId&&n.notify!==false);if(!note)return [];return [{...alert,levelId:note.levelId,x:note.x,y:note.y,title:note.title,levelName:g.atlas?.levels.find(l=>l.id===note.levelId)?.name||'Přízemí'}];});}
