import assert from 'node:assert/strict';
import './generator-test-import.mjs';
const {editDungeon,emptyDungeon,playerDungeon}=await import('../lib/dungeon.ts');
const {remember}=await import('../lib/exploration.ts');
let map=editDungeon(emptyDungeon(),{tool:'room',from:[2,2],to:[12,10]});
map=editDungeon(map,{tool:'entrance',points:[[3,3]]});map=editDungeon(map,{tool:'exit',points:[[10,8]]});
assert.throws(()=>editDungeon(map,{tool:'entrance',points:[[0,0]]}));assert.throws(()=>editDungeon(map,{tool:'exit',points:[[3,3]]}));
assert.deepEqual(playerDungeon(map).access,{});
const level={map,memory:emptyDungeon()};remember(level,['3,3']);assert.deepEqual(level.memory.access,{entrance:[3,3]});
level.map=editDungeon(map,{tool:'entrance',points:[[4,4]]});remember(level,['10,8']);assert.deepEqual(level.memory.access,{entrance:[3,3],exit:[10,8]});remember(level,['3,3']);assert(!level.memory.access.entrance);remember(level,['4,4']);assert.deepEqual(level.memory.access.entrance,[4,4]);
assert(!editDungeon(map,{tool:'erase',cells:[[3,3]]}).access.entrance);assert(!editDungeon(map,{tool:'subtract',points:[[10,8]]}).access.exit);
const base=process.argv[2]||'http://127.0.0.1:5173';
async function post(s,action,data={}){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.token}:{})},body:JSON.stringify({action,room:s?.room,...data})});return {status:r.status,...await r.json()};}
async function get(s){return (await fetch(base+'/api/game?room='+s.room,{headers:{Authorization:'Bearer '+s.token}})).json();}
const pj=await post(null,'create',{name:'Vchod PJ'}),player=await post(null,'join',{room:pj.room,name:'Průzkumník'});
const draw=(s,tool,values={})=>post(s,'map',{tool,...values,requestId:crypto.randomUUID()});
assert.equal((await draw(pj,'room',{from:[2,2],to:[12,10]})).status,200);
assert.equal((await draw(player,'entrance',{points:[[3,3]]})).status,403);
assert.equal((await draw(pj,'entrance',{points:[[0,0]]})).status,400);
assert.equal((await draw(pj,'entrance',{points:[[3,3]]})).status,200);
assert.equal((await draw(pj,'exit',{points:[[10,8]]})).status,200);
assert(!((await get(player)).dungeon.access?.entrance));
assert.equal((await post(pj,'explore',{op:'enable',requestId:crypto.randomUUID()})).status,200);
await draw(pj,'reveal',{from:[3,3],to:[3,3]});assert.deepEqual((await get(player)).dungeon.access.entrance,[3,3]);
await draw(pj,'entrance',{points:[[4,4]]});assert(!(await get(player)).dungeon.access.entrance);
await draw(pj,'undo');assert.deepEqual((await get(pj)).dungeon.access.entrance,[3,3]);assert.deepEqual((await get(player)).dungeon.access.entrance,[3,3]);
assert.equal((await post(player,'explore',{op:'place',levelId:'ground',x:3,y:3,requestId:crypto.randomUUID()})).status,403);
assert.equal((await post(pj,'explore',{op:'place',levelId:'ground',x:3,y:3,requestId:crypto.randomUUID()})).status,200);
assert.deepEqual((await get(pj)).exploration.location,{levelId:'ground',x:3,y:3});assert.deepEqual((await get(player)).dungeon.access.entrance,[3,3]);assert(!('entrance' in (await get(player)).exploration));assert(!(await get(player)).dungeon.access.exit);
const backup=await (await fetch(base+'/api/game?room='+pj.room+'&download=backup',{headers:{Authorization:'Bearer '+pj.token}})).json();
assert.equal((await post(null,'restore',{backup})).status,200);
for(const access of [{entrance:[28,3]},{entrance:[0,0]},{entrance:[3,3],exit:[3,3]}]){const bad=structuredClone(backup);bad.game.atlas.levels[0].map.access=access;assert.equal((await post(null,'restore',{backup:bad})).status,400);}
const fresh=await post(null,'create',{name:'Začátek bez atlasu'});await draw(fresh,'room',{from:[1,1],to:[3,3]});await draw(fresh,'entrance',{points:[[2,2]]});const placeId=crypto.randomUUID(),place=()=>post(fresh,'explore',{op:'place',levelId:'ground',x:2,y:2,requestId:placeId});assert.equal((await place()).status,200);assert.equal((await place()).status,200);assert.deepEqual((await get(fresh)).exploration.location,{levelId:'ground',x:2,y:2});
console.log('PASS: entrance/exit floor validation, erase/subtract/undo, hidden markers, remembered discoveries, PJ-only start placement and complete backups.');
