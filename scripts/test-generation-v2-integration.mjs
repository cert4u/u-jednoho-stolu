import assert from 'node:assert/strict';
import {generateDungeon} from './generator-test-import.mjs';
const base=(process.argv[2]||'http://127.0.0.1:5173').replace(/\/$/,'');
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname))throw Error('Use an isolated local test instance.');
async function post(session,action,values={}){
 const response=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify({action,room:session?.room,...values})});
 return {status:response.status,...await response.json()};
}
async function get(session,level=''){const response=await fetch(base+'/api/game?room='+session.room+'&level='+encodeURIComponent(level),{headers:{Authorization:'Bearer '+session.token}});assert.equal(response.status,200);return response.json();}
async function backup(session){const response=await fetch(base+'/api/game?room='+session.room+'&download=backup',{headers:{Authorization:'Bearer '+session.token}});assert.equal(response.status,200);return response.json();}
const command=(session,tool,values={})=>post(session,'map',{tool,...values,requestId:crypto.randomUUID()});
const explore=(session,op,values={})=>post(session,'explore',{op,...values,requestId:crypto.randomUUID()});
const install=(session,options,expectedState,requestId=crypto.randomUUID())=>post(session,'generate',{options,expectedState,requestId});
function expectStatus(result,status,label){assert.equal(result.status,status,label+': '+JSON.stringify(result.error||''));return result;}
function privateView(view,seeds){assert(!('generationRuns' in view));assert(!('generation' in view));assert(!view.dungeon.generation);assert(!view.exploration?.playerMap.generation);for(const seed of seeds)assert(!JSON.stringify(view).includes(seed),'seed leaked: '+seed);}
const options={version:'v2',style:'castle',variant:1,name:'TAJNÝ_NÁVRH_V2',levels:2,rooms:6,size:'medium',corridors:'winding',connections:2,seed:'private-v2-integration-seed',separateExit:true};
const pj=expectStatus(await post(null,'create',{name:'Generátor V2 PJ'}),200,'create'),player=expectStatus(await post(null,'join',{room:pj.room,name:'V2 průzkumník'}),200,'join');
const original=await get(pj),stamp=original.generation.stamp;
expectStatus(await install(player,options,stamp),403,'player may not generate');
expectStatus(await install(pj,options,'stale-stamp'),409,'stale stamp');
for(const invalid of [{version:'v9'},{style:'unknown'},{variant:-1},{variant:3},{version:'v1',style:'mine',variant:0},{levels:9},{rooms:13}])expectStatus(await install(pj,{...options,...invalid},stamp),400,'invalid options');
assert.equal((await get(pj)).generation.stamp,stamp);
const requestId=crypto.randomUUID(),race=await Promise.all([install(pj,options,stamp,requestId),install(pj,options,stamp,requestId)]);
race.forEach(r=>expectStatus(r,200,'same-request race'));assert.deepEqual(race[0].generatedLevels,race[1].generatedLevels);
const ids=race[0].generatedLevels,preview=generateDungeon(options);assert.equal(ids.length,2);assert.equal(ids[0],'ground');
let state=await get(pj);assert.equal(state.generationRuns.length,1);assert.equal(state.generationRuns[0].id,requestId);assert.deepEqual(state.generationRuns[0].levelIds,ids);assert.deepEqual(state.generationRuns[0].options,preview.options);assert(!('generationOperations' in state));
for(let i=0;i<ids.length;i++){
 const view=await get(pj,ids[i]);assert.deepEqual(view.dungeon,preview.floors[i].map,'preview/server geometry and metadata parity');assert.equal(view.dungeon.generation.status,'valid');assert.equal(view.dungeon.generation.levelIndex,i);
 assert.deepEqual(view.dungeon.generation.rooms.map(r=>r.id),preview.floors[i].map.generation.rooms.map(r=>r.id));
}
const unseen=await get(player,ids[1]);privateView(unseen,[options.seed]);assert.deepEqual(unseen.dungeon.floors,[]);assert.deepEqual(unseen.exploration.levels,[]);assert(!JSON.stringify(unseen).includes(options.name));
// Structural edits mark the saved logical graph stale; undo returns the exact valid snapshot.
expectStatus(await command(pj,'room',{levelId:ids[1],from:[0,0],to:[0,0]}),200,'structural room edit');
const edited=await get(pj,ids[1]);assert.equal(edited.dungeon.generation.status,'modified');assert.deepEqual(edited.dungeon.generation.rooms.map(r=>r.id),preview.floors[1].map.generation.rooms.map(r=>r.id));assert(edited.dungeon.floors.includes('0,0'));
const modifiedBackup=await backup(pj),modifiedRestore=expectStatus(await post(null,'restore',{backup:modifiedBackup}),200,'modified metadata backup remains importable');
assert.equal((await get(modifiedRestore,ids[1])).dungeon.generation.status,'modified');
expectStatus(await command(pj,'undo',{levelId:ids[1]}),200,'undo structural edit');assert.deepEqual((await get(pj,ids[1])).dungeon,preview.floors[1].map);
// Revealing geometry must never publish the private graph, provenance or seed.
expectStatus(await command(pj,'reveal',{levelId:ids[0],from:[0,0],to:[27,19]}),200,'reveal');
state=await get(pj,ids[0]);assert.equal(state.dungeon.generation.status,'valid');const revealed=await get(player);assert(revealed.dungeon.floors.length>0);privateView(revealed,[options.seed]);
// A real closed boundary door blocks movement even after both floor cells were discovered.
const door=Object.entries(state.dungeon.edges).find(([,type])=>type==='door')?.[0];assert(door,'castle must expose a playable boundary door');
const [axis,sx,sy]=door.split(':'),x=+sx,y=+sy,doorCells=axis==='h'?[[x,y-1],[x,y]]:[[x-1,y],[x,y]];
assert(doorCells.every(p=>state.dungeon.floors.includes(p.join())));
expectStatus(await explore(pj,'settings',{leaderId:player.game.me,radius:3}),200,'leader settings');
expectStatus(await explore(pj,'place',{levelId:ids[0],x:doorCells[0][0],y:doorCells[0][1]}),200,'place at closed door');
expectStatus(await explore(player,'move',{levelId:ids[0],x:doorCells[1][0],y:doorCells[1][1]}),400,'closed door blocks route');
expectStatus(await explore(player,'door',{levelId:ids[0],edge:door}),200,'leader opens adjacent door');
assert.equal((await get(pj,ids[0])).dungeon.generation.status,'valid');
expectStatus(await explore(player,'move',{levelId:ids[0],x:doorCells[1][0],y:doorCells[1][1]}),200,'opened door allows movement');
expectStatus(await explore(player,'door',{levelId:ids[0],edge:door}),200,'leader closes door');assert.equal((await get(pj,ids[0])).dungeon.generation.status,'valid');
expectStatus(await command(pj,'hide',{levelId:ids[1],from:[0,0],to:[27,19]}),200,'hide without structural invalidation');assert.equal((await get(pj,ids[1])).dungeon.generation.status,'valid');
// Existing map, party and provenance survive appending both remaining style strategies.
const allSeeds=[options.seed];
for(const style of ['mine','cave']){
 const before=await get(pj,ids[0]),nextOptions={...options,style,levels:1,variant:2,name:'TAJNÉ_NOVÉ_PATRO_'+style,seed:'private-v2-'+style+'-append'};
 const appended=expectStatus(await install(pj,nextOptions,before.generation.stamp),200,'append '+style),id=appended.generatedLevels[0];assert(!ids.includes(id));
 const after=await get(pj,ids[0]);assert.deepEqual(after.dungeon,before.dungeon);assert.deepEqual(after.exploration.location,before.exploration.location);assert.equal(after.generationRuns.length,before.generationRuns.length+1);
 assert.deepEqual((await get(pj,id)).dungeon,generateDungeon(nextOptions).floors[0].map);
 allSeeds.push(nextOptions.seed);const hidden=await get(player,id);privateView(hidden,allSeeds);assert.equal(hidden.exploration.levelId,ids[0]);assert(!hidden.exploration.levels.some(l=>l.id===id));assert(!JSON.stringify(hidden).includes(nextOptions.name));
 expectStatus(await install(pj,nextOptions,before.generation.stamp),409,'old append stamp cannot be reused');
}
const complete=await backup(pj),restored=expectStatus(await post(null,'restore',{backup:complete}),200,'full V2 restore');
assert.deepEqual((await get(restored)).generationRuns,(await get(pj)).generationRuns);
const restoredReplay=expectStatus(await install(restored,options,stamp,requestId),200,'restored request replay');assert.deepEqual(restoredReplay.generatedLevels,ids);assert.equal((await get(restored)).generationRuns.length,3);
for(const level of complete.game.atlas.levels)assert.deepEqual((await get(restored,level.id)).dungeon,level.map);
// Corruptions are rejected through the public restore boundary, independently of the UI.
const corruptions=[
 b=>{b.game.atlas.levels[1].map.generation.rooms[0].cells.push('28,0');},
 b=>{b.game.atlas.levels[1].map.generation.rooms[1].id=b.game.atlas.levels[1].map.generation.rooms[0].id;},
 b=>{b.game.atlas.levels[1].map.generation.connections[0].from='missing-room';},
 b=>{b.game.atlas.levels[1].map.generation.connections[0].path[0]=[0,0];},
 b=>{b.game.atlas.levels[1].map.generation.rooms[0].neighbors=[];},
 b=>{b.game.atlas.levels[1].map.generation.options.variant=0;},
 b=>{b.game.atlas.levels[1].map.generation.seed='forged-seed';},
 b=>{b.game.atlas.levels[1].map.generation.status='unknown';},
 b=>{b.game.generationRuns[0].levelIds[0]='missing-floor';},
 b=>{delete b.game.generationRuns;},
 b=>{b.game.generationRuns=[];},
 b=>{b.game.atlas.stairs.splice(0,1);},
 b=>{b.game.atlas.levels[0].memory.generation=structuredClone(b.game.atlas.levels[0].map.generation);},
 b=>{const m=b.game.atlas.levels[1].map.generation;m.status='modified';m.rooms[1].id=m.rooms[0].id;},
];
for(const [i,change] of corruptions.entries()){const invalid=structuredClone(complete);change(invalid);expectStatus(await post(null,'restore',{backup:invalid}),400,'corrupt backup '+i);}
// Future content is private preparation even when its room floor is already visible.
const contentBackup=structuredClone(complete),contentMetadata=contentBackup.game.atlas.levels[0].map.generation;
contentMetadata.rooms[0].content={title:'PRIVATE_FUTURE_TITLE',playerText:'PRIVATE_FUTURE_PLAYER_TEXT',secret:'PRIVATE_FUTURE_SECRET'};
const withContent=expectStatus(await post(null,'restore',{backup:contentBackup}),200,'future content slots survive backup');
const observer=expectStatus(await post(null,'join',{room:withContent.room,name:'Pozorovatel'}),200,'content observer');
const observerView=await get(observer);privateView(observerView,allSeeds);assert(!JSON.stringify(observerView).includes('PRIVATE_FUTURE_'));
// Generated stairs remain actual travel links between valid rooms after restore.
const stair=complete.game.atlas.stairs[0];assert(stair);
expectStatus(await explore(restored,'place',{...stair.a}),200,'place at generated stairs');expectStatus(await explore(restored,'travel',{stairId:stair.id}),200,'generated stair travel');
assert.equal((await get(restored)).exploration.location.levelId,stair.b.levelId);
assert.equal((await get(restored,stair.b.levelId)).dungeon.generation.status,'valid');
// Original generated inter-floor links belong to the valid graph as well.
// Seed a valid undo snapshot with a non-structural discovery edit before removal.
const seenPoint=(await get(restored,stair.a.levelId)).dungeon.revealed[0].split(',').map(Number);
expectStatus(await command(restored,'hide',{levelId:stair.a.levelId,from:seenPoint,to:seenPoint}),200,'prepare valid historical snapshot');
assert.equal((await get(restored,stair.a.levelId)).dungeon.generation.status,'valid');
expectStatus(await explore(restored,'stairs-remove',{stairId:stair.id}),200,'remove generated inter-floor link');
for(const levelId of [stair.a.levelId,stair.b.levelId])assert.equal((await get(restored,levelId)).dungeon.generation.status,'modified','both graph endpoints must become modified');
const disconnectedBackup=await backup(restored),disconnectedRestore=expectStatus(await post(null,'restore',{backup:disconnectedBackup}),200,'manual stair reconnection/removal remains importable');
assert(!disconnectedBackup.game.atlas.stairs.some(s=>s.id===stair.id));
for(const levelId of [stair.a.levelId,stair.b.levelId])assert.equal((await get(disconnectedRestore,levelId)).dungeon.generation.status,'modified');
expectStatus(await command(restored,'undo',{levelId:stair.a.levelId}),200,'undo map snapshot with missing atlas stair');
assert.equal((await get(restored,stair.a.levelId)).dungeon.generation.status,'modified','map undo must not silently validate a missing generated inter-floor link');
const afterUndo=await backup(restored);assert(!afterUndo.game.atlas.stairs.some(s=>s.id===stair.id));
expectStatus(await post(null,'restore',{backup:afterUndo}),200,'stale inter-floor metadata stays explicitly modified after undo');
console.log('PASS: V2 preview/server parity, all styles, private provenance/room content, replay/races, append preserving party/maps, closed/open door movement, metadata invalidation/undo, valid+modified backup restore, corruption rejection, generated stair travel and inter-floor graph invalidation after removal/undo.');
