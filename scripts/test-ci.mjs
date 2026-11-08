import {spawn, spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = '18173';
const base = `http://127.0.0.1:${port}`;
try{await fetch(base,{signal:AbortSignal.timeout(1000)});throw new Error('Port 18173 už používá jiný server. Nejdřív jej ukonči.');}catch(error){if(error.message?.startsWith('Port 18173'))throw error;}
const grouped=process.platform!=='win32';
const state = await mkdtemp(join(tmpdir(), 'stul-d1-test-'));
const env = { ...process.env, STUL_TEST_D1_STATE: state, STUL_RUNTIME: 'cloudflare', VINEXT_NO_DEV_LOCK: '1' };
let server;
let runner;
function stop(signal='SIGTERM'){if(server?.pid){try{if(grouped)process.kill(-server.pid,signal);else server.kill(signal);}catch{}}}
const interrupt=()=>{runner?.kill('SIGTERM');stop();process.exitCode=130;};
process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
try{
 const migrations = spawnSync(process.execPath, ['scripts/init-db.mjs'], { env, stdio: 'inherit' });
 if (migrations.error) throw migrations.error;
 if (migrations.status !== 0) throw new Error('Migrace testovací databáze selhala. Nejprve spusť npm run build.');
 server = spawn(process.execPath, ['scripts/run-framework.mjs', 'dev', '--port', port, '--host', '127.0.0.1'],
  { env, stdio: 'inherit', detached: grouped });
 const deadline=Date.now()+90000;
 let ready=false;
 while(Date.now()<deadline){
  if(server.exitCode!==null)throw new Error('Testovací server skončil při startu.');
  try{const response=await fetch(base,{signal:AbortSignal.timeout(2000)});if(response.ok){ready=true;break;}}catch{}
  await delay(300);
 }
 if(!ready)throw new Error('Testovací server nenastartoval do 90 sekund.');
 runner=spawn(process.execPath,['scripts/test-integration.mjs',base],{stdio:'inherit',env:{...process.env,STUL_TEST_RUNTIME:'cloudflare'}});
 const result=await new Promise((resolve,reject)=>{runner.once('error',reject);runner.once('exit',code=>resolve(code??1));});
 process.exitCode=result;
}finally{
 stop();
 if(server?.exitCode===null)await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(5000)]);
 if(server?.exitCode===null)stop('SIGKILL');
 await rm(state, { recursive: true, force: true });
 process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
}
