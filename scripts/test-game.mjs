import {withExpected} from './test-client.mjs';
import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:5173';
async function post(s,action,data={}){data=await withExpected(origin,s,action,data);const r=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.token}:{})},body:JSON.stringify({action,room:s?.room,...data})});const d=await r.json();return {status:r.status,...d};}
async function get(s){const r=await fetch(origin+'/api/game?room='+s.room,{headers:{Authorization:'Bearer '+s.token}});return r.json();}
const pj=await post(null,'create',{name:'Test PJ'});assert.equal(pj.status,200);assert(pj.token&&pj.room);const a=await post(null,'join',{room:pj.room,name:'Hráč A'});const b=await post(null,'join',{room:pj.room,name:'Hráč B'});assert.equal(a.status,200);assert.equal(b.status,200);
await post(pj,'map',{tool:'reveal',from:[0,0],to:[27,19],requestId:crypto.randomUUID()});
await post(pj,'map',{tool:'room',from:[3,3],to:[8,8],requestId:crypto.randomUUID()});
await post(pj,'map',{tool:'reveal',from:[0,0],to:[27,19],requestId:crypto.randomUUID()});
await post(pj,'notes',{notes:'TAJNÝ TEST',scene:'Testovací místnost'});assert.equal((await get(a)).notes,'');assert.equal((await get(pj)).notes,'TAJNÝ TEST');assert.equal((await post(a,'notes',{notes:'ne'})).status,403);
await post(a,'chat',{text:'Jen PJ',to:pj.game.me});assert((await get(pj)).messages.some(m=>m.text==='Jen PJ'));assert(!(await get(b)).messages.some(m=>m.text==='Jen PJ'));
await post(pj,'map',{tool:'hide',from:[4,4],to:[4,4],requestId:crypto.randomUUID()});assert.equal((await get(a)).cells['4,4'],undefined);assert.equal((await get(pj)).cells['4,4'],'floor');assert.equal((await post(a,'cell',{x:0,y:0,tool:'wall'})).status,403);
assert.equal((await post(a,'move',{id:b.game.me,x:3,y:3})).status,403);assert.equal((await post(a,'move',{id:a.game.me,x:8,y:9})).status,200);
await Promise.all([post(a,'chat',{text:'Současně A'}),post(b,'chat',{text:'Současně B'})]);const g=await get(pj);assert(g.messages.some(m=>m.text==='Současně A'));assert(g.messages.some(m=>m.text==='Současně B'));assert(g.members.every(m=>!('token' in m)));
const roll=await post(a,'roll',{text:'2k6+1'});assert.equal(roll.status,200);assert.match(roll.game.messages.at(-1).text,/2k6\+1 → (\d+)/);assert.equal((await post(a,'roll',{text:'100k6'})).status,400);
assert.equal((await post(a,'character',{name:'Nové jméno',hp:9,maxHp:12,stats:'Síla 13',inventory:'Lano'})).status,200);assert.equal((await get(a)).members.find(m=>m.id===a.game.me).name,'Nové jméno');console.log('PASS: místnosti, připojení, soukromí PJ a šeptání, mlha, oprávnění, souběžné zprávy, kostky, deník.');

const details={name:'Borin',hp:9,maxHp:12,stats:'Staré poznámky zůstanou',inventory:'Lano',race:'Trpaslík',profession:'Válečník',level:3,strength:18,dexterity:11,constitution:17,intelligence:9,charisma:10};assert.equal((await post(a,'character',details)).status,200);const character=(await get(a)).members.find(m=>m.id===a.game.me);assert.deepEqual(character.abilities,{strength:18,dexterity:11,constitution:17,intelligence:9,charisma:10});assert.equal(character.race,'Trpaslík');assert.equal(character.profession,'Válečník');assert.equal(character.level,3);assert.equal(character.stats,'Staré poznámky zůstanou');for(const data of [{strength:22},{dexterity:0},{constitution:12.5},{level:0},{intelligence:'abc'}])assert.equal((await post(a,'character',data)).status,400);assert.equal((await get(a)).members.find(m=>m.id===a.game.me).abilities.strength,18);console.log('PASS: strukturované vlastnosti, rasa, povolání, úroveň, zachování poznámek a serverová validace.');

const award={target:a.game.me,amount:150,reason:'Chytré vyřešení hádanky',requestId:crypto.randomUUID()};
assert.equal((await post(a,'experience',award)).status,403);
assert.equal((await post(pj,'experience',award)).status,200);
let experienceState=await get(a);
assert.equal(experienceState.members.find(m=>m.id===a.game.me).experience,150);
assert.equal(experienceState.members.find(m=>m.id===b.game.me).experience??0,0);
assert(experienceState.messages.some(m=>m.experience&&m.text.includes('Chytré vyřešení hádanky')));
assert.equal((await post(pj,'experience',award)).status,200);
assert.equal((await get(a)).members.find(m=>m.id===a.game.me).experience,150);
const partyAward={target:'all',amount:50,reason:'Dokončení výpravy',requestId:crypto.randomUUID()};
await Promise.all([post(pj,'experience',partyAward),post(pj,'experience',partyAward)]);
let xpState=await get(pj);
assert.equal(xpState.members.find(m=>m.id===a.game.me).experience,200);
assert.equal(xpState.members.find(m=>m.id===b.game.me).experience,50);
assert.equal(xpState.members.find(m=>m.id===pj.game.me).experience??0,0);
assert.equal(xpState.experienceAwards.length,2);
for(const bad of [{amount:-1},{amount:0},{amount:1.5},{amount:'100'},{amount:1000001},{target:'missing'},{target:pj.game.me},{requestId:''}])assert.equal((await post(pj,'experience',{...partyAward,requestId:crypto.randomUUID(),...bad})).status,400);
await post(a,'character',{...details,experience:99999});
assert.equal((await get(a)).members.find(m=>m.id===a.game.me).experience,200);
const empty=await post(null,'create',{name:'PJ bez hráčů'});
assert.equal((await post(empty,'experience',{target:'all',amount:10,requestId:crypto.randomUUID()})).status,400);
console.log('PASS: zkušenosti jen od PJ, jednotlivě i celé družině, součty, záznam odměny, souběžné opakování bez dvojího přičtení, validace a ochrana při uložení deníku.');
