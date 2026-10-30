import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const base='http://127.0.0.1:5173';
try{await fetch(base,{signal:AbortSignal.timeout(1000)});throw new Error('Port 5173 už používá jiný server. Nejdřív jej ukonči.');}catch(error){if(error.message?.startsWith('Port 5173'))throw error;}
const grouped=process.platform!=='win32';
const server=spawn(process.execPath,['scripts/run-framework.mjs','dev'],{stdio:'inherit',detached:grouped});
let runner;
function stop(signal='SIGTERM'){if(server.pid){try{if(grouped)process.kill(-server.pid,signal);else server.kill(signal);}catch{}}}
const interrupt=()=>{runner?.kill('SIGTERM');stop();process.exitCode=130;};
process.on('SIGINT',interrupt);process.on('SIGTERM',interrupt);
try{
 const deadline=Date.now()+90000;
 let ready=false;
 while(Date.now()<deadline){
  if(server.exitCode!==null)throw new Error('Testovací server skončil při startu.');
  try{const response=await fetch(base,{signal:AbortSignal.timeout(2000)});if(response.ok){ready=true;break;}}catch{}
  await delay(300);
 }
 if(!ready)throw new Error('Testovací server nenastartoval do 90 sekund.');
 runner=spawn(process.execPath,['scripts/test-integration.mjs',base],{stdio:'inherit'});
 const result=await new Promise((resolve,reject)=>{runner.once('error',reject);runner.once('exit',code=>resolve(code??1));});
 process.exitCode=result;
}finally{
 stop();
 if(server.exitCode===null)await Promise.race([new Promise(resolve=>server.once('exit',resolve)),delay(5000)]);
 if(server.exitCode===null)stop('SIGKILL');
 process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
}
