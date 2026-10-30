import {readFileSync,writeFileSync,renameSync,existsSync,copyFileSync,unlinkSync,mkdirSync,statSync,chownSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {docker,buildImage,replacementConfig} from './docker.mjs';
import {latestRelease} from './releases.mjs';
export class UpdateManager{
 constructor({stateDir='/state',dataDir='/data',engine=docker,build=buildImage,release=latestRelease,appFetch,wait=delay}={}){
  Object.assign(this,{stateDir,dataDir,engine,build,release,wait});this.name=process.env.STUL_APP_CONTAINER||'stul-app';this.appFetch=appFetch||((endpoint,data)=>this.fetchApp(endpoint,data));mkdirSync(stateDir,{recursive:true});chmodSync(stateDir,0o700);mkdirSync(dataDir,{recursive:true});if(process.getuid?.()===0)chownSync(dataDir,1000,1000);
  this.state=existsSync(this.file)?JSON.parse(readFileSync(this.file,'utf8')):{job:null,previous:null};this.latest=null;this.releaseError=null;this.checked=0;
 }
 get file(){return path.join(this.stateDir,'state.json');}
 save(){const temp=this.file+'.tmp';writeFileSync(temp,JSON.stringify(this.state),{mode:0o600});renameSync(temp,this.file);}
 log(message){this.state.job.logs.push(String(message).slice(-2500));this.state.job.logs=this.state.job.logs.slice(-30);this.save();}
 phase(value){this.state.job.phase=value;this.save();}
 async fetchApp(endpoint,data){const response=await fetch(`http://app:8080${endpoint}`,{method:data?'POST':'GET',headers:{Authorization:`Bearer ${process.env.STUL_UPDATER_TOKEN}`,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error(`Aplikace neodpovídá (${response.status}).`);return response.json();}
 async check(force=false){if(!force&&Date.now()-this.checked<60000)return;this.checked=Date.now();try{this.latest=await this.release();this.releaseError=null;}catch(e){this.latest=null;this.releaseError=e.message;}}
 async status(){await this.check();return {latest:this.latest,releaseError:this.releaseError,job:this.state.job,canRollback:Boolean(this.state.previous)&&!this.state.job?.active};}
 async healthy(revision){let last;for(let i=0;i<60;i++){try{const status=await this.appFetch('/healthz');if(status.ok&&(!revision||status.revision===revision))return status;}catch(e){last=e;}await this.wait(1000);}throw new Error('Nová aplikace nenastartovala do 60 sekund.'+(last?' '+last.message:''));}
 async inspect(id){return this.engine('GET',`/containers/${encodeURIComponent(id)}/json`);}
 async stop(id){const container=await this.inspect(id);if(container.State.Running)await this.engine('POST',`/containers/${id}/stop?t=20`);}
 async remove(id){await this.engine('DELETE',`/containers/${id}?force=true`);}
 runtime(image){if(!/^stul-app:(?:[a-f0-9]{40}|local)$/.test(image))throw new Error('Neplatný image instalace.');const file=path.join(this.stateDir,'runtime.env');writeFileSync(file+'.tmp',`STUL_APP_IMAGE=${image}\n`,{mode:0o600});renameSync(file+'.tmp',file);}
 snapshotPath(name){if(!/^\d+-[a-f0-9]{16}\.sqlite$/.test(name||''))throw new Error('Neplatný název zálohy.');const file=path.join(this.dataDir,'backups',name);if(!existsSync(file))throw new Error('Záloha databáze chybí.');return file;}
 restore(name){const source=this.snapshotPath(name),target=path.join(this.dataDir,'game.sqlite');copyFileSync(source,target+'.restore');const owner=statSync(source);if(process.getuid?.()===0)chownSync(target+'.restore',owner.uid,owner.gid);chmodSync(target+'.restore',0o600);renameSync(target+'.restore',target);for(const suffix of ['-wal','-shm'])if(existsSync(target+suffix))unlinkSync(target+suffix);}
 async begin(kind,requestId){
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId||''))throw new Error('Chybí platný identifikátor požadavku.');
  if(this.state.job?.id===requestId)return this.state.job;
  if(this.state.job?.active||this.state.transaction)throw new Error('Probíhá jiná aktualizace nebo je nutná obnova po přerušení.');
  if(kind==='rollback'&&!this.state.previous)throw new Error('Předchozí verze není k dispozici.');
  this.state.job={id:requestId,kind,active:true,phase:'Příprava',logs:[],startedAt:new Date().toISOString()};this.save();
  // Yield before doing work so the caller receives a durable job ID first.
  this.running=Promise.resolve().then(()=>kind==='rollback'?this.rollback():this.update()).catch(async error=>{
   this.log(error.message);this.phase('Obnova po neúspěchu');try{await this.recover();this.phase('Neúspěch — původní verze obnovena');}catch(e){this.log('Automatická obnova se nepodařila: '+e.message);this.phase('Vyžaduje zásah správce — stůl zůstává v údržbě');}
  }).finally(()=>{this.state.job.active=false;this.save();});return this.state.job;
 }
 async maintenance(){this.phase('Uložení zálohy databáze');await this.appFetch('/internal/maintenance',{enabled:true});const {name}=await this.appFetch('/internal/backup',{});this.snapshotPath(name);return name;}
 async update(){
  await this.check(true);if(!this.latest)throw new Error(this.releaseError);const release=this.latest,current=await this.appFetch('/healthz');if(current.revision===release.sha)throw new Error('Poslední vydání už je nainstalováno.');
  this.phase(`Sestavení ${release.tag} (může trvat několik minut)`);const image=await this.build(release.sha,release.tag,message=>this.log(message));
  const old=await this.inspect(this.name);if(!/^stul-app:(?:[a-f0-9]{40}|local)$/.test(old.Config.Image))throw new Error('Aplikace nepoužívá podporovaný image.');
  // Record original before maintenance; recovery can release the flag even if backup fails.
  this.state.transaction={oldId:old.Id,image:old.Config.Image,revision:current.revision};this.save();
  const snapshot=await this.maintenance();Object.assign(this.state.transaction,{snapshot,previousName:`${this.name}-previous-${Date.now()}`});this.save();
  this.phase('Výměna aplikace');await this.stop(old.Id);await this.engine('POST',`/containers/${old.Id}/rename?name=${this.state.transaction.previousName}`);
  const created=await this.engine('POST',`/containers/create?name=${this.name}`,replacementConfig(old,image));this.state.transaction.newId=created.Id;this.save();
  await this.engine('POST',`/containers/${created.Id}/start`);this.phase('Kontrola nové verze');await this.healthy(release.sha);
  this.state.transaction.promoted={image,revision:release.sha};this.state.previous={...this.state.transaction,installedRevision:release.sha};this.save();await this.finishPromotion();this.phase(`Hotovo — ${release.tag}`);
 }
 async recover(){
  const tx=this.state.transaction;if(!tx)return;if(tx.promoted){await this.finishPromotion();return;}
  // Resolve by name as well as recorded ID: process may have stopped after create
  // but before the new ID was saved.
  let named;try{named=await this.inspect(this.name);}catch{}
  if(named&&named.Id!==tx.oldId)await this.remove(named.Id);
  if(tx.snapshot){await this.stop(tx.oldId);this.restore(tx.snapshot);}
  const old=await this.inspect(tx.oldId);if(old.Name!==`/${this.name}`)await this.engine('POST',`/containers/${tx.oldId}/rename?name=${this.name}`);
  if(!old.State.Running)await this.engine('POST',`/containers/${tx.oldId}/start`);
  await this.healthy(tx.revision);this.runtime(tx.image);await this.appFetch('/internal/maintenance',{enabled:false});delete this.state.transaction;this.save();
 }
 async rollback(){
  const previous=this.state.previous;this.snapshotPath(previous.snapshot);const current=await this.inspect(this.name),health=await this.appFetch('/healthz');
  this.state.transaction={kind:'rollback',oldId:current.Id,image:current.Config.Image,revision:health.revision};this.save();const snapshot=await this.maintenance();this.state.transaction.snapshot=snapshot;this.save();
  this.phase('Návrat předchozí verze');await this.stop(current.Id);this.restore(previous.snapshot);
  const temporary=`${this.name}-rollback-${Date.now()}`;await this.engine('POST',`/containers/${current.Id}/rename?name=${temporary}`);
  const created=await this.engine('POST',`/containers/create?name=${this.name}`,replacementConfig(current,previous.image));this.state.transaction.newId=created.Id;this.save();
  await this.engine('POST',`/containers/${created.Id}/start`);await this.healthy(previous.revision);this.state.transaction.promoted={image:previous.image,revision:previous.revision};this.state.previous=null;this.save();await this.finishPromotion();this.phase('Hotovo — předchozí verze i databáze obnoveny');
 }
 async finishPromotion(){const target=this.state.transaction.promoted;await this.healthy(target.revision);this.runtime(target.image);try{await this.remove(this.state.transaction.oldId);}catch(e){this.log('Původní zastavený kontejner vyžaduje ruční odstranění: '+e.message);}await this.appFetch('/internal/maintenance',{enabled:false});delete this.state.transaction;this.save();}
 async resume(){if(this.state.transaction){this.state.job.active=true;this.phase('Obnova po přerušení služby');try{await this.recover();this.phase('Původní verze obnovena po přerušení');}catch(e){this.log(e.message);this.phase('Vyžaduje zásah správce — údržba');}finally{this.state.job.active=false;this.save();}}else if(this.state.job?.active){this.state.job.active=false;this.phase('Aktualizace přerušena před výměnou aplikace');}}
}
