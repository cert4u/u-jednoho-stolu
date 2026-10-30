import {withExpected} from './test-client.mjs';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
// Production uses Vinext's resolver; use the same extensionless TS imports here.
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(e){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(specifier+'.ts',context);throw e;}}});
const {abilityBonus,rollDice,damageFor}=await import('../lib/mechanics.ts');
assert.deepEqual(Array.from({length:21},(_,i)=>abilityBonus(i+1)),[-5,-4,-4,-3,-3,-2,-2,-1,-1,0,0,0,1,1,2,2,3,3,4,4,5]);
const sequence=[6,6,3];assert.deepEqual(rollDice(6,true,()=>sequence.shift()),[6,6,3]);assert.deepEqual(rollDice(10,false,()=>10),[10]);assert.throws(()=>rollDice(6,true,()=>6));
assert.equal(damageFor(8,8,9),0);assert.equal(damageFor(9,8,-5),1);assert.equal(damageFor(12,8,2),6);
const base=process.argv[2]||'http://127.0.0.1:5173';
async function post(s,action,data={}){data=await withExpected(base,s,action,data);const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.token}:{})},body:JSON.stringify({action,room:s?.room,...data})});return {status:r.status,...await r.json()};}
async function get(s){return (await fetch(base+'/api/game?room='+s.room,{headers:{Authorization:'Bearer '+s.token}})).json();}
const run=(s,data,id=crypto.randomUUID())=>post(s,'mechanics',{...data,requestId:id});
const pj=await post(null,'create',{name:'Test PJ'}),a=await post(null,'join',{room:pj.room,name:'Hrdina'}),b=await post(null,'join',{room:pj.room,name:'Obránce'});const ar={type:'member',id:a.game.me},br={type:'member',id:b.game.me};
assert.equal((await post(a,'character',{strength:21,attackNumber:8,defenseNumber:5,damageBonus:2})).status,200);
let r=await run(a,{kind:'ability',actor:ar,ability:'strength',modifier:2,difficulty:1});assert.equal(r.status,200);let m=r.game.messages.at(-1);assert.equal(m.mechanics.base,5);assert.equal(m.mechanics.total,m.mechanics.dice[0]+7);assert(m.text.includes('úspěch'));
assert.equal((await run(b,{kind:'ability',actor:ar,ability:'strength'})).status,400);
assert.equal((await run(a,{kind:'attack',actor:ar,target:br,base:0.5})).status,400);
const id=crypto.randomUUID(),data={kind:'attack',actor:ar,target:br,base:100,damageBonus:3,modifier:0};const pair=await Promise.all([run(a,data,id),run(a,data,id)]);assert(pair.every(x=>x.status===200));let g=await get(a);assert.equal(g.messages.filter(m=>m.mechanics?.kind==='attack').length,1);const attack=g.messages.at(-1);assert.equal((await get(b)).messages.at(-1).id,attack.id);
assert.equal((await run(a,{kind:'defense',attackId:attack.id,base:0})).status,400);
r=await run(b,{kind:'defense',attackId:attack.id,base:0,modifier:0});assert.equal(r.status,200);const defense=r.game.messages.at(-1);assert.equal(defense.mechanics.proposedDamage,damageFor(attack.mechanics.total,defense.mechanics.total,3));assert.equal(r.game.members.find(m=>m.id===br.id).hp,12);
assert.equal((await run(b,{kind:'defense',attackId:attack.id,base:0})).status,400);assert.equal((await run(a,{kind:'apply',defenseId:defense.id,amount:3})).status,400);
const applyId=crypto.randomUUID();await Promise.all([run(pj,{kind:'apply',defenseId:defense.id,amount:3},applyId),run(pj,{kind:'apply',defenseId:defense.id,amount:3},applyId)]);g=await get(pj);assert.equal(g.members.find(m=>m.id===br.id).hp,9);assert(g.messages.find(m=>m.id===defense.id).mechanics.applied);assert.equal((await run(pj,{kind:'apply',defenseId:defense.id,amount:3})).status,400);assert(!('mechanicsOperations' in g));
r=await run(a,{kind:'ability',actor:ar,ability:'dexterity',audience:'pj'});const secret=r.game.messages.at(-1);assert((await get(pj)).messages.some(m=>m.id===secret.id));assert(!(await get(b)).messages.some(m=>m.id===secret.id));
r=await post(pj,'monster',{op:'create',name:'Skrytý strážce',maxHp:9,attackNumber:5,defenseNumber:4,damageBonus:1,requestId:crypto.randomUUID()});const monster=r.game.monsters[0],mr={type:'monster',id:monster.id};assert.equal(monster.combat.attack,5);
assert.equal((await run(a,{kind:'attack',actor:ar,target:mr,base:5})).status,400);
r=await run(pj,{kind:'attack',actor:mr,target:br,base:5,audience:'all'});assert.equal(r.status,200);m=r.game.messages.at(-1);assert.equal(m.to,pj.game.me);assert(!(await get(b)).messages.some(x=>x.id===m.id));
assert.equal((await run(b,{kind:'defense',attackId:m.id,base:1})).status,400);
console.log('PASS: bonusy 1–21, řetězení šestek, rovnost obrany a minimum zranění, hody serveru, oprávnění, tajné hody, ochrana skrytých příšer, navazující obrana, souběžné opakování a potvrzení zranění právě jednou.');
