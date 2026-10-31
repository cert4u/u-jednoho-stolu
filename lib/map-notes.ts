import type {Game,Member} from './game';
import {cellKey,dungeonFor,type Dungeon} from './dungeon';
import {getLevel} from './exploration';
import {EditConflict} from './sheets';
export type NoteAnchor={levelId:string;x:number;y:number};
export type PublicMapNote={title:string;text:string;roomNumber?:number};
export type MapNote=NoteAnchor & PublicMapNote & {id:string;notify?:boolean;radius?:number;secret:string;revision:number;published?:PublicMapNote};
export type MapNoteView=NoteAnchor & PublicMapNote & {id:string;shared:boolean;notify?:boolean;radius?:number;secret?:string;revision?:number;published?:PublicMapNote};
export function mapNotesView(g:Game,pj:boolean,levelId:string,known:Dungeon):MapNoteView[]{return (g.mapNotes||[]).filter(n=>n.levelId===levelId).flatMap<MapNoteView>(n=>{
 if(pj)return [{...n,notify:n.notify??true,radius:n.radius??2,shared:!!n.published}];
 const key=cellKey(n.x,n.y);if(!n.published||!known.floors.includes(key)||!known.revealed.includes(key))return [];
 return [{id:n.id,levelId:n.levelId,x:n.x,y:n.y,title:n.published.title,text:n.published.text,...(n.published.roomNumber?{roomNumber:n.published.roomNumber}:{}),shared:true}];
});}
function fields(b:Record<string,unknown>,previous?:MapNote){if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>60)throw new Error('Nadpis místa musí mít 1 až 60 znaků.');if(typeof b.text!=='string'||b.text.length>2000||typeof b.secret!=='string'||b.secret.length>3000)throw new Error('Popis smí mít nejvýše 2000 a tajná příprava 3000 znaků.');const notify=b.notify===undefined?previous?.notify??true:b.notify,radius=b.radius===undefined?previous?.radius??2:b.radius;if(typeof notify!=='boolean'||typeof radius!=='number'||!Number.isInteger(radius)||radius<1||radius>6)throw new Error('Upozornění nastav na 1 až 6 polí.');const roomNumber=b.roomNumber===undefined?previous?.roomNumber:b.roomNumber===null?undefined:b.roomNumber;if(roomNumber!==undefined&&(typeof roomNumber!=='number'||!Number.isInteger(roomNumber)||roomNumber<1||roomNumber>999))throw new Error('Číslo místnosti musí být od 1 do 999.');return {title:b.title.trim(),text:b.text.trim(),secret:b.secret.trim(),notify,radius,roomNumber:roomNumber as number|undefined};}
export function mapNoteAction(g:Game,actor:Member,b:Record<string,unknown>){
 if(actor.role!=='pj')throw new Error('Poznámky na mapě spravuje pouze Pán jeskyně.');
 if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))throw new Error('Chybí identifikátor akce.');
 if(g.mapNoteOperations?.includes(b.requestId))return;
 if(typeof b.levelId!=='string'||typeof b.x!=='number'||typeof b.y!=='number'||!Number.isInteger(b.x)||!Number.isInteger(b.y)||b.x<0||b.x>=28||b.y<0||b.y>=20)throw new Error('Vyber políčko na platném patře.');
 const level=g.atlas?getLevel(g.atlas,b.levelId):undefined;if(!g.atlas&&b.levelId!=='ground')throw new Error('Patro neexistuje.');
 const notes=g.mapNotes||[],note=notes.find(n=>n.levelId===b.levelId&&n.x===b.x&&n.y===b.y);
 if(b.op==='save'){
  if(typeof b.publish!=='boolean')throw new Error('Vyber způsob uložení popisu.');
  const values=fields(b,note);if(values.roomNumber&&notes.some(n=>n.levelId===b.levelId&&n.id!==note?.id&&n.roomNumber===values.roomNumber))throw new Error('Toto číslo místnosti už je na patře použité.');if(b.publish&&!values.text)throw new Error('Před sdílením napiš popis pro družinu.');
  if(note){if(b.noteId!==note.id||b.expectedRevision!==note.revision)throw new EditConflict('Poznámka se mezitím změnila. Rozepsaný text zůstává zachovaný; otevři místo znovu.');Object.assign(note,values,{revision:note.revision+1});if(b.publish)note.published={title:values.title,text:values.text,...(values.roomNumber?{roomNumber:values.roomNumber}:{})};}
  else{if(b.noteId||b.expectedRevision!==null)throw new EditConflict('Poznámka už neexistuje. Otevři místo znovu.');if(notes.length>=200)throw new Error('Dobrodružství může mít nejvýše 200 poznámek na mapě.');if(!(level?.map||dungeonFor(g)).floors.includes(cellKey(b.x,b.y)))throw new Error('Novou poznámku umísti na podlahu místnosti nebo chodby.');notes.push({id:crypto.randomUUID(),levelId:b.levelId,x:b.x,y:b.y,...values,revision:0,...(b.publish?{published:{title:values.title,text:values.text,...(values.roomNumber?{roomNumber:values.roomNumber}:{})}}:{})});g.mapNotes=notes;}
 }else{
  if(!note||b.noteId!==note.id||b.expectedRevision!==note.revision)throw new EditConflict('Poznámka se mezitím změnila nebo byla odebrána. Otevři místo znovu.');
  if(b.op==='move'){
   if(typeof b.toX!=='number'||typeof b.toY!=='number'||!Number.isInteger(b.toX)||!Number.isInteger(b.toY)||b.toX<0||b.toX>=28||b.toY<0||b.toY>=20)throw new Error('Vyber políčko uvnitř mapy.');
   if(!(level?.map||dungeonFor(g)).floors.includes(cellKey(b.toX,b.toY)))throw new Error('Značku umísti na podlahu.');
   if(notes.some(n=>n.id!==note.id&&n.levelId===note.levelId&&n.x===b.toX&&n.y===b.toY))throw new Error('Na cílovém políčku už je jiné místo.');
   note.x=b.toX;note.y=b.toY;note.revision++;
  }else if(b.op==='unpublish'){delete note.published;note.revision++;}
  else if(b.op==='remove')g.mapNotes=notes.filter(n=>n.id!==note.id);
  else throw new Error('Neznámá akce poznámky.');
 }
 if(g.mapNoteAlerts)g.mapNoteAlerts=g.mapNoteAlerts.filter(alert=>g.mapNotes?.some(n=>n.id===alert.noteId&&n.notify!==false));
 g.mapNoteOperations=[...(g.mapNoteOperations||[]),b.requestId].slice(-256);
}
