// Run as root on an isolated Docker CI runner: this test replaces real containers.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,chmodSync,chownSync,statSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {UpdateManager} from '../deploy/updater/manager.mjs';
import {docker} from '../deploy/updater/docker.mjs';
const dir=mkdtempSync(path.join(os.tmpdir(),'stul-docker-')),dataDir=path.join(dir,'data'),stateDir=path.join(dir,'state');
const {mkdirSync}=await import('node:fs');mkdirSync(dataDir);chmodSync(dataDir,0o777);
const oldSha='a'.repeat(40),newSha='b'.repeat(40),badSha='c'.repeat(40),origin='http://127.0.0.1:18089',password='test-admin-password-long-enough',token='test-updater-token-long-enough-123456';
function cli(args,input){const result=spawnSync('docker',args,{encoding:'utf8',...(input?{input}:{}),stdio:input?['pipe','inherit','inherit']:'inherit'});assert.equal(result.status,0,`docker ${args[0]} failed`);}
async function call(endpoint,data){const r=await fetch(origin+endpoint,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(18000)});if(!r.ok)throw new Error('App '+r.status);return r.json();}
let manager;
try{
 cli(['build','-t','stul-app:local','--build-arg',`STUL_REVISION=${oldSha}`,'.']);
 cli(['build','-t',`stul-app:${newSha}`,'--build-arg',`STUL_REVISION=${newSha}`,'.']);
 cli(['build','-t',`stul-app:${badSha}`,'-'],`FROM stul-app:${newSha}\nCMD ["node", "-e", "process.exit(1)"]\n`);
 cli(['build','-f','deploy/updater/Dockerfile','-t','stul-updater:test','.']);
 // Exercise the updater image and its native Docker CLI (not just manager mocks).
 cli(['run','--rm','-v','/var/run/docker.sock:/var/run/docker.sock','--entrypoint','sh','stul-updater:test','-c','node --version && docker version --format "{{.Server.Version}}"']);
 cli(['network','create','stul-smoke']);
 cli(['run','-d','--network','stul-smoke','--network-alias','app','--name','stul-app','--restart','unless-stopped','--init','-p','127.0.0.1:18089:8080','-v',`${dataDir}:/data`,'-e','STUL_UPDATER_URL=http://updater:8090','-e',`PUBLIC_ORIGIN=${origin}`,'-e',`STUL_ADMIN_PASSWORD=${password}`,'-e',`STUL_UPDATER_TOKEN=${token}`,'stul-app:local']);
 let target=newSha;manager=new UpdateManager({dataDir,stateDir,appFetch:call,release:async()=>({tag:'v0.2.0',sha:target,url:'https://github.com/cert4u/u-jednoho-stolu/releases/tag/v0.2.0'}),build:async sha=>'stul-app:'+sha});
 chownSync(stateDir,1001,1001); // runtime.env must remain readable to the host operator.
 await manager.healthy(oldSha);
 cli(['run','-d','--network','stul-smoke','--network-alias','updater','--name','stul-updater-smoke','-v','/var/run/docker.sock:/var/run/docker.sock','-v',`${dataDir}:/data`,'-v',`${stateDir}:/state`,'-e',`STUL_UPDATER_TOKEN=${token}`,'stul-updater:test']);
 const login=await fetch(origin+'/admin/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');
 let status;for(let i=0;i<20;i++){status=await fetch(origin+'/admin/api/status',{headers:{Cookie:cookie}});if(status.ok)break;await new Promise(r=>setTimeout(r,500));}assert.equal(status.status,200,await status.text());
 cli(['stop','stul-updater-smoke']); // Only one writer runs real replacement tests below.

 const create=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'Docker PJ',title:'Docker test'})});assert.equal(create.status,200);const game=await create.json();assert.ok(game.room);
 await manager.begin('update','docker-update-12345678');await manager.running;assert.match(manager.state.job.phase,/Hotovo/);assert.equal((await call('/healthz')).revision,newSha);assert.equal(statSync(path.join(stateDir,'runtime.env')).uid,1001);
 const auth={Authorization:`Bearer ${game.token}`};assert.equal((await fetch(`${origin}/api/game?room=${game.room}`,{headers:auth})).status,200);
 await manager.begin('rollback','docker-rollback-12345678');await manager.running;assert.match(manager.state.job.phase,/Hotovo/);assert.equal((await call('/healthz')).revision,oldSha);assert.equal((await fetch(`${origin}/api/game?room=${game.room}`,{headers:auth})).status,200);
 target=badSha;await manager.begin('update','docker-broken-12345678');await manager.running;assert.match(manager.state.job.phase,/původní verze obnovena/);assert.equal((await call('/healthz')).revision,oldSha);assert.equal((await call('/healthz')).maintenance,false);
 assert.equal((await fetch(`${origin}/api/game?room=${game.room}`,{headers:auth})).status,200);assert.match(readFileSync(path.join(stateDir,'runtime.env'),'utf8'),/stul-app:local/);
 console.log('PASS: real Docker build, updater image/daemon, replacement, persistent campaign, SQLite rollback and failed-image recovery.');
}finally{
 spawnSync('docker',['logs','--tail','25','stul-updater-smoke'],{stdio:'inherit'});
 if(manager?.state.job)console.log(manager.state.job.phase,manager.state.job.logs.join('\n'));
 try{spawnSync('docker',['rm','-f','stul-updater-smoke'],{stdio:'inherit'});const containers=spawnSync('docker',['ps','-aq','--filter','name=stul-app'],{encoding:'utf8'}).stdout.trim().split(/\s+/).filter(Boolean);if(containers.length)cli(['rm','-f',...containers]);}finally{spawnSync('docker',['network','rm','stul-smoke'],{stdio:'inherit'});rmSync(dir,{recursive:true,force:true});}
}
