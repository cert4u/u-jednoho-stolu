import assert from 'node:assert/strict';
const base=process.argv[2];assert(base&&['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
async function post(action,values={},session){const response=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify({action,room:session?.room,...values})});assert.equal(response.status,200,await response.clone().text());return response.json();}
const pj=await post('create',{name:'Conditional PJ'}),player=await post('join',{room:pj.room,name:'Player'});
const get=(session,etag)=>fetch(base+'/api/game?room='+session.room,{headers:{Authorization:'Bearer '+session.token,...(etag?{'If-None-Match':etag}:{})}});
const first=await get(pj),etag=first.headers.get('etag');assert(etag);const original=await first.json();
const unchanged=await get(pj,etag);assert.equal(unchanged.status,304);assert.equal(await unchanged.text(),'');assert(unchanged.headers.get('vary')?.split(',').some(field=>field.trim().toLowerCase()==='authorization'));assert.equal(unchanged.headers.get('cache-control'),'no-store');
assert.equal((await get({...pj,token:'wrong'},etag)).status,401);
const publicView=await get(player,etag);assert.equal(publicView.status,200);const publicGame=await publicView.json();assert.equal(publicGame.notes,'');assert(!('messageOperations' in publicGame));assert.notEqual(publicView.headers.get('etag'),etag);
await post('notes',{notes:'Conditional private note',expected:{notes:original.notes}},pj);
const changed=await get(pj,etag);assert.equal(changed.status,200);assert.equal((await changed.json()).notes,'Conditional private note');
assert.equal((await get(pj,changed.headers.get('etag'))).status,304);
const backup=await fetch(base+'/api/game?room='+pj.room+'&download=backup',{headers:{Authorization:'Bearer '+pj.token,'If-None-Match':changed.headers.get('etag')}});assert.equal(backup.status,200);assert.equal((await backup.json()).format,'u-jednoho-stolu');
console.log('PASS: conditional game GET, mutation invalidation, authentication before ETag, role isolation, no-store and unconditional backup export.');
