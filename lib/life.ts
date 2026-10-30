import type {Game,Member} from './game';
import {EditConflict} from './sheets';
export const LIFE_LABELS={active:'Ve hře',out:'Vyřazen',unconscious:'V bezvědomí',dead:'Mrtvý'} as const;
export type LifeStatus=keyof typeof LIFE_LABELS;
export type Life={status:LifeStatus;note:string;revision:number};
export type LifeView={status:LifeStatus;pending:boolean;note?:string;revision?:number};
export function lifeView(m:Pick<Member,'hp'|'life'>,privateView:boolean):LifeView{const life=m.life||{status:'active',note:'',revision:0},pending=m.hp===0&&life.status==='active';return {status:pending?'out':life.status,pending,...(privateView?{note:life.note,revision:life.revision}:{})};}
export function lifeAction(g:Game,me:Member,b:Record<string,unknown>){
 if(me.role!=='pj')throw new Error('O vyřazení a návratu rozhoduje pouze PJ.');
 if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))throw new Error('Chybí identifikátor rozhodnutí.');if(g.lifeOperations?.includes(b.requestId))return;
 const member=g.members.find(m=>m.id===b.memberId&&m.role==='player'&&!m.archived);if(!member)throw new Error('Vyber aktivní postavu hráče.');
 if(b.expectedRevision!==(member.life?.revision??0)||b.expectedHp!==member.hp)throw new EditConflict('Stav nebo životy se mezitím změnily. Otevři rozhodnutí znovu; rozepsaná poznámka zůstává zachovaná.');
 if(typeof b.status!=='string'||!Object.hasOwn(LIFE_LABELS,b.status)||typeof b.note!=='string'||b.note.trim().length>300)throw new Error('Vyber stav a poznámku do 300 znaků.');
 const status=b.status as LifeStatus;if(status==='active'&&member.hp===0)throw new Error('Pro návrat do hry nejdřív obnov alespoň jeden život.');
 member.life={status,note:b.note.trim(),revision:(member.life?.revision??0)+1};if(status==='dead')member.hp=0;
 const time=Date.now();g.messages.push({id:crypto.randomUUID(),from:me.id,name:me.name,to:'all',time,text:`PJ rozhodl: ${member.name} · ${LIFE_LABELS[status]}.`});
 if(member.life.note)g.messages.push({id:crypto.randomUUID(),from:me.id,name:me.name,to:member.id,audience:[me.id,member.id],time,text:`${member.name} · poznámka ke stavu: ${member.life.note}`});
 g.messages=g.messages.slice(-500);g.lifeOperations=[...(g.lifeOperations||[]),b.requestId].slice(-256);
}
