import {ABILITIES,abilityValues,type AbilityKey} from './character';
import {abilityBonus,die,integer,signed} from './mechanics';
import {EditConflict} from './sheets';
import type {Game,Member} from './game';
export type ChallengeResult={die:number;base:number;total:number};
export type Challenge={id:string;memberId:string;title:string;ability:AbilityKey;difficulty:number;modifier:number;showDifficulty:boolean;audience:'all'|'private';noteId?:string;state:'pending'|'rolled'|'resolved'|'cancelled';result?:ChallengeResult;resolution?:string;revision:number;createdAt:number};
export type ChallengeView=Omit<Challenge,'difficulty'|'noteId'> & {difficulty?:number;noteId?:string;passed?:boolean;memberName:string;available:boolean};
export function challengeViews(g:Game,me:Member):ChallengeView[]{return (g.challenges||[]).filter(c=>me.role==='pj'||c.audience==='all'||c.memberId===me.id).map(c=>{const {difficulty,noteId,...rest}=c,member=g.members.find(m=>m.id===c.memberId),reveal=me.role==='pj'||c.showDifficulty;return {...rest,memberName:member?.name||'Postava',available:!!member&&!member.archived,...(reveal?{difficulty,...(c.result?{passed:c.result.total>=difficulty}:{})}:{}),...(me.role==='pj'&&noteId?{noteId}:{})};});}
export function challengeAction(g:Game,me:Member,b:Record<string,unknown>){
 if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))throw new Error('Chybí identifikátor zkoušky.');
 const operation=me.id+':'+b.requestId;if(g.challengeOperations?.includes(operation))return;
 const pj=g.members.find(m=>m.role==='pj'&&!m.archived)!;
 const log=(c:Challenge,text:string,roll=false)=>g.messages.push({id:crypto.randomUUID(),from:me.id,name:me.name,text,to:c.audience==='all'?'all':me.role==='pj'?c.memberId:pj.id,time:Date.now(),...(roll?{roll:true}:{}),...(c.audience==='private'?{audience:[pj.id,c.memberId]}:{})});
 if(b.op==='create'){
  if(me.role!=='pj')throw new Error('Ke zkoušce vyzývá pouze PJ.');
  const member=g.members.find(m=>m.id===b.memberId&&m.role==='player'&&!m.archived);if(!member)throw new Error('Vyber aktivního hráče.');
  if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>80)throw new Error('Název zkoušky musí mít 1 až 80 znaků.');
  const ability=ABILITIES.find(a=>a.key===b.ability);if(!ability)throw new Error('Vyber vlastnost.');
  const difficulty=integer(b.difficulty,-100,200,'Nebezpečnost'),modifier=integer(b.modifier,-100,100,'Oprava');
  if(typeof b.showDifficulty!=='boolean'||!['all','private'].includes(String(b.audience)))throw new Error('Vyber viditelnost zkoušky a nebezpečnosti.');
  if(b.noteId!==undefined&&(typeof b.noteId!=='string'||!g.mapNotes?.some(n=>n.id===b.noteId)))throw new Error('Poznámka místa už není dostupná.');
  if((g.challenges||[]).filter(c=>c.state==='pending'||c.state==='rolled').length>=50)throw new Error('Nejdřív dokonči starší zkoušky (nejvýše 50 rozpracovaných).');
  const c:Challenge={id:crypto.randomUUID(),memberId:member.id,title:b.title.trim(),ability:ability.key,difficulty,modifier,showDifficulty:b.showDifficulty,audience:b.audience as Challenge['audience'],...(b.noteId?{noteId:String(b.noteId)}:{}),state:'pending',revision:0,createdAt:Date.now()};g.challenges=[...(g.challenges||[]),c];log(c,`Výzva ke zkoušce: ${member.name} · ${c.title} · ${ability.label}.`);
 }else{
  const c=g.challenges?.find(c=>c.id===b.id);if(!c||me.role!=='pj'&&c.memberId!==me.id)throw new Error('Zkouška není dostupná.');
  if(c.revision!==b.expectedRevision)throw new EditConflict('Zkouška se mezitím změnila. Obnov její stav.');
  if(b.op==='roll'){
   if(c.state!=='pending')throw new EditConflict('Na tuto zkoušku už nelze házet.');const member=g.members.find(m=>m.id===c.memberId&&!m.archived);if(!member)throw new Error('Postava už není aktivní.');
   const base=abilityBonus(abilityValues(member)[c.ability]),dice=die(10);c.result={die:dice,base,total:dice+base+c.modifier};c.state='rolled';log(c,`${member.name} · ${c.title}: 1k10 [${dice}] ${signed(base)} ${signed(c.modifier)} = ${c.result.total}. Následky určí PJ.`,true);
  }else if(b.op==='resolve'){
   if(me.role!=='pj')throw new Error('Následky zkoušky určuje pouze PJ.');if(c.state!=='rolled')throw new EditConflict('Nejdřív je potřeba hod, nebo zkoušku zruš.');
   if(typeof b.resolution!=='string'||!b.resolution.trim()||b.resolution.trim().length>1000)throw new Error('Napiš výsledek pro hráče (1 až 1000 znaků).');c.resolution=b.resolution.trim();c.state='resolved';log(c,`${c.title} · rozhodnutí PJ: ${c.resolution}`);
  }else if(b.op==='cancel'){
   if(me.role!=='pj')throw new Error('Zkoušku ruší pouze PJ.');if(!['pending','rolled'].includes(c.state))throw new EditConflict('Zkouška už je uzavřená.');c.state='cancelled';log(c,`PJ zrušil zkoušku: ${c.title}.`);
  }else throw new Error('Neznámá akce zkoušky.');
  c.revision++;
 }
 const closed=(g.challenges||[]).filter(c=>c.state==='resolved'||c.state==='cancelled').slice(-100),keep=new Set(closed.map(c=>c.id));g.challenges=g.challenges?.filter(c=>c.state==='pending'||c.state==='rolled'||keep.has(c.id));
 g.messages=g.messages.slice(-500);g.challengeOperations=[...(g.challengeOperations||[]),operation].slice(-256);
}
