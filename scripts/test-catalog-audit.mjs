import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile,mkdir,rename,access} from 'node:fs/promises';
import {tmpdir,cpus} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {demoFiles} from './catalog-demo.mjs';
import {readZip,writeZip} from '../server/catalog-zip.mjs';
const root=await mkdtemp(join(tmpdir(),'stul-catalog-audit-')),original=join(root,'original'),restored=join(root,'restored');
process.env.STUL_DATA_DIR=original;
const store=await import('../server/catalog-store.mjs'),core=await import('../dist/catalog-core.mjs');
const {prepareGithubCatalog}=await import('../server/catalog-github.mjs');
const {openDatabase}=await import('../server/database.mjs');
const origin='http://127.0.0.1:18089',password='audit-admin-password-long-enough',networkLog=join(root,'network.log');
let server,cookie;const results={measuredAt:new Date().toISOString(),node:process.version,cpu:cpus()[0]?.model,samples:12,warmup:3,transport:'serial HTTP localhost, production Node build, decoded response body included',configurations:{}};
async function start(data){
 server=spawn(process.execPath,['--import','./scripts/test-support/catalog-offline.mjs','server/start.mjs'],{env:{...process.env,STUL_DATA_DIR:data,STUL_AUDIT_NETWORK_LOG:networkLog,PORT:'18089',PUBLIC_ORIGIN:origin,STUL_ADMIN_PASSWORD:password,STUL_UPDATER_TOKEN:crypto.randomUUID()},stdio:['ignore','pipe','pipe']});
 let logs='';server.stdout.on('data',s=>logs+=s);server.stderr.on('data',s=>logs+=s);
 for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await delay(100);}throw Error(logs||'Server timeout');
}
async function stop(){if(server?.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}}
async function json(url,options={},expected=200){const response=await fetch(origin+url,options),value=await response.json();assert.equal(response.status,expected,JSON.stringify(value));return value;}
async function admin(action='',data){return json('/admin/api/catalogs'+(action?'/'+action:''),{headers:{Cookie:cookie,Origin:origin,...(data?{'Content-Type':'application/json'}:{})},...(data?{method:'POST',body:JSON.stringify(data)}:{})});}
async function login(){const response=await fetch(origin+'/admin/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(response.status,200);cookie=response.headers.get('set-cookie');}
const post=(session,action,data={},expected=200)=>json('/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify({room:session?.room,requestId:crypto.randomUUID(),action,...data})},expected);
const get=(session,query='')=>json('/api/game?'+new URLSearchParams({room:session.room})+query,{headers:{Authorization:'Bearer '+session.token}});
async function measure(run){
 const samples=[];let responseBytes=0;
 for(let i=-results.warmup;i<results.samples;i++){const begin=performance.now(),value=await run();const elapsed=performance.now()-begin;if(i>=0)samples.push(elapsed);responseBytes=Buffer.byteLength(JSON.stringify(value));}
 const sorted=[...samples].sort((a,b)=>a-b);return {p50Ms:+sorted[Math.floor(sorted.length*.5)].toFixed(3),p95Ms:+sorted[Math.ceil(sorted.length*.95)-1].toFixed(3),samplesMs:samples.map(n=>+n.toFixed(3)),responseBytes};
}
async function benchmark(label,session){
 const populated=await post(null,'create',{name:'Výkon'});
 for(let i=0;i<12;i++)await post(populated,'monster',{op:'create',templateId:'kobold'});
 results.configurations[label]={
  catalogCount:(await admin()).catalogs.length,
  bestiary:await measure(()=>get(session,'&catalog=bestiary')),
  scenery:await measure(()=>get(session,'&catalog=preparation')),
  createCampaign:await measure(()=>post(null,'create',{name:'Měřená družina'})),
  startAdventure:await measure(()=>post(null,'create',{name:'Měřený PJ',adventureId:'ztraceny-zvon'})),
  gameApi:await measure(()=>get(session)),
  gameApi12Monsters:await measure(()=>get(populated)),
 };
}
const remote=(bytes,sha)=>async(url,options)=>{
 assert.equal(options.redirect,'manual');assert(!options.headers.Authorization);
 if(url==='https://api.github.com/repos/demo/dwarf-mine/commits/HEAD')return new Response(JSON.stringify({sha}));
 if(url===`https://codeload.github.com/demo/dwarf-mine/zip/${sha}`)return new Response(bytes);
 throw Error('Unexpected remote URL '+url);
};
try{
 try{await fetch(origin,{signal:AbortSignal.timeout(300)});throw Error('Port 18089 je obsazený.');}catch(e){if(e.message.includes('obsazený'))throw e;}
 await start(original);await login();assert.equal((await admin()).catalogs.length,1);
 const emptySnapshot=await json('/admin/api/backups',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'},201);assert.equal((await fetch(origin+'/admin/api/backup?'+new URLSearchParams({name:emptySnapshot.name,bundle:'1'}),{headers:{Cookie:cookie}})).status,200,'An empty-library snapshot needs no asset sidecar.');
 const portable=spawn(process.execPath,['--experimental-strip-types','scripts/test-catalog-portable.mjs',origin],{stdio:'inherit'});assert.equal(await new Promise((resolve,reject)=>{portable.once('error',reject);portable.once('exit',resolve);}),0,'Portable campaign must work on a clean Node installation.');
 const blank=await post(null,'create',{name:'Audit PJ'});await benchmark('builtin',blank);
 const files=await demoFiles(),bytes=writeZip(files),unpacked=await (await import('../server/catalog-pack.mjs')).unpackCatalog(bytes,core);
 assert.deepEqual(Object.fromEntries(Object.entries(unpacked.bundle.entries).map(([k,v])=>[k,v.length])),{bestiary:3,'dungeon-presets':1,adventures:1,scenery:7});
 assert.equal(unpacked.bundle.manifest.dependencies.length,0);assert.equal(unpacked.bundle.assets.length,3);
 const preview=await prepareGithubCatalog({repository:'https://github.com/demo/dwarf-mine'},remote(bytes,'a'.repeat(40)));
 await store.installPrepared(preview.token);
 assert.equal((await admin('view?id=opusteny-trpaslici-dul')).source.commit,'a'.repeat(40));
 for(const id of ['audit-mine-two','audit-mine-three']){
  const clone=new Map(files),manifest=JSON.parse(clone.get('catalog.json'));manifest.id=id;manifest.name='Auditní kopie '+id;clone.set('catalog.json',Buffer.from(JSON.stringify(manifest)));
  for(let i=0;i<47;i++){const entry={...unpacked.bundle.entries.bestiary[i%3],id:'load-monster-'+i,name:'Zátěžová předloha '+i};clone.set('bestiary/'+entry.id+'.json',Buffer.from(JSON.stringify(entry)));}
  for(let i=0;i<43;i++){const entry={...unpacked.bundle.entries.scenery[i%7],id:'load-scenery-'+i,name:'Zátěžový symbol '+i};clone.set('scenery/'+entry.id+'.json',Buffer.from(JSON.stringify(entry)));}
  const response=await fetch(origin+'/admin/api/catalogs/preview',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/zip'},body:writeZip(clone)});assert.equal(response.status,200);await admin('install',{token:(await response.json()).token});
 }
 await benchmark('threeInstalled',blank);
 if(process.argv[2]){const target=resolve(process.argv[2]);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify({...results,outcome:'integration-pending'},null,2)+'\n');}
 const id='opusteny-trpaslici-dul',adventureId=id+':third-bell';
 results.configurations.threeInstalled.startDemoAdventure=await measure(()=>post(null,'create',{name:'Výkon dolu',adventureId}));
 let story=await post(null,'create',{name:'PJ dolu',adventureId});assert.equal(story.game.monsters.length,3);
 assert.equal(Object.keys(story.game.storyOutline.phases).length,5);
 const levelId=story.game.monsters[0].levelId,points=story.game.dungeon.floors.slice(0,9).map(k=>k.split(',').map(Number));
 for(const [i,entry]of unpacked.bundle.entries.scenery.filter(e=>!e.surface).entries())await post(story,'map',{levelId,tool:'scenery',op:'save',kind:id+':'+entry.id,x:points[i][0],y:points[i][1],size:'small',rotation:0,hidden:false,expectedRevision:null});
 for(const [i,entry]of unpacked.bundle.entries.scenery.filter(e=>e.surface).entries())await post(story,'map',{levelId,tool:'surface',op:'add',kind:id+':'+entry.id,points:[points[i+5]]});
 assert.equal((await get(story)).contentVisuals.length,7);
 const before=await get(story,'&download=backup');assert.equal(before.game.contentLibrary.images&&Object.keys(before.game.contentLibrary.images).length,3);assert.equal(before.game.contentLibrary.entries.filter(e=>e.type==='scenery').length,7);
 const player=await post(null,'join',{room:story.room,name:'Audit hráč'});const playerView=await get(player);assert(!('contentLibrary' in playerView));assert(!JSON.stringify(playerView).includes('Strážce přijme navrácenou jmenovku'));
 // Independent export/import into a second, empty installation, including actual art bytes.
 const exportedResponse=await fetch(origin+'/admin/api/catalogs/export?id='+id,{headers:{Cookie:cookie}});assert.equal(exportedResponse.status,200);const exported=Buffer.from(await exportedResponse.arrayBuffer());
 const roundtrip=await (await import('../server/catalog-pack.mjs')).unpackCatalog(exported,core);assert.equal(roundtrip.digest,unpacked.digest);
 await stop();await start(restored);await login();assert.equal((await admin()).catalogs.length,1);
 const importedResponse=await fetch(origin+'/admin/api/catalogs/preview',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/zip'},body:exported});assert.equal(importedResponse.status,200);await admin('install',{token:(await importedResponse.json()).token});
 const importedStory=await post(null,'create',{name:'Druhý PJ',adventureId});assert.equal(importedStory.game.monsters.length,3);assert(importedStory.game.monsters.every(m=>m.portrait.startsWith('data:image/webp;base64,')));
 await stop();await start(original);await login();
 await admin('create',{manifest:{schemaVersion:1,id:'audit-own',name:'Vlastní varianta',version:'1.0.0',author:'Audit',license:'MIT',minAppVersion:'1.1.0'}});
 let own=await admin('view?id=audit-own');await admin('copy',{sourceId:id,targetId:'audit-own',type:'bestiary',itemId:'slag-sentinel',newId:'own-sentinel',expectedRevision:own.revision});
 own=await admin('view?id=audit-own');await admin('entry',{id:'audit-own',expectedRevision:own.revision,type:'bestiary',originalId:'own-sentinel',entry:{...own.bundle.entries.bestiary[0],name:'Vlastní strážce',maxHp:33}});
 const changed=new Map(files),manifest=JSON.parse(changed.get('catalog.json'));manifest.version='1.1.0';changed.set('catalog.json',Buffer.from(JSON.stringify(manifest)));changed.delete('bestiary/slag-sentinel.json');changed.delete('images/slag-sentinel.webp');
 const tale=JSON.parse(changed.get('adventures/third-bell.json'));tale.rooms.forEach(room=>room.monsters=room.monsters.filter(m=>m!=='slag-sentinel'));changed.set('adventures/third-bell.json',Buffer.from(JSON.stringify(tale)));
 const winch=JSON.parse(changed.get('scenery/broken-winch.json'));winch.path='M4 4L28 28';changed.set('scenery/broken-winch.json',Buffer.from(JSON.stringify(winch)));
 const savedGame=openDatabase().prepare('SELECT data FROM rooms WHERE id=?').get(story.room).data;
 const update=await prepareGithubCatalog({repository:'https://github.com/demo/dwarf-mine',updateId:id},remote(writeZip(changed),'b'.repeat(40)));assert.deepEqual(update.items.removed,['bestiary/slag-sentinel']);assert(update.preservedCampaigns>0);await store.installPrepared(update.token);
 assert.equal(openDatabase().prepare('SELECT data FROM rooms WHERE id=?').get(story.room).data,savedGame);
 assert.equal((await admin('view?id=audit-own')).bundle.entries.bestiary[0].maxHp,33);
 assert.deepEqual((await get(story,'&download=backup')).game.contentLibrary,before.game.contentLibrary);
 // A full server snapshot must not silently become an incomplete export when its sidecar is lost.
 const snapshot=await json('/admin/api/backups',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'},201),sidecar=join(original,'backups',snapshot.name+'.assets.zip');
 await rename(sidecar,sidecar+'.audit-hidden');
 try{assert.equal((await fetch(origin+'/admin/api/backup?'+new URLSearchParams({name:snapshot.name,bundle:'1'}),{headers:{Cookie:cookie}})).status,503,'A full backup with missing catalog assets must be rejected.');}finally{await rename(sidecar+'.audit-hidden',sidecar);}
 const sidecarBytes=await readFile(sidecar),sidecarFiles=readZip(sidecarBytes,{archive:280_000_000,total:256_000_000,file:128_000_000,files:4098});
 const damaged=new Map(sidecarFiles),missing=damaged.keys().next().value;damaged.delete(missing);
 if(damaged.size){await writeFile(sidecar,writeZip(damaged,{archive:280_000_000,total:256_000_000,file:128_000_000,files:4098}));try{assert.equal((await fetch(origin+'/admin/api/backup?'+new URLSearchParams({name:snapshot.name,bundle:'1'}),{headers:{Cookie:cookie}})).status,503);}finally{await writeFile(sidecar,sidecarBytes);}}
 const corrupt=new Map(sidecarFiles),altered=Buffer.from(corrupt.get(missing));altered[altered.length-1]^=1;corrupt.set(missing,altered);await writeFile(sidecar,writeZip(corrupt,{archive:280_000_000,total:256_000_000,file:128_000_000,files:4098}));try{assert.equal((await fetch(origin+'/admin/api/backup?'+new URLSearchParams({name:snapshot.name,bundle:'1'}),{headers:{Cookie:cookie}})).status,503);}finally{await writeFile(sidecar,sidecarBytes);}
 const fullResponse=await fetch(origin+'/admin/api/backup?'+new URLSearchParams({name:snapshot.name,bundle:'1'}),{headers:{Cookie:cookie}});assert.equal(fullResponse.status,200);
 const liveImage=join(original,missing);await rename(liveImage,liveImage+'.audit-hidden');
 try{
  const brokenSnapshot=await fetch(origin+'/admin/api/backups',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(brokenSnapshot.status,503,'Snapshot creation must fail if a required persistent asset is missing.');
  assert.equal((await fetch(origin+'/admin/api/backup?'+new URLSearchParams({name:snapshot.name,bundle:'1'}),{headers:{Cookie:cookie}})).status,200,'An intact older snapshot must not depend on the live asset directory.');
 }finally{await rename(liveImage+'.audit-hidden',liveImage);}
 const full=readZip(Buffer.from(await fullResponse.arrayBuffer()),{archive:280_000_000,total:256_000_000,file:128_000_000,files:4098});assert(full.has('game.sqlite'));assert([...full.keys()].some(k=>k.startsWith('catalog-assets/')));
 let installed=await admin('view?id='+id);await admin('remove',{id,expectedRevision:installed.revision,preserveCampaigns:true});assert.deepEqual((await get(story,'&download=backup')).game.contentLibrary,before.game.contentLibrary);assert.equal((await get(story)).monsters.length,3);assert.equal((await post(story,'monster',{op:'create',templateId:id+':slag-sentinel',levelId})).game.monsters.length,4,'Pinned removed templates remain usable in their campaign.');await post(blank,'monster',{op:'create',templateId:id+':slag-sentinel'},400);
 // Stop the service, extract only known application-generated paths and restore elsewhere.
 await stop();await rm(restored,{recursive:true,force:true});await mkdir(restored,{recursive:true});
 for(const [name,data]of full){assert(name==='game.sqlite'||/^catalog-assets\/[a-f0-9]{64}\.webp$/.test(name));const target=join(restored,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,data);}
 await start(restored);await login();installed=await admin('view?id='+id);assert.equal(installed.bundle.manifest.version,'1.1.0');assert.equal(installed.source.commit,'b'.repeat(40));assert.equal((await admin('view?id=audit-own')).bundle.entries.bestiary[0].maxHp,33);
 const restoredBackup=await get(story,'&download=backup');assert.deepEqual(restoredBackup.game.contentLibrary,before.game.contentLibrary);assert.equal(restoredBackup.game.monsters.length,3);
 for(const asset of installed.bundle.assets){const response=await fetch(origin+'/catalog-assets/'+asset.digest+'.webp');assert.equal(response.status,200);assert.equal((await import('../server/catalog-pack.mjs')).hashBytes(Buffer.from(await response.arrayBuffer())),asset.digest);}
 assert(installed.history.length>0);await admin('rollback',{id,expectedRevision:installed.revision,historyId:installed.history[0].id});
 const returned=await admin('view?id='+id);assert.equal(returned.bundle.manifest.version,'1.0.0');assert.equal(returned.source.commit,'a'.repeat(40));
 for(const asset of returned.bundle.assets)assert.equal((await fetch(origin+'/catalog-assets/'+asset.digest+'.webp')).status,200,'History art must survive full restore and offline rollback.');
 await assert.rejects(access(networkLog),'No non-local network requests should be attempted during offline play and administration.');
 results.outcome='passed';
 results.dataset={installedCatalogs:3,entriesPerInstalledCatalog:[{bestiary:3,presets:1,adventures:1,scenery:7},{bestiary:50,presets:1,adventures:1,scenery:50},{bestiary:50,presets:1,adventures:1,scenery:50}],note:'Original demo plus two synthetic medium-sized independent catalogs. Shared images are deduplicated. Not the maximum supported library. Same built-in adventure and same 12-kobold campaign in both configurations.'};
 if(process.argv[2]){const target=resolve(process.argv[2]);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(results,null,2)+'\n');}
 console.log(JSON.stringify(Object.fromEntries(Object.entries(results.configurations).map(([name,metrics])=>[name,Object.fromEntries(Object.entries(metrics).map(([key,value])=>[key,typeof value==='object'?{p50Ms:value.p50Ms,p95Ms:value.p95Ms,responseBytes:value.responseBytes}:value]))])),null,2));
 console.log('PASS: standalone demo, five story phases, all scenery/materials, explicit immutable GitHub update, removed used entry, own copy, offline server, export/import, removal and real full-server restore in a new data directory.');
}finally{
 await stop();await rm(root,{recursive:true,force:true});
}
