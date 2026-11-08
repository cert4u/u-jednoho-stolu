import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cases} from './test-case-list.mjs';

const port='18173',base=`http://127.0.0.1:${port}`,grouped=process.platform!=='win32';
try{await fetch(base,{signal:AbortSignal.timeout(1000)});throw new Error('Port 18173 už používá jiný server. Nejdřív jej ukonči.');}catch(error){if(error.message?.startsWith('Port 18173'))throw error;}
const selected=process.env.STUL_TEST_CASES?.split(',').filter(Boolean)??cases;
if(selected.some(name=>!cases.includes(name)))throw new Error('Neznámý integrační scénář.');
// The broad functional suite creates many tables. Test the production default in a fresh independent fixture.
const batches=[{names:selected.filter(name=>name!=='public-admission-api'),rate:'1000'},{names:selected.filter(name=>name==='public-admission-api'),rate:''}];
let server,runner;
function stop(signal='SIGTERM'){if(server?.pid){try{if(grouped)process.kill(-server.pid,signal);else server.kill(signal);}catch{}}}
const interrupt=()=>{runner?.kill('SIGTERM');stop();process.exitCode=130;};
process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
try{
 for(const batch of batches){
  if(!batch.names.length)continue;
  const state=await mkdtemp(join(tmpdir(),'stul-d1-test-'));
  const env={...process.env,STUL_TEST_D1_STATE:state,STUL_RUNTIME:'cloudflare',VINEXT_NO_DEV_LOCK:'1',STUL_ROOM_CREATE_RATE:batch.rate,STUL_ROOM_LIMIT:'',STUL_ROOM_BYTES_LIMIT:''};
  try{
   const migrations=spawnSync(process.execPath,['scripts/init-db.mjs'],{env,stdio:'inherit'});
   if(migrations.error)throw migrations.error;if(migrations.status!==0)throw new Error('Migrace testovací databáze selhala. Nejprve spusť npm run build.');
   server=spawn(process.execPath,['scripts/run-framework.mjs','dev','--port',port,'--host','127.0.0.1'],{env,stdio:'inherit',detached:grouped});
   const deadline=Date.now()+90000;let ready=false;
   while(Date.now()<deadline){
    if(server.exitCode!==null)throw new Error('Testovací server skončil při startu.');
    try{if((await fetch(base,{signal:AbortSignal.timeout(2000)})).ok){ready=true;break;}}catch{}await delay(300);
   }
   if(!ready)throw new Error('Testovací server nenastartoval do 90 sekund.');
   runner=spawn(process.execPath,['scripts/test-integration.mjs',base],{stdio:'inherit',env:{...process.env,STUL_TEST_RUNTIME:'cloudflare',STUL_TEST_CASES:batch.names.join(',')}});
   const result=await new Promise((resolve,reject)=>{runner.once('error',reject);runner.once('exit',code=>resolve(code??1));});
   if(result!==0){process.exitCode=result;break;}
  }finally{
   stop();if(server?.exitCode===null)await Promise.race([new Promise(r=>server.once('exit',r)),delay(5000)]);if(server?.exitCode===null)stop('SIGKILL');
   await rm(state,{recursive:true,force:true});server=undefined;runner=undefined;
  }
 }
}finally{process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);}
