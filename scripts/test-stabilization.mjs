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
const {MAX_D1_ROOM_BYTES}=await import('../lib/room-storage-limit.ts');
const {makeBackup,readBackup}=await import('../lib/backup.ts');
const dir=mkdtempSync(path.join(os.tmpdir(),'stul-stabilization-'));
const origin=process.argv[2]||'http://127.0.0.1:18096';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname));
let server;
const post=(action,data={},session)=>fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify({action,room:session?.room,...data})});
async function ok(response){assert.equal(response.status,200,await response.clone().text());return response.json();}
const get=(s,query='')=>fetch(origin+'/api/game?room='+s.room+query,{headers:{Authorization:'Bearer '+s.token}});
try{
 if(!process.argv[2]){
  server=spawn(process.execPath,['server/start.mjs'],{env:{...process.env,PORT:'18096',PUBLIC_ORIGIN:origin,STUL_DATA_DIR:dir,STUL_ADMIN_PASSWORD:'isolated-test-admin-password',STUL_UPDATER_TOKEN:'isolated-test-updater-token-32-characters'},stdio:['ignore','pipe','pipe']});
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
 const measured={baseRevision:'ef59634',node:process.version,portraitCampaignBytes:Buffer.byteLength(JSON.stringify(session.game))};
 const cloudflare=process.env.STUL_TEST_RUNTIME==='cloudflare';
 const estimate=readBackup(canonical);estimate.members.find(m=>m.role==='pj').recoveryHash='0'.repeat(64);
 const storageOverhead=Buffer.byteLength(JSON.stringify(estimate))-Buffer.byteLength(JSON.stringify(canonical));
 const maximum=cloudflare?MAX_D1_ROOM_BYTES-storageOverhead:3_000_000;
 measured.runtime=cloudflare?'cloudflare':'node';measured.maximumBackupBytes=maximum;
 for(const target of [maximum-1,maximum]){
  const backup=structuredClone(canonical);backup.game.experienceAwards=[];backup.game.notes='';
  while(Buffer.byteLength(JSON.stringify(backup))<target-2000){
   backup.game.experienceAwards.push({id:'award-'+String(backup.game.experienceAwards.length).padStart(6,'0'),by:backup.game.members[0].id,amount:1,recipients:[],reason:'ž'.repeat(300),time:1});
  }
  backup.game.notes='x'.repeat(target-Buffer.byteLength(JSON.stringify(backup)));
  assert.equal(Buffer.byteLength(JSON.stringify(backup)),target);readBackup(backup);
  session=await ok(await post('restore',{backup}));
  const exported=await ok(await get(session,'&download=backup'));
  assert.equal(Buffer.byteLength(JSON.stringify(exported)),target);
  await ok(await post('restore',{backup:exported}));
  assert.deepEqual(exported.game.contentLibrary,backup.game.contentLibrary);
  if(target===maximum){
   const response=await post('notes',{notes:exported.game.notes+'x',expected:{notes:exported.game.notes}},session);
   measured.overLimitMutationStatus=response.status;
   if(process.env.STUL_REPRO_BASELINE==='1'){
    await ok(response);const invalid=await ok(await get(session,'&download=backup'));
    measured.exportedBytes=Buffer.byteLength(JSON.stringify(invalid));
    measured.restoreStatus=(await post('restore',{backup:invalid})).status;
    assert(measured.exportedBytes>3_000_000);assert.equal(measured.restoreStatus,400);
    console.log('REPRODUCED: ordinary mutation permits an exported backup that restore rejects.');
   }else{
    assert.equal(response.status,413,await response.text());
    assert.equal((await ok(await get(session,'&download=backup'))).game.notes,exported.game.notes);
   }
   const tooLarge=structuredClone(exported);tooLarge.game.notes+='x';assert.equal((await post('restore',{backup:tooLarge})).status,cloudflare?413:400);
  }
 }
 assert.equal((await post('create',{name:'x'.repeat(3_100_001)})).status,413);
 writeFileSync(process.env.STUL_METRICS_FILE||'/tmp/stul-stabilization-backup.json',JSON.stringify(measured,null,2)+'\n');
 console.log('PASS: actual API backup round-trips below/at runtime maximum with pinned catalog images; above-limit import and HTTP body rejection.');
}finally{if(server?.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}rmSync(dir,{recursive:true,force:true});}
