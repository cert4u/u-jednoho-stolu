// Run as root on an isolated Docker CI runner: this test replaces real containers.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,chmodSync,chownSync,statSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {UpdateManager} from '../deploy/updater/manager.mjs';
import {docker} from '../deploy/updater/docker.mjs';
import {demoFiles} from './catalog-demo.mjs';
import {writeZip} from '../server/catalog-zip.mjs';
const dir=mkdtempSync(path.join(os.tmpdir(),'stul-docker-')),dataDir=path.join(dir,'data'),stateDir=path.join(dir,'state');
const {mkdirSync}=await import('node:fs');mkdirSync(dataDir);chmodSync(dataDir,0o777);
const legacySource=process.argv[2];
const oldSha=legacySource?(process.env.STUL_DOCKER_BASE_REVISION||'65382686749237b930bf0cb918761198e6ad6b2c'):'a'.repeat(40),newSha='b'.repeat(40),badSha='c'.repeat(40),origin='http://127.0.0.1:18089',password='test-admin-password-long-enough',token='test-updater-token-long-enough-123456';
function cli(args,input){const result=spawnSync('docker',args,{encoding:'utf8',...(input?{input}:{}),stdio:input?['pipe','inherit','inherit']:'inherit'});assert.equal(result.status,0,`docker ${args[0]} failed`);}
async function call(endpoint,data){const r=await fetch(origin+endpoint,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(18000)});if(!r.ok)throw new Error('App '+r.status);return r.json();}
const baseVersion=process.env.STUL_DOCKER_BASE_VERSION||'0.5.3';
const releaseVersion=process.env.STUL_DOCKER_TARGET_VERSION||JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
let manager;
try{
 cli(['build','-t','stul-app:local','--build-arg',`STUL_VERSION=${baseVersion}`,'--build-arg',`STUL_REVISION=${oldSha}`,legacySource||'.']);
 cli(['build','-t',`stul-app:${newSha}`,'--build-arg',`STUL_VERSION=${releaseVersion}`,'--build-arg',`STUL_REVISION=${newSha}`,'.']);
 cli(['build','-t',`stul-app:${badSha}`,'-'],`FROM stul-app:${newSha}\nCMD ["node", "-e", "process.exit(1)"]\n`);
 cli(['build','-f','deploy/updater/Dockerfile','-t','stul-updater:test','.']);
 // Exercise the updater image and its native Docker CLI (not just manager mocks).
 cli(['run','--rm','-v','/var/run/docker.sock:/var/run/docker.sock','--entrypoint','sh','stul-updater:test','-c','node --version && docker version --format "{{.Server.Version}}"']);
 cli(['network','create','stul-smoke']);
 cli(['run','-d','--network','stul-smoke','--network-alias','app','--name','stul-app','--restart','unless-stopped','--init','-p','127.0.0.1:18089:8080','-v',`${dataDir}:/data`,'-e','STUL_ROOM_CREATE_RATE=25','-e','STUL_ROOM_LIMIT=50','-e','STUL_ROOM_BYTES_LIMIT=128000000','-e','STUL_UPDATER_URL=http://updater:8090','-e',`PUBLIC_ORIGIN=${origin}`,'-e',`STUL_ADMIN_PASSWORD=${password}`,'-e',`STUL_UPDATER_TOKEN=${token}`,'stul-app:local']);
 let target=newSha;manager=new UpdateManager({dataDir,stateDir,hostingConfig:1,appFetch:call,release:async()=>({tag:`v${releaseVersion}`,sha:target,url:`https://github.com/cert4u/u-jednoho-stolu/releases/tag/v${releaseVersion}`}),build:async sha=>'stul-app:'+sha});
 chownSync(stateDir,1001,1001); // runtime.env must remain readable to the host operator.
 await manager.healthy(oldSha);
 cli(['run','-d','--network','stul-smoke','--network-alias','updater','--name','stul-updater-smoke','-v','/var/run/docker.sock:/var/run/docker.sock','-v',`${dataDir}:/data`,'-v',`${stateDir}:/state`,'-e',`STUL_UPDATER_TOKEN=${token}`,'-e','STUL_HOSTING_CONFIG=1','stul-updater:test']);
 const login=await fetch(origin+'/admin/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');
 let status;for(let i=0;i<20;i++){status=await fetch(origin+'/admin/api/status',{headers:{Cookie:cookie}});if(status.ok)break;await new Promise(r=>setTimeout(r,500));}assert.equal(status.status,200,await status.text());
 cli(['stop','stul-updater-smoke']); // Only one writer runs real replacement tests below.
 // docker stop blocks this harness for ~10s: drain socket-close events before reusing fetch.
 await new Promise(resolve=>setTimeout(resolve,100));

 const create=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Docker PJ',title:'Docker test'})});assert.equal(create.status,200);const game=await create.json();assert.ok(game.room);
 const actors=[game];
 for(const name of ['Docker Borin','Docker Ela']){
  const response=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'join',room:game.room,name})});assert.equal(response.status,200);actors.push(await response.json());
 }
 const readRooms=()=>{const db=new DatabaseSync(path.join(dataDir,'game.sqlite'),{readOnly:true});try{return db.prepare('SELECT id,data,version FROM rooms ORDER BY id').all();}finally{db.close();}};
 const beforeUpgrade=readRooms();
 await manager.begin('update','docker-update-12345678',{expectedSha:newSha});await manager.running;assert.match(manager.state.job.phase,/Hotovo/);assert.equal((await call('/healthz')).revision,newSha);assert.equal(statSync(path.join(stateDir,'runtime.env')).uid,1001);
 assert.deepEqual(readRooms(),beforeUpgrade,'Migration preserves every campaign byte, member token and access field.');
 for(const actor of actors)assert.equal((await fetch(`${origin}/api/game?room=${actor.room}`,{headers:{Authorization:'Bearer '+actor.token}})).status,200);
 const activeContainer=await docker('GET','/containers/stul-app/json');assert(activeContainer.Config.Env.includes('STUL_ROOM_LIMIT=50'));
 const auth={Authorization:`Bearer ${game.token}`};assert.equal((await fetch(`${origin}/api/game?room=${game.room}`,{headers:auth})).status,200);
 await manager.begin('rollback','docker-rollback-12345678');await manager.running;assert.match(manager.state.job.phase,/Hotovo/);assert.equal((await call('/healthz')).revision,oldSha);assert.equal((await fetch(`${origin}/api/game?room=${game.room}`,{headers:auth})).status,200);
 assert.deepEqual(readRooms(),beforeUpgrade,'Snapshot rollback restores the original campaign rows.');
 for(const actor of actors)assert.equal((await fetch(`${origin}/api/game?room=${actor.room}`,{headers:{Authorization:'Bearer '+actor.token}})).status,200);
 target=badSha;await manager.begin('update','docker-broken-12345678',{expectedSha:badSha});await manager.running;assert.match(manager.state.job.phase,/původní verze obnovena/);assert.equal((await call('/healthz')).revision,oldSha);assert.equal((await call('/healthz')).maintenance,false);
 assert.equal((await fetch(`${origin}/api/game?room=${game.room}`,{headers:auth})).status,200);assert.match(readFileSync(path.join(stateDir,'runtime.env'),'utf8'),/stul-app:local/);
 target=newSha;
 await manager.begin('update','docker-retry-12345678',{expectedSha:newSha});
 await manager.running;
 assert.match(manager.state.job.phase,/Hotovo/);
 assert.equal((await call('/healthz')).revision,newSha);
 const loginAgain=await fetch(origin+'/admin/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});
 assert.equal(loginAgain.status,200);
 const adminHeaders={Cookie:loginAgain.headers.get('set-cookie'),Origin:origin,'Content-Type':'application/json'};
 const catalogPreview=await fetch(origin+'/admin/api/catalogs/preview',{method:'POST',headers:{...adminHeaders,'Content-Type':'application/zip'},body:writeZip(await demoFiles())});assert.equal(catalogPreview.status,200);
 const catalogInstall=await fetch(origin+'/admin/api/catalogs/install',{method:'POST',headers:adminHeaders,body:JSON.stringify({token:(await catalogPreview.json()).token})});assert.equal(catalogInstall.status,200);
 const catalogStoryResponse=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Docker PJ dolu',adventureId:'opusteny-trpaslici-dul:third-bell'})});assert.equal(catalogStoryResponse.status,200);
 const catalogStory=await catalogStoryResponse.json();assert.equal(catalogStory.game.monsters.length,3);assert(catalogStory.game.monsters.every(m=>m.portrait.startsWith('data:image/webp;base64,')));
 const catalogDetails=await (await fetch(origin+'/admin/api/catalogs/view?id=opusteny-trpaslici-dul',{headers:adminHeaders})).json();
 const manualResponse=await fetch(origin+'/admin/api/backups',{method:'POST',headers:adminHeaders,body:'{}'});
 assert.equal(manualResponse.status,201);
 const {name:manual}=await manualResponse.json();
 const laterResponse=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Pozdější PJ'})});
 assert.equal(laterResponse.status,200);
 const later=await laterResponse.json();
 await manager.begin('restore','docker-restore-12345678',{snapshot:manual,confirmSnapshot:manual});
 await manager.running;
 assert.match(manager.state.job.phase,/záloha databáze obnovena/);
 assert.equal((await call('/healthz')).revision,newSha);
 assert.equal((await fetch(`${origin}/api/game?room=${game.room}`,{headers:auth})).status,200);
 assert.equal((await fetch(`${origin}/api/game?room=${later.room}`,{headers:{Authorization:`Bearer ${later.token}`}})).status,404);
 const restoredStoryResponse=await fetch(`${origin}/api/game?room=${catalogStory.room}`,{headers:{Authorization:`Bearer ${catalogStory.token}`}});assert.equal(restoredStoryResponse.status,200);
 assert.deepEqual((await restoredStoryResponse.json()).monsters,catalogStory.game.monsters,'Catalog campaign and portraits survive real container replacement and snapshot restore.');
 for(const asset of catalogDetails.bundle.assets)assert.equal((await fetch(`${origin}/catalog-assets/${asset.digest}.webp`)).status,200,'Persistent catalog file survives container replacement.');
 console.log('PASS: real Docker build, updater image/daemon, replacement, persistent campaign, SQLite rollback, failed-image recovery and manual snapshot restore.');
 console.log('PASS: standalone catalog installation, five-phase adventure and persistent artwork after real Docker snapshot restore.');
}finally{
 spawnSync('docker',['logs','--tail','25','stul-updater-smoke'],{stdio:'inherit'});
 if(manager?.state.job)console.log(manager.state.job.phase,manager.state.job.logs.join('\n'));
 try{spawnSync('docker',['rm','-f','stul-updater-smoke'],{stdio:'inherit'});const containers=spawnSync('docker',['ps','-aq','--filter','name=stul-app'],{encoding:'utf8'}).stdout.trim().split(/\s+/).filter(Boolean);if(containers.length)cli(['rm','-f',...containers]);}finally{spawnSync('docker',['network','rm','stul-smoke'],{stdio:'inherit'});rmSync(dir,{recursive:true,force:true});}
}
