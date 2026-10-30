import type {Game,Member} from './game';
import {CURRENCIES,emptyCoins,type Coins} from './loot';
import {integer} from './mechanics';
import {EditConflict} from './sheets';
export function equipmentAction(g:Game,me:Member,b:Record<string,unknown>){
 if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))throw new Error('Chybí identifikátor změny výbavy.');
 const operation=me.id+':'+b.requestId;if(g.equipmentOperations?.includes(operation))return;
 const who=g.members.find(m=>m.id===b.memberId&&!m.archived);if(!who||me.role!=='pj'&&who.id!==me.id)throw new Error('Tuto výbavu nemůžeš upravovat.');
 if(b.expectedRevision!==(who.equipmentRevision??0))throw new EditConflict('Výbava nebo měšec se mezitím změnily. Načti aktuální stav; rozepsané údaje zůstávají tady.');
 let description:string;
 if(b.op==='add'||b.op==='edit'){
  if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>60)throw new Error('Název předmětu musí mít 1 až 60 znaků.');
  const name=b.name.trim(),quantity=integer(b.quantity,b.op==='add'?1:0,b.op==='add'?9999:999999,'Počet předmětů');
  const items=who.possessions||[];
  if(b.op==='add'){
   const existing=items.find(i=>i.name===name);if(existing){if(existing.quantity+quantity>999999)throw new Error('Předmět už dosáhl nejvyššího počtu kusů.');existing.quantity+=quantity;}
   else{if(items.length>=200)throw new Error('Výbava může mít nejvýše 200 různých položek.');items.push({id:crypto.randomUUID(),name,quantity});}who.possessions=items;description=`přidáno ${name} × ${quantity}`;
  }else{
   const item=items.find(i=>i.id===b.itemId);if(!item)throw new EditConflict('Předmět už není ve výbavě.');if(quantity&&items.some(i=>i.id!==item.id&&i.name===name))throw new Error('Tento název už ve výbavě je. Použij přidání dalších kusů.');
   const previous=`${item.name} × ${item.quantity}`;if(quantity)Object.assign(item,{name,quantity});else who.possessions=items.filter(i=>i.id!==item.id);description=quantity?`upraveno ${previous} → ${name} × ${quantity}`:`odebráno ${previous}`;
  }
 }else if(b.op==='use'){
  const item=who.possessions?.find(i=>i.id===b.itemId);if(!item)throw new EditConflict('Předmět už není ve výbavě.');const quantity=integer(b.quantity,1,9999,'Použitý počet');if(quantity>item.quantity)throw new EditConflict('Tolik kusů už postava nemá.');item.quantity-=quantity;description=`použito ${item.name} × ${quantity}`;if(!item.quantity)who.possessions=who.possessions?.filter(i=>i.id!==item.id);
 }else if(b.op==='wallet'){
  if(!['add','spend'].includes(String(b.mode)))throw new Error('Vyber přidání nebo platbu.');if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.trim().length>200)throw new Error('Napiš důvod změny měšce (1 až 200 znaků).');
  const coins=b.coins as Coins;if(!coins||typeof coins!=='object'||Array.isArray(coins))throw new Error('Zadej počty mincí.');const amounts=Object.fromEntries(CURRENCIES.map(c=>[c.key,integer(coins[c.key],0,1000000,c.label)])) as Coins;if(!CURRENCIES.some(c=>amounts[c.key]>0))throw new Error('Zadej alespoň jednu minci.');
  const purse={...(who.purse||emptyCoins())},direction=b.mode==='spend'?-1:1;for(const c of CURRENCIES){const value=purse[c.key]+amounts[c.key]*direction;if(value<0)throw new Error(`V měšci není dost mincí (${c.label.toLocaleLowerCase('cs')}).`);if(value>999999999)throw new Error('Měšec už dosáhl limitu.');purse[c.key]=value;}who.purse=purse;
  description=`${b.mode==='spend'?'zaplaceno':'přidáno'} ${CURRENCIES.filter(c=>amounts[c.key]>0).map(c=>`${amounts[c.key]} ${c.label.toLocaleLowerCase('cs')}`).join(', ')} · ${b.reason.trim()}`;
 }else throw new Error('Neznámá změna výbavy.');
 who.equipmentRevision=(who.equipmentRevision??0)+1;
 const pj=g.members.find(m=>m.role==='pj'&&!m.archived)!;g.messages.push({id:crypto.randomUUID(),from:me.id,name:me.name,text:`${who.name} · výbava: ${description}.`,to:who.id===me.id?pj.id:who.id,audience:[...new Set([who.id,pj.id])],time:Date.now()});g.messages=g.messages.slice(-500);g.equipmentOperations=[...(g.equipmentOperations||[]),operation].slice(-256);
}
