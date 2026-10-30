import {withExpected} from './test-client.mjs';
import assert from 'node:assert/strict';
import {dungeonFor,playerDungeon} from '../lib/dungeon.ts';
const base=process.argv[2]||'http://127.0.0.1:5173';
async function post(s,action,data={}){data=await withExpected(base,s,action,data);const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.token}:{})},body:JSON.stringify({action,room:s?.room,...data})});return {status:r.status,...await r.json()};}
async function get(s){const r=await fetch(base+'/api/game?room='+s.room,{headers:{Authorization:'Bearer '+s.token}});return r.json();}
const map=(s,tool,values={},requestId=crypto.randomUUID())=>post(s,'map',{tool,...values,requestId});
const pj=await post(null,'create',{name:'Mapový test'});const a=await post(null,'join',{room:pj.room,name:'Průzkumník'});
assert.deepEqual(pj.game.dungeon,{floors:[],edges:{},revealed:[]});assert.equal(pj.game.canUndoMap,false);
assert.equal((await map(a,'room',{from:[2,2],to:[5,5]})).status,403);
const roomId=crypto.randomUUID();assert.equal((await map(pj,'room',{from:[2,2],to:[5,5]},roomId)).status,200);
let master=await get(pj);assert.equal(master.dungeon.floors.length,16);assert.equal(Object.keys(master.dungeon.edges).length,16);assert.equal(master.canUndoMap,true);
let player=await get(a);assert.deepEqual(player.dungeon,{floors:[],edges:{},revealed:[]});assert(!('mapHistory' in master));assert(!('mapHistory' in player));assert(!('mapOperations' in player));assert.deepEqual(player.cells,{});
await map(pj,'door',{edges:['h:3:2']});assert.equal((await get(pj)).dungeon.edges['h:3:2'],'door');assert.equal((await get(a)).dungeon.edges['h:3:2'],undefined);
await map(pj,'room',{from:[20,15],to:[25,18]});
const revealId=crypto.randomUUID();await map(pj,'reveal',{from:[2,2],to:[5,5]},revealId);await map(pj,'reveal',{from:[2,2],to:[5,5]},revealId);
player=await get(a);assert.equal(player.dungeon.floors.length,16);assert.equal(player.dungeon.edges['h:3:2'],'door');assert.equal(player.dungeon.edges['h:20:15'],undefined);assert(!JSON.stringify(player).includes('h:20:15'));assert.equal(player.dungeon.revealed.length,16);
const undoId=crypto.randomUUID();await map(pj,'undo',{},undoId);await map(pj,'undo',{},undoId);assert.equal((await get(a)).dungeon.floors.length,0);assert.equal((await get(pj)).dungeon.edges['h:20:15'],'wall');
await map(pj,'undo');assert.equal((await get(pj)).dungeon.edges['h:20:15'],undefined);
await map(pj,'reveal',{from:[2,2],to:[5,5]});await map(pj,'hide',{from:[2,2],to:[5,5]});assert.equal((await get(a)).dungeon.floors.length,0);await map(pj,'undo');assert.equal((await get(a)).dungeon.floors.length,16);
await map(pj,'erase',{edges:['h:3:2']});assert.equal((await get(pj)).dungeon.edges['h:3:2'],'wall');await map(pj,'undo');assert.equal((await get(pj)).dungeon.edges['h:3:2'],'door');
await map(pj,'wall',{points:[[8,8],[12,8]]});assert.equal((await get(pj)).dungeon.edges['h:11:8'],'wall');await map(pj,'undo');assert.equal((await get(pj)).dungeon.edges['h:11:8'],undefined);
await map(pj,'floor',{points:[[10,10],[15,10]]});assert((await get(pj)).dungeon.floors.includes('13,10'));
const prior=JSON.stringify((await get(pj)).dungeon);for(const [tool,data] of [['room',{from:[-1,0],to:[2,2]}],['reveal',{from:[0,0],to:[28,20]}],['wall',{points:[[0,0],[29,20]]}],['door',{edges:['v:29:2']}],['erase',{edges:['h:2:21']}],['floor',{points:[[1.5,0]]}]])assert.equal((await map(pj,tool,data)).status,400);assert.equal(JSON.stringify((await get(pj)).dungeon),prior);
await Promise.all([map(pj,'room',{from:[16,2],to:[18,4]}),map(pj,'room',{from:[20,2],to:[22,4]})]);master=await get(pj);assert(master.dungeon.edges['h:16:2']);assert(master.dungeon.edges['h:20:2']);
const legacy=dungeonFor({cells:{'1,1':'floor','2,1':'floor','5,5':'wall'},fog:['2,1','5,5','5,4','4,5','6,5','5,6']});assert(legacy.floors.includes('2,1'));assert(!legacy.revealed.includes('2,1'));assert.equal(legacy.edges['h:1:1'],'wall');const legacyPlayer=playerDungeon(legacy);assert(!legacyPlayer.floors.includes('2,1'));assert.equal(legacyPlayer.edges['h:5:5'],undefined);
assert.equal((await post(a,'character',{name:'Stále hráč',hp:12,maxHp:12,stats:'poznámka',inventory:'lano',dungeon:{revealed:['20,2']}})).status,200);assert.equal((await get(a)).dungeon.edges['h:20:2'],undefined);
console.log('PASS: prázdná skrytá mapa, zdi/místnosti/dveře/podlaha/guma, odhalování a skrývání, atomické Zpět, opakování a souběh, oprávnění, soukromí v API a historie, hranice mapy a převod starších map.');
