import assert from 'node:assert/strict';
await import('./generator-test-import.mjs');
const {sendGameAction,requestGame}=await import('../components/game-table/game-client.ts');
const originalFetch=globalThis.fetch,session={room:'CLIENTTEST',token:'test-token'};
const success=data=>new Response(JSON.stringify({game:{revision:1},...data}),{headers:{'Content-Type':'application/json'}});
try{
 for(const action of ['chat','roll']){
  const bodies=[],release=[];
  globalThis.fetch=async(_,options)=>{const b=JSON.parse(options.body);bodies.push(b);await new Promise(r=>release.push(r));return success({result:b.requestId});};
  const pending=[sendGameAction(session,'ground',action,{text:action==='chat'?'Ahoj':'1k20'}),sendGameAction(session,'ground',action,{text:action==='chat'?'Ahoj':'1k20'})];
  await new Promise(r=>setImmediate(r));release.forEach(r=>r());await Promise.all(pending);
  assert.equal(new Set(bodies.map(b=>b.requestId)).size,2,'independent identical '+action+' operations must own distinct request IDs');
 }
 let calls=0;const bodies=[];
 globalThis.fetch=async(_,options)=>{bodies.push(options.body);if(++calls===1)throw Error('response lost after server commit');return success({result:JSON.parse(options.body).requestId});};
 await sendGameAction(session,'ground','roll',{text:'1k20'});assert.equal(calls,2);assert.equal(bodies[0],bodies[1],'retry must reuse the complete operation');
 calls=0;globalThis.fetch=async()=>{calls++;return new Response('{"error":"invalid"}',{status:400});};
 await assert.rejects(()=>sendGameAction(session,'ground','chat',{text:'bad'}));assert.equal(calls,1);
 calls=0;const explicit=[];globalThis.fetch=async(_,options)=>{explicit.push(JSON.parse(options.body).requestId);return success({});};
 await Promise.all([sendGameAction(session,'ground','roll',{text:'1k20',requestId:'retained-id'}),sendGameAction(session,'ground','roll',{text:'1k20',requestId:'retained-id'})]);assert.deepEqual(explicit,['retained-id','retained-id']);
 globalThis.fetch=async(_,options)=>{assert.equal(options.headers['If-None-Match'],'"known"');return new Response(null,{status:304,headers:{ETag:'"known"'}});};
 const cached=await requestGame(session,'ground','"known"');assert.equal(cached.data,undefined);assert.equal(cached.response.status,304);
 console.log('PASS: independent identical chat/dice operations, stable lost-response retry, explicit replay ID, no retry on validation error and 304 parsing.');
}finally{globalThis.fetch=originalFetch;}
