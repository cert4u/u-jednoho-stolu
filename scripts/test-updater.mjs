import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {UpdateManager} from '../deploy/updater/manager.mjs';
const oldSha='a'.repeat(40),newSha='b'.repeat(40),snapshot='1234567890123-1234567890abcdef.sqlite',voiceEnv=['STUL_ROOM_CREATE_RATE=75','STUL_ROOM_LIMIT=500','STUL_ROOM_BYTES_LIMIT=128000000','STUL_LIVEKIT_URL=wss://voice.example.test','STUL_LIVEKIT_API_KEY=voice-test','STUL_LIVEKIT_API_SECRET=synthetic-test-secret-with-at-least-32-characters'];
async function fixture({bad=false,buildFails=false,failCreate=false,failStart=false,smokeFails=false,loseAck=false,version="0.1.0",targetTag="v0.2.0",targetProtocol=1,channel="stable",keep=0}={}){
 const dir=mkdtempSync(path.join(os.tmpdir(),'stul-updater-')),dataDir=path.join(dir,'data'),stateDir=path.join(dir,'state');mkdirSync(path.join(dataDir,'backups'),{recursive:true});writeFileSync(path.join(dataDir,'game.sqlite'),'before');
 let backups=0, counter=0, lost=false, builds=0, containers=new Map([['old',{Id:'old',Name:'/stul-app',Config:{Image:'stul-app:local',Env:voiceEnv},HostConfig:{},NetworkSettings:{Networks:{table:{}}},State:{Running:true},revision:oldSha}]]);
 function named(id){const c=containers.get(id)||[...containers.values()].find(c=>c.Name==='/'+id);if(!c)throw Object.assign(new Error('Missing container '+id), {statusCode:404});return c;}
 let failed=false;const engine=async(method,url,config)=>{if(!failed&&(failCreate&&url.startsWith('/containers/create')||failStart&&url.includes('/new1/start'))){failed=true;throw new Error('Simulated Docker failure');}const u=new URL(url,'http://docker');if(u.pathname.startsWith('/images/'))return {Config:{Labels:{'cz.stul.updater-protocol':String(targetProtocol),'cz.stul.hosting-config':'1'}}};if(u.pathname==='/containers/create'){const id='new'+(++counter);containers.set(id,{Id:id,Name:'/'+u.searchParams.get('name'),Config:{...config},HostConfig:{},NetworkSettings:{Networks:{table:{}}},State:{Running:false},revision:config.Image.endsWith(newSha)?newSha:oldSha});return {Id:id};}const [, ,id,action]=u.pathname.split('/');const c=named(id);if(method==='DELETE'){containers.delete(c.Id);return {};}if(action==='json')return structuredClone(c);if(action==='stop')c.State.Running=false;if(action==='start')c.State.Running=true;if(action==='rename')c.Name='/'+u.searchParams.get('name');return {};};
 const appFetch=async(endpoint,body)=>{const c=named('stul-app');if(!c.State.Running||bad&&c.revision===newSha)throw new Error('Offline');if(endpoint==='/healthz')return {ok:true,hostingProtocol:1,version:c.revision===oldSha?version:'0.2.0',revision:c.revision};if(endpoint==='/internal/smoke')return {ok:!(smokeFails&&c.revision===newSha),revision:c.revision};if(endpoint==='/internal/maintenance'){if(body.enabled)writeFileSync(path.join(dataDir,'maintenance'),'1');else{const {unlinkSync}=await import('node:fs');if(existsSync(path.join(dataDir,'maintenance')))unlinkSync(path.join(dataDir,'maintenance'));
  if(loseAck&&!lost&&c.revision===newSha){lost=true;writeFileSync(path.join(dataDir,'game.sqlite'),'after reopening');throw new Error('Lost acknowledgment');}}return {ok:true};}if(endpoint==='/internal/backup'){const name=`${1234567890123+(++backups)}-1234567890abcdef.sqlite`;writeFileSync(path.join(dataDir,'backups',name),readFileSync(path.join(dataDir,'game.sqlite')));return {name};}throw new Error('Unknown endpoint');};
 const manager=new UpdateManager({dataDir,stateDir,engine,appFetch,wait:async()=>{},hostingConfig:1,channel,keep,development:async ref=>({ref,sha:newSha,tag:null}),release:async()=>({sha:newSha,tag:targetTag,url:'https://github.com/cert4u/u-jednoho-stolu/releases/tag/v0.2.0'}),build:async()=>{builds++;if(buildFails)throw new Error('Build failed');return 'stul-app:'+newSha;}});
 return {manager,dir,dataDir,containers,named,buildCount:()=>builds,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
for(const options of [{},{bad:true},{buildFails:true},{failCreate:true},{failStart:true},{smokeFails:true}]){
 const f=await fixture(options);try{const {manager:m}=f;await m.begin('update','test-request-12345678',{expectedSha:newSha});await assert.rejects(()=>m.begin('update','test-request-23456789'));await m.running;assert.equal(m.state.job.active,false);assert.equal(existsSync(path.join(f.dataDir,'maintenance')),false);
 if(options.bad||options.buildFails||options.failCreate||options.failStart||options.smokeFails){assert.equal(f.named('stul-app').Id,'old');assert.equal(m.state.transaction,undefined);assert.match(m.state.job.phase,/Neúspěch/);}else{assert.equal(f.named('stul-app').revision,newSha);assert.deepEqual(f.named('stul-app').Config.Env,voiceEnv);assert.ok(m.state.previous);assert.match(readFileSync(path.join(m.stateDir,'runtime.env'),'utf8'),new RegExp(newSha));const before=f.containers.size;await m.begin('update','test-request-12345678',{expectedSha:newSha});assert.equal(f.containers.size,before);await m.begin('rollback','test-request-34567890');await m.running;assert.equal(f.named('stul-app').revision,oldSha);assert.deepEqual(f.named('stul-app').Config.Env,voiceEnv);assert.equal(m.state.previous,null);assert.match(m.state.job.phase,/Hotovo/);}
 }finally{f.cleanup();}
}
// Power loss before the replacement ID was saved: recovery locates it by name.
{
 const f=await fixture();try{const m=f.manager;writeFileSync(path.join(f.dataDir,'backups',snapshot),'before');m.state.job={id:'interrupted',active:true,logs:[],phase:'test'};m.state.transaction={oldId:'old',snapshot,image:'stul-app:local',revision:oldSha};f.named('old').Name='/stul-app-previous';f.named('old').State.Running=false;f.containers.set('orphan',{Id:'orphan',Name:'/stul-app',State:{Running:true}});writeFileSync(path.join(f.dataDir,'game.sqlite'),'after');m.save();await m.resume();assert.equal(f.named('stul-app').Id,'old');assert.equal(readFileSync(path.join(f.dataDir,'game.sqlite'),'utf8'),'before');assert.equal(f.containers.has('orphan'),false);}finally{f.cleanup();}
}
// Only fixed stable release tags and a verified full commit can be built.
{
 const {latestRelease}=await import('../deploy/updater/releases.mjs');const originalFetch=globalThis.fetch;
 try{const replies=[{tag_name:'v0.2.0',draft:false,prerelease:false},{object:{type:'tag',sha:'d'.repeat(40)}},{object:{type:'commit',sha:newSha}}];globalThis.fetch=async url=>{assert.match(String(url),/^https:\/\/api.github.com\/repos\/cert4u\/u-jednoho-stolu\//);return new Response(JSON.stringify(replies.shift()));};assert.equal((await latestRelease()).sha,newSha);
 for(const release of [{tag_name:'main'},{tag_name:'v0.2.0',prerelease:true},{tag_name:'v0.2.0',draft:true}]){globalThis.fetch=async()=>new Response(JSON.stringify(release));await assert.rejects(latestRelease);}}finally{globalThis.fetch=originalFetch;}
}
console.log('PASS: upgrade, idempotence, concurrent jobs, build failure, unhealthy target rollback, manual rollback and recovery after interrupted create.');

for (const { options, expectedSha, error } of [
 { options:{version:'0.9.0-alpha.1'}, expectedSha:newSha, error:/starší/ },
 { options:{version:'0.2.0'}, expectedSha:newSha, error:/Stejné číslo/ },
 { options:{}, expectedSha:'d'.repeat(40), error:/mezitím změnilo/ },
 { options:{channel:'development'}, expectedSha:'d'.repeat(40), error:/mezitím změnilo/ },
 { options:{targetProtocol:2}, expectedSha:newSha, error:/novější updater/ },
]) {
 const f=await fixture(options);
 try {
  const m=f.manager;
  await m.begin('update','test-policy-12345678',{expectedSha,ref:'main'});
  await m.running;
  assert.match(m.state.job.logs.join(' '),error);
  assert.equal(f.buildCount(), options.targetProtocol ? 1 : 0);
  assert.equal(f.named('stul-app').revision,oldSha);
  assert(!existsSync(path.join(f.dataDir,'maintenance')));
 } finally { f.cleanup(); }
}

{
 const f=await fixture({loseAck:true,keep:1});
 try {
  const m=f.manager;
  const backups=path.join(f.dataDir,'backups');
  const manual='manual-1234567889999-1234567890abcdef.sqlite';
  writeFileSync(path.join(backups,manual),'manual');
  writeFileSync(path.join(backups,snapshot),'stale automatic');
  await m.begin('update','test-lost-ack-12345678',{expectedSha:newSha});
  await m.running;
  assert.match(m.state.job.phase,/Hotovo/);
  assert.equal(readFileSync(path.join(f.dataDir,'game.sqlite'),'utf8'),'after reopening');
  assert.equal(f.named('stul-app').revision,newSha);
  assert(m.hasSnapshot(m.state.previous.snapshot));
  assert(!existsSync(path.join(backups,snapshot)));
  assert(existsSync(path.join(backups,manual)));
  await assert.rejects(()=>m.begin('restore','test-confirm-12345678',{snapshot:manual}),/Potvrď/);
  await m.begin('restore','test-restore-12345678',{snapshot:manual,confirmSnapshot:manual});
  await m.running;
  assert.match(m.state.job.phase,/záloha databáze obnovena/);
  assert.equal(readFileSync(path.join(f.dataDir,'game.sqlite'),'utf8'),'manual');
  assert.equal(f.named('stul-app').revision,newSha);
  assert(existsSync(path.join(backups,manual)));
  const names=(await import('node:fs')).readdirSync(backups);
  assert.equal(names.length,2);
  assert.equal(readFileSync(path.join(backups,names.find(name=>name!==manual)),'utf8'),'after reopening');
 } finally { f.cleanup(); }
}

{
 const {compareVersions}=await import('../deploy/updater/versions.mjs');
 assert.equal(compareVersions('v0.9.0','0.9.0-alpha.1'),1);
 assert.equal(compareVersions('v0.9.0-alpha.10','0.9.0-alpha.2'),1);
 assert.equal(compareVersions('v0.8.0','0.9.0-alpha.1'),-1);
 assert.equal(compareVersions('v1.0.0-01','v1.0.0'),null);
 assert.equal(compareVersions('v1.0.0+ci.1','1.0.0+ci.2'),0);
 const {latestRelease,developmentRelease}=await import('../deploy/updater/releases.mjs');
 const originalFetch=globalThis.fetch;
 try {
  globalThis.fetch=async url=>{
   if(String(url).endsWith('/releases?per_page=20'))return Response.json([
    {tag_name:'v0.9.0-alpha.2',prerelease:true},
    {tag_name:'v0.9.0-alpha.10',prerelease:true,body:'Nová verze\n<!-- stul-release {"migrations":true} -->'},
    {tag_name:'v1.0.0',draft:true},
    {tag_name:'v0.8.0',prerelease:false},
   ]);
   if(String(url).endsWith('/git/ref/tags/v0.9.0-alpha.10'))
    return Response.json({object:{type:'commit',sha:newSha}});
   if(String(url).endsWith('/branches/codex%2Ftest'))return Response.json({commit:{sha:newSha}});
   throw new Error('Unexpected URL');
  };
  const preview=await latestRelease('preview');
  assert.equal(preview.tag,'v0.9.0-alpha.10');
  assert.equal(preview.requirements.migrations,true);
  assert.equal(preview.requirements.updater,null);
  assert.equal(preview.notes,'Nová verze');
  assert.equal((await developmentRelease('codex/test')).sha,newSha);
  await assert.rejects(()=>developmentRelease('codex/../test'));
 } finally { globalThis.fetch=originalFetch; }
}
console.log('PASS: version ordering, Preview and Development, confirmation, compatibility, smoke failure, retention and database restore.');
