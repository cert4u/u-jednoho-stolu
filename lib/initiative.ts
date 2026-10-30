import {visibleConditions,type Condition} from './conditions';
import type {Game,Member} from './game';
import {monsterVisible} from './monsters';
import {EditConflict} from './sheets';
export type InitiativeRef={type:'member'|'monster';id:string};
export type Initiative={revision:number;active:boolean;round:number;current:string|null;order:InitiativeRef[]};
export type InitiativeEntry=InitiativeRef & {key:string;name:string;defeated:boolean;conditions?:Condition[]};
export type InitiativeView=Omit<Initiative,'order'> & {order:InitiativeEntry[]};
export const initiativeKey=(ref:InitiativeRef)=>`${ref.type}:${ref.id}`;
function exists(g:Game,ref:InitiativeRef){return ref.type==='member'?g.members.some(m=>m.id===ref.id&&m.role==='player'&&!m.archived):(g.monsters||[]).some(m=>m.id===ref.id&&!m.archived);}
function roster(g:Game,value:unknown):InitiativeRef[]{
 if(!Array.isArray(value)||value.length>64)throw new Error('Vyber nejvýše 64 účastníků souboje.');
 const refs=value.map(item=>{if(!item||typeof item!=='object'||!['member','monster'].includes(item.type)||typeof item.id!=='string')throw new Error('Neplatný účastník souboje.');const ref={type:item.type,id:item.id} as InitiativeRef;if(!exists(g,ref))throw new Error('Účastník neexistuje nebo je archivovaný.');return ref;});
 if(new Set(refs.map(initiativeKey)).size!==refs.length)throw new Error('Účastník smí být v souboji jen jednou.');return refs;
}
function replaceOrder(state:Initiative,order:InitiativeRef[]):Initiative{
 if(!state.active)return {...state,order,current:null};
 if(!order.length)return {...state,order,active:false,current:null};
 if(order.some(r=>initiativeKey(r)===state.current))return {...state,order};
 const position=state.order.findIndex(r=>initiativeKey(r)===state.current);
 for(let step=1;step<=state.order.length;step++){
  const index=(Math.max(0,position)+step)%state.order.length,ref=state.order[index];
  if(order.some(r=>initiativeKey(r)===initiativeKey(ref)))return {...state,order,current:initiativeKey(ref),round:state.round+(index<=position?1:0)};
 }
 return {...state,order,current:initiativeKey(order[0])};
}
export function initiativeState(g:Game):Initiative{
 const state=g.initiative||{revision:0,active:false,round:0,current:null,order:[]};
 return replaceOrder(state,state.order.filter(ref=>exists(g,ref)));
}
export function reconcileInitiative(g:Game){if(!g.initiative)return;const state=initiativeState(g);if(JSON.stringify(state)!==JSON.stringify(g.initiative))g.initiative={...state,revision:g.initiative.revision+1};}
export function initiativeView(g:Game,pj:boolean):InitiativeView{
 const state=initiativeState(g),level=g.atlas?.location?.levelId||'ground';
 const order=state.order.flatMap(ref=>{
  if(ref.type==='member'){const m=g.members.find(m=>m.id===ref.id)!;return [{...ref,key:initiativeKey(ref),name:m.name,defeated:m.hp===0,conditions:visibleConditions(m.conditions,pj)}];}
  const m=g.monsters!.find(m=>m.id===ref.id)!;
  if(!pj&&!monsterVisible(g,m,level))return [];
  return [{...ref,key:initiativeKey(ref),name:`${m.name} #${m.number}`,defeated:m.hp===0,conditions:visibleConditions(m.conditions,pj)}];
 });
 return {...state,order,current:order.some(r=>r.key===state.current)?state.current:null};
}
export function initiativeAction(g:Game,actor:Member,b:Record<string,unknown>){
 if(actor.role!=='pj')throw new Error('Souboj řídí pouze Pán jeskyně.');
 if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))throw new Error('Chybí identifikátor akce.');
 if(g.initiativeOperations?.includes(b.requestId))return;
 const state=initiativeState(g);
 if(b.expectedRevision!==state.revision)throw new EditConflict('Souboj se mezitím změnil. Zkontroluj aktuální pořadí a zopakuj akci.');
 let next={...state};
 switch(b.op){
  case 'roster':next=replaceOrder(state,roster(g,b.order));break;
  case 'start':if(state.active)throw new Error('Souboj už probíhá.');if(!state.order.length)throw new Error('Nejdřív vyber účastníky souboje.');next={...state,active:true,round:1,current:initiativeKey(state.order[0])};break;
  case 'next':{if(!state.active||!state.order.length)throw new Error('Souboj zatím neprobíhá.');const index=state.order.findIndex(r=>initiativeKey(r)===state.current)+1;next={...state,current:initiativeKey(state.order[index%state.order.length]),round:state.round+(index===state.order.length?1:0)};if(next.round>1000000)throw new Error('Souboj dosáhl nejvyššího počtu kol.');break;}
  case 'stop':if(!state.active)throw new Error('Souboj zatím neprobíhá.');next={...state,active:false,current:null};break;
  default:throw new Error('Neznámá akce souboje.');
 }
 g.initiative={...next,revision:state.revision+1};
 g.initiativeOperations=[...(g.initiativeOperations||[]),b.requestId].slice(-256);
}
