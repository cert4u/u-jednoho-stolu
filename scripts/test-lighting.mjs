import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5173';
async function post(s,action,data={}){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.token}:{})},body:JSON.stringify({action,room:s?.room,requestId:crypto.randomUUID(),...data})});return {status:r.status,...await r.json()};}
async function ok(s,action,data){const r=await post(s,action,data);assert.equal(r.status,200,r.error);return r;}
async function get(s){return(await fetch(base+'/api/game?room='+s.room,{headers:{Authorization:'Bearer '+s.token}})).json();}
const pj=await post(null,'create',{name:'PJ světla'}),a=await post(null,'join',{room:pj.room,name:'Nosič'}),b=await post(null,'join',{room:pj.room,name:'Průzkumník'});
const ex=(s,op,data={})=>post(s,'explore',{op,...data}),journey=(op,data={})=>post(pj,'journey',{op,...data});
await ok(pj,'map',{tool:'room',from:[1,1],to:[18,9]});await ok(pj,'map',{tool:'wall',points:[[10,1],[10,10]]});await ok(pj,'map',{tool:'door',edges:['v:10:5']});await ex(pj,'enable');await ex(pj,'settings',{leaderId:a.game.me,radius:12});await ex(pj,'place',{levelId:'ground',x:5,y:5});
const monster=await ok(pj,'monster',{op:'create',name:'Stín',maxHp:8});await ok(pj,'monster',{op:'move',monsterId:monster.game.monsters[0].id,x:8,y:5});assert.equal((await get(a)).monsters.length,1);
assert.equal((await ex(a,'lighting',{enabled:true,darkRadius:0,expected:{enabled:false,darkRadius:1}})).status,403);
await ok(pj,'journey',{op:'add',name:'Pochodeň nosiče',remaining:5,lit:true,radius:4,carrierId:a.game.me});let g=await get(pj),torch=g.journey.lights[0];assert.equal((await ex(pj,'lighting',{enabled:true,darkRadius:0,expected:{enabled:false,darkRadius:1}})).status,200);g=await get(a);assert(g.exploration.visible.includes('8,5'));assert(!g.exploration.visible.includes('11,5'));assert.equal(g.exploration.lighting.activeLights,1);
let r=await journey('advance',{minutes:5,expectedJourneyRevision:g.journey.revision});assert.equal(r.status,200);g=await get(a);assert.deepEqual(g.exploration.visible,['5,5']);assert.equal(g.monsters.length,0);assert(g.dungeon.floors.includes('8,5'));assert.equal(g.exploration.lighting.activeLights,0);
r=await journey('undo',{expectedJourneyRevision:g.journey.revision});assert.equal(r.status,200);g=await get(a);assert(g.exploration.visible.includes('8,5'));assert.equal(g.monsters.length,1);
async function updateLight(values){const light=(await get(pj)).journey.lights.find(l=>l.id===torch.id);return journey('update',{lightId:light.id,expectedLightRevision:light.revision,name:light.name,remaining:light.remaining,lit:light.lit,...values});}
assert.equal((await updateLight({radius:2})).status,200);g=await get(a);assert(!g.exploration.visible.includes('8,5'));assert.equal((await journey('add',{name:'Druhá pochodeň',remaining:null,lit:true,radius:2,carrierId:a.game.me})).status,200);assert(!(await get(a)).exploration.visible.includes('8,5')); // radii do not add up
assert.equal((await ex(pj,'battle-start')).status,200);g=await get(pj);const battleId=g.exploration.battle.id;assert.equal((await ex(b,'battle-move',{battleId,memberId:b.game.me,x:8,y:5,expected:{x:5,y:5}})).status,200);g=await get(a);assert(g.exploration.visible.includes('8,5'));assert(!g.exploration.visible.includes('9,5')); // unlit hero does not carry another hero's light
assert.equal((await ex(a,'battle-move',{battleId,memberId:a.game.me,x:7,y:5,expected:{x:5,y:5}})).status,200);assert((await get(a)).exploration.visible.includes('9,5'));
assert.equal((await updateLight({radius:6})).status,200);assert(!(await get(a)).exploration.visible.includes('11,5'));assert.equal((await ex(pj,'door',{levelId:'ground',edge:'v:10:5'})).status,200);assert((await get(a)).exploration.visible.includes('11,5'));
await ok(pj,'map',{tool:'door-settings',levelId:'ground',edge:'v:10:5',locked:false,secret:true,discovered:false,expected:{locked:false,secret:false,discovered:true}});assert(!(await get(a)).exploration.visible.includes('11,5'));
assert.equal((await ex(pj,'lighting',{enabled:false,darkRadius:0,expected:{enabled:false,darkRadius:1}})).status,400); // stale editor
assert.equal((await ex(pj,'lighting',{enabled:false,darkRadius:0,expected:{enabled:true,darkRadius:0}})).status,200);assert((await get(a)).exploration.visible.includes('9,8')); // manual override
assert.equal((await ex(pj,'lighting',{enabled:true,darkRadius:0,expected:{enabled:false,darkRadius:0}})).status,200);
const backup=await(await fetch(base+'/api/game?room='+pj.room+'&download=backup',{headers:{Authorization:'Bearer '+pj.token}})).json();const restored=await post(null,'restore',{backup});assert.equal(restored.status,200);assert.deepEqual(restored.game.exploration.lighting,(await get(pj)).exploration.lighting);assert.equal(restored.game.journey.lights[0].radius,6);assert.equal(restored.game.journey.lights[0].carrierId,a.game.me);
for(const mutate of [x=>x.game.journey.lights[0].radius=0,x=>x.game.journey.lights[0].carrierId='missing',x=>x.game.atlas.lighting.darkRadius=13]){const invalid=structuredClone(backup);mutate(invalid);assert.equal((await post(null,'restore',{backup:invalid})).status,400);}
for(const radius of [0,13,1.5,'4'])assert.equal((await updateLight({radius})).status,400);assert.equal((await updateLight({carrierId:'missing'})).status,400);
// Ordinary group movement must remember only what is visible at each step,
// including intermediate cells that are no longer visible at the destination.
for(const mode of ['expired','dark-radius','carried-light','manual']){
 const owner=await ok(null,'create',{name:'PJ cesta '+mode});
 const walker=await ok(null,'join',{room:owner.room,name:'Vedoucí'});
 await ok(owner,'map',{tool:'room',from:[1,1],to:[20,9]});
 await ok(owner,'map',{tool:'stairsUp',points:[[8,2]]});
 await ok(owner,'explore',{op:'enable'});
 await ok(owner,'explore',{op:'settings',leaderId:walker.game.me,radius:mode==='manual'?2:12});
 await ok(owner,'explore',{op:'lighting',enabled:mode!=='manual',darkRadius:mode==='dark-radius'?1:0,expected:{enabled:false,darkRadius:1}});
 if(mode==='expired'||mode==='carried-light')await ok(owner,'journey',{op:'add',name:'Pochodeň na cestu',remaining:3,lit:true,radius:mode==='expired'?1:2,carrierId:walker.game.me});
 // Only a narrow, previously known path is revealed by the PJ.
 await ok(owner,'map',{tool:'reveal',from:[2,5],to:[16,5]});
 await ok(owner,'explore',{op:'place',levelId:'ground',x:2,y:5});
 if(mode==='expired')await ok(owner,'journey',{op:'advance',minutes:3,expectedJourneyRevision:(await get(owner)).journey.revision});
 const exportGame=async()=> (await(await fetch(base+'/api/game?room='+owner.room+'&download=backup',{headers:{Authorization:'Bearer '+owner.token}})).json()).game;
 const before=(await exportGame()).atlas.levels[0].memory;
 assert(!before.revealed.includes('8,2'));
 const moved=await ok(walker,'explore',{op:'move',levelId:'ground',x:16,y:5});
 assert.deepEqual(moved.game.exploration.location,{levelId:'ground',x:16,y:5});
 const after=await exportGame(),level=after.atlas.levels[0];
 const radius=mode==='expired'?0:mode==='dark-radius'?1:2;
 const expected=new Set(before.revealed);
 for(let x=2;x<=16;x++)for(const key of level.map.floors){const [cx,cy]=key.split(',').map(Number);if(Math.hypot(cx-x,cy-5)<=radius)expected.add(key);}
 assert.deepEqual(new Set(level.memory.revealed),expected,mode+': remembered path must respect effective sight');
 assert.deepEqual(new Set(moved.game.dungeon.floors),new Set(level.memory.floors));
 assert(!level.memory.revealed.includes('8,2'),mode+': no distant terrain disclosure');
 assert(!moved.game.dungeon.stairMarks?.['8,2'],mode+': no hidden stair disclosure');
 if(mode==='expired'){
  assert.deepEqual(level.memory,before,'movement after expiry must not update unseen terrain or edges');
  assert.deepEqual(moved.game.exploration.visible,['16,5']);
 }else{
  const intermediate=mode==='dark-radius'?'8,4':'8,3';
  assert(level.memory.revealed.includes(intermediate),mode+': remember visible intermediate cells');
  assert(!moved.game.exploration.visible.includes(intermediate),mode+': intermediate cell is now only memory');
 }
}
console.log('PASS: group movement after torch expiry, nonzero dark sight, carried light and manual sight preserve only legitimately seen intermediate terrain.');
console.log('PASS: automatic light expiry/undo, remembered terrain, monster visibility, radius/cap settings, non-additive light, carrier positions in battle, walls/secret doors, manual override, permissions and backup validation.');
