import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5173';
async function post(s,action,data={}){const r=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.token}:{})},body:JSON.stringify({action,room:s?.room,...data})});return {status:r.status,...await r.json()};}
async function get(s){return (await fetch(base+'/api/game?room='+s.room,{headers:{Authorization:'Bearer '+s.token}})).json();}
const explore=(s,op,data={},requestId=crypto.randomUUID())=>post(s,'explore',{op,...data,requestId});
const draw=(s,tool,data={})=>post(s,'map',{tool,...data,requestId:crypto.randomUUID()});
const pj=await post(null,'create',{name:'Upozornění PJ'}),a=await post(null,'join',{room:pj.room,name:'Vedoucí'});
await draw(pj,'room',{from:[1,1],to:[20,12]});await draw(pj,'reveal',{from:[1,1],to:[20,12]});await explore(pj,'enable');await explore(pj,'settings',{leaderId:a.game.me,radius:4});
const anchor={levelId:'ground',x:7,y:5},fields={title:'TAJNÁ strážnice',text:'',secret:'TAJNÝ klíč',publish:false};
let r=await post(pj,'map-note',{op:'save',...anchor,...fields,expectedRevision:null,requestId:crypto.randomUUID()});assert.equal(r.status,200);let note=r.game.mapNotes[0];assert.equal(note.radius,2);assert.equal(note.notify,true);
async function save(patch){const g=await get(pj);note=g.mapNotes.find(n=>n.id===note.id);const result=await post(pj,'map-note',{op:'save',...anchor,...fields,noteId:note.id,expectedRevision:note.revision,...patch,requestId:crypto.randomUUID()});assert.equal(result.status,200);return result;}
// Prepare content on another anchor in the same room, plus a monster behind a wall.
assert.equal((await draw(pj,'wall',{points:[[12,1],[12,13]]})).status,200);
const extra=await post(pj,'map-note',{op:'save',...anchor,x:8,...fields,title:'Vedlejší poznámka',notify:false,expectedRevision:null,requestId:crypto.randomUUID()});
assert.equal(extra.status,200);
const extraId=extra.game.mapNotes.find(item=>item.x===8).id;
const change=(action,op,data)=>post(pj,action,{op,...data,requestId:crypto.randomUUID()});
const clue=await change('challenge','create',{memberId:a.game.me,title:'Zkouška strážnice',ability:'constitution',difficulty:9,modifier:0,showDifficulty:false,audience:'private',noteId:extraId});
assert.equal(clue.status,200);
const trial=clue.game.challenges[0];
const find=await change('loot','save',{title:'Skrytá truhla',secret:'Tajný obsah',noteId:note.id,items:[{name:'Klíč',quantity:1}],coins:{gold:0,silver:0,copper:0},publish:false,expectedRevision:null});
assert.equal(find.status,200);
const stash=find.game.loot[0];
async function addMonster(name,x){
 const result=await change('monster','create',{name,maxHp:3,hidden:true});
 assert.equal(result.status,200);
 const monster=result.game.monsters.find(item=>item.name===name);
 assert.equal((await change('monster','move',{monsterId:monster.id,x,y:5})).status,200);
 return monster;
}
const guard=await addMonster('Skrytý strážce',9);
await addMonster('Za příčkou',14);
const count=async()=>((await get(pj)).noteAlerts||[]).length;
await explore(pj,'place',{levelId:'ground',x:2,y:5});assert.equal(await count(),0);
const moveId=crypto.randomUUID();assert.equal((await explore(a,'move',{x:5,y:5},moveId)).status,200);assert.equal(await count(),1); // two cells away, never on the note
let g=await get(pj);const event=g.noteAlerts[0];assert.equal(event.noteId,note.id);assert.equal(event.title,fields.title);assert.equal((await get(pj)).noteAlerts[0].id,event.id);
assert.deepEqual(event.encounter,[
 {kind:'challenge',id:trial.id,title:trial.title},
 {kind:'monster',id:guard.id,title:guard.name+' #'+guard.number},
 {kind:'loot',id:stash.id,title:stash.title},
]);
assert.equal((await change('challenge','cancel',{id:trial.id,expectedRevision:trial.revision})).status,200);
assert.equal((await change('loot','remove',{id:stash.id,expectedRevision:stash.revision})).status,200);
assert.equal((await change('monster','damage',{monsterId:guard.id,amount:3})).status,200);
assert.deepEqual((await get(pj)).noteAlerts[0].encounter,[]);
assert(!JSON.stringify(await get(a)).includes(guard.name));
assert(!JSON.stringify(await get(a)).includes(stash.title));
assert.equal((await draw(pj,'erase',{edges:Array.from({length:12},(_,i)=>'v:12:'+(i+1))})).status,200);
await explore(a,'move',{x:5,y:5},moveId);await explore(a,'move',{x:6,y:5});assert.equal(await count(),1);
await explore(a,'move',{x:2,y:5});await explore(a,'move',{x:12,y:5});assert.equal(await count(),2); // passes through proximity and finishes outside it
const player=await get(a);assert.deepEqual(player.noteAlerts,[]);assert(!JSON.stringify(player).includes(fields.title));assert(!JSON.stringify(player).includes(event.id));assert(!JSON.stringify(player.messages).includes(note.id));
await save({radius:1});await explore(pj,'place',{levelId:'ground',x:5,y:5});assert.equal(await count(),2);await explore(a,'move',{x:6,y:5});assert.equal(await count(),3);
await save({notify:false});assert.equal(await count(),0);await explore(pj,'place',{levelId:'ground',x:7,y:5});assert.equal(await count(),0);
await save({notify:true,radius:2});await explore(pj,'place',{levelId:'ground',x:2,y:5});await draw(pj,'wall',{levelId:'ground',points:[[7,1],[7,13]]});await explore(pj,'place',{levelId:'ground',x:6,y:5});assert.equal(await count(),1); // preparation cues may cross a wall; no player reveal
await explore(pj,'level-add',{name:'Sklep'});g=await get(pj);const basement=g.exploration.levels.find(l=>l.name==='Sklep').id;await draw(pj,'room',{levelId:basement,from:[1,1],to:[12,10]});await explore(pj,'place',{levelId:basement,x:7,y:5});assert.equal(await count(),1); // matching coordinates on another floor do not trigger
await explore(pj,'stairs-add',{levelId:basement,x:7,y:5,destinationLevelId:'ground',destinationX:6,destinationY:5});g=await get(pj);const stair=g.exploration.stairs.find(s=>s.x===7&&s.y===5);assert(stair);assert.equal((await explore(a,'travel',{stairId:stair.id})).status,200);assert.equal(await count(),2);
const backup=await (await fetch(base+'/api/game?room='+pj.room+'&download=backup',{headers:{Authorization:'Bearer '+pj.token}})).json();assert(!('mapNoteAlerts' in backup.game));const restored=await post(null,'restore',{backup});assert.equal(restored.status,200);assert.deepEqual(restored.game.noteAlerts,[]);assert.equal(restored.game.mapNotes[0].radius,2);
for(const radius of [0,7,1.5]){const bad=structuredClone(backup);bad.game.mapNotes[0].radius=radius;assert.equal((await post(null,'restore',{backup:bad})).status,400);}
g=await get(pj);note=g.mapNotes[0];assert.equal((await post(pj,'map-note',{op:'remove',...anchor,noteId:note.id,expectedRevision:note.revision,requestId:crypto.randomUUID()})).status,200);assert.equal(await count(),0);
console.log('PASS: nearby PJ cues, default/configurable radius, path crossings, no repeats inside zone or request replay, new visits, disabled cues, walls and floors, stairs, player secrecy, transient backup exclusion and deletion.');
