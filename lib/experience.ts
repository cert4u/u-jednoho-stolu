import type { Game, Member } from './game';
export type ExperienceAward={id:string;by:string;amount:number;recipients:string[];reason:string;time:number};
export function awardExperience(game:Game,actor:Member,payload:Record<string,unknown>){
  if(actor.role!=='pj')throw new Error('Zkušenosti může přidělovat pouze Pán jeskyně.');
  const amount=payload.amount;
  if(typeof amount!=='number'||!Number.isSafeInteger(amount)||amount<1||amount>1_000_000)throw new Error('Zadej celé číslo zkušeností od 1 do 1 000 000.');
  const id=payload.requestId;
  if(typeof id!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(id))throw new Error('Neplatný identifikátor odměny. Zkus otevřít přidělení znovu.');
  // Keep request IDs so a retried award cannot be applied twice.
  if(game.experienceAwards?.some(award=>award.id===id))return;
  const recipients=game.members.filter(m=>m.role==='player'&&(payload.target==='all'||payload.target===m.id));
  if(!recipients.length)throw new Error('Vyber hráče, kterému chceš přidělit zkušenosti.');
  if(recipients.some(m=>!Number.isSafeInteger((m.experience??0)+amount)))throw new Error('Celkový počet zkušeností je příliš vysoký.');
  const reason=String(payload.reason||'').trim().slice(0,300);
  for(const member of recipients)member.experience=(member.experience??0)+amount;
  const time=Date.now();
  (game.experienceAwards??=[]).push({id,by:actor.id,amount,recipients:recipients.map(m=>m.id),reason,time});
  game.messages.push({id:crypto.randomUUID(),from:actor.id,name:actor.name,to:'all',time,experience:true,text:`${recipients.map(m=>m.name).join(', ')}: +${amount.toLocaleString('cs-CZ')} zkušeností${recipients.length>1?' pro každého':''}.${reason?' Za: '+reason:''}`});
  game.messages=game.messages.slice(-500);
}
