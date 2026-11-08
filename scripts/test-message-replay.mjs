import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:18098';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
async function post(action,values={},session){const response=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify({action,room:session?.room,...values})});return {status:response.status,...await response.json()};}
const pj=await post('create',{name:'Replay'}),player=await post('join',{name:'Player',room:pj.room});
const requestId=crypto.randomUUID();const send=()=>post('chat',{text:'Pouze jednou',requestId},pj);
let results=await Promise.all([send(),send(),send(),send()]);assert(results.every(r=>r.status===200));
const last=await send();const matches=last.game.messages.filter(m=>m.text==='Pouze jednou');
if(process.env.STUL_REPRO_BASELINE==='1'){assert.equal(matches.length,5);console.log('REPRODUCED: five identical requests create five chat messages.');process.exit(0);}
assert.equal(matches.length,1);
assert.equal((await post('chat',{text:'  Pouze jednou  ',requestId},pj)).game.messages.filter(m=>m.text==='Pouze jednou').length,1);
assert.equal((await post('chat',{text:'Invalid ID',requestId:'constructor'},pj)).status,400);
assert.equal((await post('chat',{text:'Jiná akce',requestId},pj)).status,409);
assert.equal((await post('chat',{text:'Pouze jednou',requestId},player)).status,200);
const rollId=crypto.randomUUID();results=await Promise.all(Array.from({length:6},()=>post('roll',{text:'20k100+12',requestId:rollId},pj)));
assert(results.every(r=>r.status===200));const rolls=results.map(r=>r.game.messages.filter(m=>m.roll));assert(rolls.every(r=>r.length===1));assert.equal(new Set(rolls.map(r=>r[0].text)).size,1);
const independent=await Promise.all(Array.from({length:4},(_,i)=>post('chat',{text:'Souběh '+i,requestId:crypto.randomUUID()},pj)));assert(independent.every(r=>r.status===200));
const legacy=await post('chat',{text:'Starý klient'},pj);assert.equal(legacy.status,200);assert(!('messageOperations' in legacy.game));assert(!('messageOperations' in player.game));
const backup=await (await fetch(base+'/api/game?room='+pj.room+'&download=backup',{headers:{Authorization:'Bearer '+pj.token}})).json();assert.equal((await post('restore',{backup})).status,200);
console.log('PASS: concurrent chat/roll replay, actor-scoped IDs, conflicting reuse, concurrent independent actions, legacy clients and backup restore.');
