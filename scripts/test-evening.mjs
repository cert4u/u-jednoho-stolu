import assert from 'node:assert/strict';
await import('./generator-test-import.mjs');
const {sendGameAction,requestGame,requestBackup}=await import('../components/game-table/game-client.ts');
const base=process.argv[2];assert(base&&['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const transport=globalThis.fetch;
let loseNextResponse=false,offline=false;
globalThis.fetch=async(input,options)=>{
 if(offline)throw new TypeError('simulated disconnection');
 const response=await transport(new URL(input,base),options);
 if(loseNextResponse&&options?.method==='POST'&&response.ok){loseNextResponse=false;throw new TypeError('response lost after commit');}
 return response;
};
const act=(s,action,data={},level='ground')=>sendGameAction(s,level,action,{requestId:crypto.randomUUID(),...data});
const read=async(s,level='ground',etag)=>requestGame(s,level,etag);
const privateText='TAJNÉ: heslo strážce je měděný havran.';
function privateView(game){const text=JSON.stringify(game);assert(!text.includes(privateText));for(const key of ['contentLibrary','messageOperations','mapHistory','atlas'])assert(!(key in game));assert(game.members.every(m=>!('token' in m)&&!('recoveryHash' in m)));}
try{
 const pj=await act(null,'create',{name:'Večerní PJ'}),a=await act(null,'join',{room:pj.room,name:'Borin'}),b=await act(null,'join',{room:pj.room,name:'Ela'});
 await act(pj,'notes',{notes:privateText,expected:{notes:pj.game.notes}});
 await act(pj,'map',{tool:'room',from:[1,1],to:[12,6]});
 await act(pj,'explore',{op:'enable'});await act(pj,'explore',{op:'settings',leaderId:a.game.me,radius:3});await act(pj,'explore',{op:'place',x:3,y:3});
 await act(a,'explore',{op:'move',x:4,y:3});await act(pj,'map',{tool:'reveal',from:[1,1],to:[5,5]});
 await act(pj,'explore',{op:'level-add',name:'Soukromý sklep'});const levels=(await read(pj)).data.exploration.levels,basement=levels.find(l=>l.name==='Soukromý sklep').id;
 await act(pj,'map',{tool:'room',from:[2,2],to:[5,5]},basement);
 const ground=await read(pj),lower=await read(pj,basement,ground.etag);assert.equal(lower.response.status,200);assert.equal(lower.data.exploration.levelId,basement);
 const playerOther=await read(a,basement);assert.equal(playerOther.data.exploration.levelId,'ground');privateView(playerOther.data);
 // Distinct user operations with identical content stay separate, including ordinary dice.
 await Promise.all([sendGameAction(a,'ground','chat',{text:'Ahoj'}),sendGameAction(a,'ground','chat',{text:'Ahoj'}),sendGameAction(b,'ground','chat',{text:'Ahoj'})]);
 await Promise.all([sendGameAction(a,'ground','roll',{text:'1k20'}),sendGameAction(a,'ground','roll',{text:'1k20'}),sendGameAction(b,'ground','roll',{text:'2k6+1'})]);
 loseNextResponse=true;await sendGameAction(a,'ground','roll',{text:'3k10+2'});
 let game=(await read(pj)).data;assert.equal(game.messages.filter(m=>m.text==='Ahoj').length,3);assert.equal(game.messages.filter(m=>m.roll).length,4);assert.equal(new Set(game.messages.filter(m=>m.roll).map(m=>m.id)).size,4);
 await act(pj,'chat',{text:privateText,to:a.game.me});assert((await read(a)).data.messages.some(m=>m.text===privateText));privateView((await read(b)).data);
 await act(pj,'monster',{op:'create',templateId:'kobold'});game=(await read(pj)).data;const monster=game.monsters[0];if(!monster.portrait.startsWith('data:image/webp;base64,')){assert.equal(monster.portrait,'kobold');const art=await fetch('/monsters/kobold.webp');assert.equal(art.status,200);assert((await art.arrayBuffer()).byteLength>100);}
 await act(pj,'initiative',{op:'roster',expectedRevision:game.initiative.revision,order:[{type:'member',id:a.game.me},{type:'member',id:b.game.me},{type:'monster',id:monster.id}]});game=(await read(pj)).data;
 await act(pj,'initiative',{op:'start',expectedRevision:game.initiative.revision});await act(pj,'explore',{op:'battle-start'});
 await Promise.all([act(a,'chat',{text:'Kryju levou stranu.'}),act(b,'roll',{text:'1k6'})]);
 const before=await read(a);offline=true;await assert.rejects(()=>read(a));offline=false;const reconnected=await read(a,'ground',before.etag);assert.equal(reconnected.response.status,304);
 assert.equal((await read({...a,token:'invalid'},'ground',before.etag)).response.status,401);
 const recovered=await act(null,'recover',{room:a.room,recoveryCode:a.recoveryCode,requestId:crypto.randomUUID()});const renewed={room:a.room,token:recovered.token};assert.equal((await read(a,'ground',before.etag)).response.status,401);assert.equal((await read(renewed)).data.me,a.game.me);
 const backup=await requestBackup(pj),restored=await act(null,'restore',{backup}),after=await requestBackup(restored);
 assert.deepEqual(after.game,backup.game,'all portable story, map, combat, messages, member IDs and catalog art survive restoration');assert.equal(after.game.notes,privateText);
 const restoredPlayer=await act(null,'join',{room:restored.room,name:'Nový svědek'});privateView((await read(restoredPlayer)).data);
 const old=structuredClone(backup);delete old.game.messageOperations;old.game.obsoleteAttribute='historický nepovinný údaj';old.game.members[0].obsoleteAttribute=true;
 const legacy=await act(null,'restore',{backup:old});assert.equal((await requestBackup(legacy)).game.notes,privateText);
 console.log('PASS: automated evening with PJ/two players, maps/floors/visibility, independent duplicate content, lost-response dice retry, private whispers, combat/concurrency, offline/reconnect/session rotation and complete portable story/art restore including legacy optional attributes.');
}finally{globalThis.fetch=transport;}
