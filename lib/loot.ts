import type {Game,Member} from './game';
import {integer} from './mechanics';
import {EditConflict} from './sheets';
export const CURRENCIES=[{key:'gold',label:'Zlaté'},{key:'silver',label:'Stříbrné'},{key:'copper',label:'Měděné'}] as const;
export type Coins={gold:number;silver:number;copper:number};
export const emptyCoins=():Coins=>({gold:0,silver:0,copper:0});
export type Possession={id:string;name:string;quantity:number};
export type LootClaim={id:string;memberId:string;memberName:string;items:{name:string;quantity:number}[];coins:Coins;at:number};
export type Loot={id:string;title:string;secret:string;noteId?:string;items:Possession[];coins:Coins;state:'draft'|'open'|'closed';claims:LootClaim[];revision:number;createdAt:number};
export type LootView=Omit<Loot,'secret'|'noteId'> & {secret?:string;noteId?:string};
export function lootViews(g:Game,pj:boolean):LootView[]{return (g.loot||[]).filter(l=>pj||l.state!=='draft').map(l=>{const {secret,noteId,...rest}=l;return {...rest,...(pj?{secret,...(noteId?{noteId}:{})}:{})};});}
function coins(value:unknown,max=1000000):Coins{const v=value as Coins;if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Zadej počty mincí.');return Object.fromEntries(CURRENCIES.map(c=>[c.key,integer(v[c.key],0,max,c.label)])) as Coins;}
const hasCoins=(c:Coins)=>CURRENCIES.some(k=>c[k.key]>0);
export function lootAction(g:Game,me:Member,b:Record<string,unknown>){
 if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))throw new Error('Chybí identifikátor kořisti.');const operation=me.id+':'+b.requestId;if(g.lootOperations?.includes(operation))return;
 const isPJ=me.role==='pj',list=g.loot||[];let l=list.find(l=>l.id===b.id);
 const log=(text:string)=>g.messages.push({id:crypto.randomUUID(),from:me.id,name:me.name,text,to:'all',time:Date.now()});
 if(b.op==='save'){
  if(!isPJ)throw new Error('Kořist připravuje pouze PJ.');
  if(l){if(l.state!=='draft'||l.revision!==b.expectedRevision)throw new EditConflict('Příprava se mezitím změnila nebo už byla zveřejněna.');}
  else if(b.id||b.expectedRevision!==null)throw new EditConflict('Příprava už není dostupná.');
  if(typeof b.title!=='string'||!b.title.trim()||b.title.trim().length>80||typeof b.secret!=='string'||b.secret.length>2000||typeof b.publish!=='boolean')throw new Error('Zadej název (1–80 znaků), poznámku (nejvýše 2000) a způsob uložení.');
  if(!Array.isArray(b.items)||b.items.length>24)throw new Error('Nález může mít nejvýše 24 položek.');
  const items=b.items.map((raw:unknown)=>{const row=raw as Possession;if(!row||typeof row.name!=='string'||!row.name.trim()||row.name.trim().length>60)throw new Error('Název předmětu musí mít 1 až 60 znaků.');return {id:crypto.randomUUID(),name:row.name.trim(),quantity:integer(row.quantity,1,9999,'Počet předmětů')};});
  if(new Set(items.map(i=>i.name.toLocaleLowerCase('cs'))).size!==items.length)throw new Error('Stejné předměty spoj do jedné položky.');
  const money=coins(b.coins);if(!items.length&&!hasCoins(money))throw new Error('Přidej alespoň jeden předmět nebo mince.');
  if(b.noteId!==undefined&&(typeof b.noteId!=='string'||!g.mapNotes?.some(n=>n.id===b.noteId)))throw new Error('Poznámka místa už není dostupná.');
  if(!l){if(list.filter(l=>l.state!=='closed').length>=50)throw new Error('Dokonči starší nálezy (nejvýše 50 otevřených příprav a nálezů).');l={id:crypto.randomUUID(),title:'',secret:'',items:[],coins:emptyCoins(),claims:[],state:'draft',revision:0,createdAt:Date.now()};list.push(l);g.loot=list;}else l.revision++;
  Object.assign(l,{title:b.title.trim(),secret:b.secret.trim(),items,coins:money,state:b.publish?'open':'draft',...(b.noteId?{noteId:b.noteId}:{})});if(b.publish)log(`PJ zveřejnil kořist: ${l.title}.`);
 }else{
  if(!l||!isPJ&&l.state==='draft')throw new Error('Kořist není dostupná.');
  if(l.revision!==b.expectedRevision)throw new EditConflict('Kořist se mezitím změnila. Zkontroluj zbývající množství.');
  if(b.op==='remove'){if(!isPJ)throw new Error('Přípravu odstraňuje pouze PJ.');if(l.state!=='draft')throw new EditConflict('Zveřejněný nález nelze odstranit; můžeš jej uzavřít.');list.splice(list.indexOf(l),1);
  }else if(b.op==='close'||b.op==='reopen'){
   if(!isPJ)throw new Error('Nález uzavírá a znovu otevírá pouze PJ.');
   if(b.op==='close'&&l.state!=='open'||b.op==='reopen'&&l.state!=='closed')throw new EditConflict('Nález už má jiný stav.');
   if(b.op==='reopen'&&list.filter(l=>l.state!=='closed').length>=50)throw new Error('Nejdřív uzavři jiný nález.');l.state=b.op==='close'?'closed':'open';log(`PJ ${b.op==='close'?'uzavřel':'znovu otevřel'} kořist: ${l.title}.`);
  }else{
   if(l.state!=='open')throw new EditConflict('Tento nález není otevřený k rozdělení.');
   const target=(id:unknown)=>{const m=g.members.find(m=>m.id===id&&m.role==='player'&&!m.archived);if(!m)throw new Error('Vyber aktivní postavu hráče.');return m;};
   const recipients:Member[]=[],awards:{items:{name:string;quantity:number}[];coins:Coins}[]=[];
   if(b.op==='take-item'){
    const who=target(isPJ?b.memberId:me.id);if(!isPJ&&b.memberId!==undefined&&b.memberId!==me.id)throw new Error('Kořist si můžeš vzít pouze pro svou postavu.');
    const item=l.items.find(i=>i.id===b.itemId),quantity=integer(b.quantity,1,9999,'Počet předmětů');if(!item||item.quantity<quantity)throw new EditConflict('Tolik kusů už v nálezu není.');recipients.push(who);awards.push({items:[{name:item.name,quantity}],coins:emptyCoins()});
   }else if(b.op==='take-coins'){
    const who=target(isPJ?b.memberId:me.id);if(!isPJ&&b.memberId!==undefined&&b.memberId!==me.id)throw new Error('Mince si můžeš vzít pouze pro svou postavu.');
    const money=coins(b.coins);if(!hasCoins(money))throw new Error('Zadej alespoň jednu minci.');if(CURRENCIES.some(c=>money[c.key]>l!.coins[c.key]))throw new EditConflict('Tolik mincí už v nálezu není.');recipients.push(who);awards.push({items:[],coins:money});
   }else if(b.op==='split-coins'){
    if(!isPJ)throw new Error('Společné rozdělení potvrzuje PJ.');if(!Array.isArray(b.memberIds)||!b.memberIds.length||b.memberIds.length>12||new Set(b.memberIds).size!==b.memberIds.length)throw new Error('Vyber různé aktivní postavy.');
    recipients.push(...b.memberIds.map(target));const share=Object.fromEntries(CURRENCIES.map(c=>[c.key,Math.floor(l!.coins[c.key]/recipients.length)])) as Coins;if(!hasCoins(share))throw new Error('Mincí není dost na stejný podíl. Zbytek můžeš přidělit jednotlivě.');for(const _ of recipients)awards.push({items:[],coins:{...share}});
   }else throw new Error('Neznámá akce kořisti.');
   if(l.claims.length+recipients.length>200)throw new Error('Nález už má 200 záznamů rozdělení. Uzavři jej a zbytek připrav jako nový nález.');
   // Validate every recipient before transferring anything, including group splits.
   for(let i=0;i<recipients.length;i++){const who=recipients[i],award=awards[i];for(const c of CURRENCIES)if((who.purse?.[c.key]||0)+award.coins[c.key]>999999999)throw new Error(`${who.name}: měšec už dosáhl limitu.`);for(const item of award.items){const owned=who.possessions?.find(p=>p.name===item.name);if(owned&&owned.quantity+item.quantity>999999||!owned&&(who.possessions?.length||0)>=200)throw new Error(`${who.name}: získaná výbava už dosáhla limitu.`);}}
   for(let i=0;i<recipients.length;i++){const who=recipients[i],award=awards[i];who.purse??=emptyCoins();for(const c of CURRENCIES){who.purse[c.key]+=award.coins[c.key];l.coins[c.key]-=award.coins[c.key];}for(const item of award.items){who.possessions??=[];const owned=who.possessions.find(p=>p.name===item.name);if(owned)owned.quantity+=item.quantity;else who.possessions.push({id:crypto.randomUUID(),...item});l.items.find(p=>p.id===b.itemId)!.quantity-=item.quantity;}
    who.equipmentRevision=(who.equipmentRevision??0)+1;
    l.claims.push({id:crypto.randomUUID(),memberId:who.id,memberName:who.name,...award,at:Date.now()});const description=[...award.items.map(item=>`${item.name} × ${item.quantity}`),...CURRENCIES.filter(c=>award.coins[c.key]).map(c=>`${award.coins[c.key]} ${c.label.toLocaleLowerCase('cs')}`)].join(', ');log(`${l.title} · ${who.name} získává: ${description}.`);
   }
  }
  l.revision++;
 }
 const closed=list.filter(l=>l.state==='closed').slice(-100),keep=new Set(closed.map(l=>l.id));g.loot=list.filter(l=>l.state!=='closed'||keep.has(l.id));g.lootOperations=[...(g.lootOperations||[]),operation].slice(-256);g.messages=g.messages.slice(-500);
}
