import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const dir=mkdtempSync(path.join(os.tmpdir(),'stul-admission-')),origin='http://127.0.0.1:18099';let server;
async function start(config){
 server=spawn(process.execPath,['server/start.mjs'],{env:{...process.env,STUL_DATA_DIR:dir,PORT:'18099',PUBLIC_ORIGIN:origin,STUL_ADMIN_PASSWORD:'admission-test-password-long',STUL_UPDATER_TOKEN:'admission-test-updater-token-32-chars',...config},cwd:process.env.STUL_SERVER_ROOT||process.cwd(),stdio:['ignore','pipe','pipe']});
 let logs='';server.stderr.on('data',s=>logs+=s);server.stdout.on('data',s=>logs+=s);
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await delay(100);}throw Error(logs);
}
async function stop(){server.kill();await new Promise(r=>server.once('exit',r));}
try{
 await start({});
 for(const name of process.env.STUL_REPRO_BASELINE==='1'?['message-replay']:['message-replay','conditional-game']){
  const runner=spawn(process.execPath,['scripts/test-'+name+'.mjs',origin],{stdio:'inherit',env:process.env});
  assert.equal(await new Promise(r=>runner.once('exit',r)),0);
 }

}finally{if(server?.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true});}
