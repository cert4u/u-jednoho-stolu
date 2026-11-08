import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
await import('./generator-test-import.mjs');
const {demoFiles}=await import('./catalog-demo.mjs');
const {writeZip}=await import('../server/catalog-zip.mjs');
const {unpackCatalog}=await import('../server/catalog-pack.mjs');
const core=await import('../lib/catalogs/core.ts');
const {initialGame}=await import('../lib/game.ts');
const {startAdventure}=await import('../lib/start-adventure.ts');
const {makeBackup}=await import('../lib/backup.ts');
const dir=mkdtempSync(path.join(os.tmpdir(),'stul-stabilization-'));
const origin=process.argv[2]||'http://127.0.0.1:18097';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname));
const clientCount=Number(process.env.STUL_POLL_CLIENTS||8);assert([4,8].includes(clientCount));
let server;
const post=(action,data={},session)=>fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify({action,room:session?.room,...data})});
async function ok(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
const get=(s,query='')=>fetch(origin+'/api/game?room='+s.room+query,{headers:{Authorization:'Bearer '+s.token}});
try{
 if(!process.argv[2]){
  server=spawn(process.execPath,['server/start.mjs'],{env:{...process.env,PORT:'18097',PUBLIC_ORIGIN:origin,STUL_DATA_DIR:dir,STUL_ADMIN_PASSWORD:'isolated-test-admin-password',STUL_UPDATER_TOKEN:'isolated-test-updater-token-32-characters'},cwd:process.env.STUL_SERVER_ROOT||process.cwd(),stdio:['ignore','pipe','pipe']});
  let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/healthz')).ok)break;}catch{}await delay(100);}
 }
 const {bundle,images,digest}=await unpackCatalog(writeZip(await demoFiles()),core);
 const resolver=new core.CatalogResolver([{bundle,digest,kind:'community',enabled:true,revision:1}]);
 const game=initialGame('Audit',crypto.randomUUID());
 game.contentLibrary=await core.pinContent(undefined,resolver,'adventures',bundle.manifest.id+':third-bell',{read:async k=>images.get(k),builtin:async()=>{throw Error('unexpected builtin');}});
 startAdventure(game,game.members[0],bundle.manifest.id+':third-bell',new core.CatalogResolver([],game.contentLibrary));
 let session=await ok(await post('restore',{backup:makeBackup(game)}));
 const canonical=await ok(await get(session,'&download=backup'));
 const typicalPj=await ok(await post('create',{name:'Typical'}));const typicalPlayer=await ok(await post('join',{room:typicalPj.room,name:'Player'}));
 const typicalBytes={pj:Buffer.byteLength(await (await get(typicalPj)).text()),player:Buffer.byteLength(await (await get(typicalPlayer)).text())};
 session=await ok(await post('restore',{backup:canonical}));
 for(let i=3;i<20;i++)await ok(await post('monster',{op:'create',templateId:'kobold',levelId:canonical.game.atlas.levels[0].id,requestId:crypto.randomUUID()},session));
 const players=[];for(let i=0;i<clientCount-1;i++)players.push(await ok(await post('join',{room:session.room,name:'Hráč '+i})));
 const clients=[session,...players], metrics={mode:process.env.STUL_REAL_POLL==='1'?'150 polls at 2-second intervals':'150 accelerated polls; 5-minute transfer equivalent',typicalBytes,clients:clientCount,samples:150,bodies:[],statuses:{},elapsedMs:0};
 const etags=new Map();let bytes=0;const started=performance.now();
 for(let sample=0;sample<150;sample++){
  await Promise.all(clients.map(async(s,index)=>{
   const response=await fetch(origin+'/api/game?room='+s.room,{headers:{Authorization:'Bearer '+s.token,...(etags.has(index)?{'If-None-Match':etags.get(index)}:{})}});
   const body=await response.text();assert([200,304].includes(response.status));
   metrics.statuses[response.status]=(metrics.statuses[response.status]||0)+1;bytes+=Buffer.byteLength(body);
   if(sample===0)metrics.bodies[index]={role:index===0?'pj':'player',bytes:Buffer.byteLength(body)};
   if(response.headers.get('etag'))etags.set(index,response.headers.get('etag'));
  }));
  if(process.env.STUL_REAL_POLL==='1'&&sample<149)await delay(Math.max(0,started+(sample+1)*2000-performance.now()));
 }
 const invalid=await fetch(origin+'/api/game?room='+session.room,{headers:{Authorization:'Bearer wrong','If-None-Match':etags.get(0)||'none'}});assert.equal(invalid.status,401);
 await ok(await post('chat',{text:'Changed state',requestId:crypto.randomUUID()},session));
 assert.equal((await fetch(origin+'/api/game?room='+session.room,{headers:{Authorization:'Bearer '+session.token,'If-None-Match':etags.get(0)||'none'}})).status,200);
 metrics.elapsedMs=performance.now()-started;metrics.totalBodyBytes=bytes;
 writeFileSync(process.env.STUL_METRICS_FILE||'/tmp/stul-poll-after.json',JSON.stringify(metrics,null,2)+'\n');
 console.log(JSON.stringify(metrics));

}finally{if(server?.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}rmSync(dir,{recursive:true,force:true});}
