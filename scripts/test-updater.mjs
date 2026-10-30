import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {UpdateManager} from '../deploy/updater/manager.mjs';
const oldSha='a'.repeat(40),newSha='b'.repeat(40),snapshot='1234567890123-1234567890abcdef.sqlite';
async function fixture({bad=false,buildFails=false}={}){
 const dir=mkdtempSync(path.join(os.tmpdir(),'stul-updater-')),dataDir=path.join(dir,'data'),stateDir=path.join(dir,'state');mkdirSync(path.join(dataDir,'backups'),{recursive:true});writeFileSync(path.join(dataDir,'game.sqlite'),'before');
 let counter=0,containers=new Map([['old',{Id:'old',Name:'/stul-app',Config:{Image:'stul-app:local',Env:[]},HostConfig:{},NetworkSettings:{Networks:{table:{}}},State:{Running:true},revision:oldSha}]]);
 function named(id){const c=containers.get(id)||[...containers.values()].find(c=>c.Name==='/'+id);if(!c)throw new Error('Missing container '+id);return c;}
 const engine=async(method,url,config)=>{const u=new URL(url,'http://docker');if(u.pathname==='/containers/create'){const id='new'+(++counter);containers.set(id,{Id:id,Name:'/'+u.searchParams.get('name'),Config:{...config},HostConfig:{},NetworkSettings:{Networks:{table:{}}},State:{Running:false},revision:config.Image.endsWith(newSha)?newSha:oldSha});return {Id:id};}const [, ,id,action]=u.pathname.split('/');const c=named(id);if(method==='DELETE'){containers.delete(c.Id);return {};}if(action==='json')return structuredClone(c);if(action==='stop')c.State.Running=false;if(action==='start')c.State.Running=true;if(action==='rename')c.Name='/'+u.searchParams.get('name');return {};};
 const appFetch=async(endpoint,body)=>{const c=named('stul-app');if(!c.State.Running||bad&&c.revision===newSha)throw new Error('Offline');if(endpoint==='/healthz')return {ok:true,revision:c.revision};if(endpoint==='/internal/maintenance'){if(body.enabled)writeFileSync(path.join(dataDir,'maintenance'),'1');else{const {unlinkSync}=await import('node:fs');if(existsSync(path.join(dataDir,'maintenance')))unlinkSync(path.join(dataDir,'maintenance'));}return {ok:true};}if(endpoint==='/internal/backup'){writeFileSync(path.join(dataDir,'backups',snapshot),readFileSync(path.join(dataDir,'game.sqlite')));return {name:snapshot};}throw new Error('Unknown endpoint');};
 const manager=new UpdateManager({dataDir,stateDir,engine,appFetch,wait:async()=>{},release:async()=>({sha:newSha,tag:'v0.2.0',url:'https://github.com/cert4u/u-jednoho-stolu/releases/tag/v0.2.0'}),build:async()=>{if(buildFails)throw new Error('Build failed');return 'stul-app:'+newSha;}});
 return {manager,dir,dataDir,containers,named,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
for(const options of [{},{bad:true},{buildFails:true}]){
 const f=await fixture(options);try{const {manager:m}=f;await m.begin('update','test-request-12345678');await assert.rejects(()=>m.begin('update','test-request-23456789'));await m.running;assert.equal(m.state.job.active,false);assert.equal(existsSync(path.join(f.dataDir,'maintenance')),false);
 if(options.bad||options.buildFails){assert.equal(f.named('stul-app').Id,'old');assert.equal(m.state.transaction,undefined);assert.match(m.state.job.phase,/Neúspěch/);}else{assert.equal(f.named('stul-app').revision,newSha);assert.ok(m.state.previous);assert.match(readFileSync(path.join(m.stateDir,'runtime.env'),'utf8'),new RegExp(newSha));const before=f.containers.size;await m.begin('update','test-request-12345678');assert.equal(f.containers.size,before);await m.begin('rollback','test-request-34567890');await m.running;assert.equal(f.named('stul-app').revision,oldSha);assert.equal(m.state.previous,null);assert.match(m.state.job.phase,/Hotovo/);}
 }finally{f.cleanup();}
}
// Power loss before the replacement ID was saved: recovery locates it by name.
{
 const f=await fixture();try{const m=f.manager;writeFileSync(path.join(f.dataDir,'backups',snapshot),'before');m.state.job={id:'interrupted',active:true,logs:[],phase:'test'};m.state.transaction={oldId:'old',snapshot,image:'stul-app:local',revision:oldSha};f.named('old').Name='/stul-app-previous';f.named('old').State.Running=false;f.containers.set('orphan',{Id:'orphan',Name:'/stul-app',State:{Running:true}});writeFileSync(path.join(f.dataDir,'game.sqlite'),'after');m.save();await m.resume();assert.equal(f.named('stul-app').Id,'old');assert.equal(readFileSync(path.join(f.dataDir,'game.sqlite'),'utf8'),'before');assert.equal(f.containers.has('orphan'),false);}finally{f.cleanup();}
}
console.log('PASS: upgrade, idempotence, concurrent jobs, build failure, unhealthy target rollback, manual rollback and recovery after interrupted create.');
