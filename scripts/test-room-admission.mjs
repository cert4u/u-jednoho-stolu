import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
const dir=mkdtempSync(path.join(os.tmpdir(),'stul-admission-')),origin='http://127.0.0.1:18098';let server;
async function start(config){
 server=spawn(process.execPath,['server/start.mjs'],{env:{...process.env,STUL_DATA_DIR:dir,PORT:'18098',PUBLIC_ORIGIN:origin,STUL_ADMIN_PASSWORD:'admission-test-password-long',STUL_UPDATER_TOKEN:'admission-test-updater-token-32-chars',...config},stdio:['ignore','pipe','pipe']});
 let logs='';server.stderr.on('data',s=>logs+=s);server.stdout.on('data',s=>logs+=s);
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await delay(100);}throw Error(logs);
}
async function stop(){server.kill();await new Promise(r=>server.once('exit',r));}
const post=(body,extra={})=>fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
try{
 await start({STUL_ROOM_CREATE_RATE:'3'});
 const responses=await Promise.all(Array.from({length:8},(_,i)=>post({action:'create',name:'Test'},{'X-Forwarded-For':'192.0.2.'+i})));
 assert.equal(responses.filter(r=>r.status===200).length,3);assert.equal(responses.filter(r=>r.status===429).length,5);
 const successful=await responses.find(r=>r.status===200).json();
 const backup=await (await fetch(origin+'/api/game?room='+successful.room+'&download=backup',{headers:{Authorization:'Bearer '+successful.token}})).json();
 assert.equal((await post({action:'restore',backup})).status,429);
 assert.equal(responses.find(r=>r.status===429).headers.get('retry-after'),'60');
 await stop();await start({STUL_ROOM_LIMIT:'3'});assert.equal((await post({action:'create'})).status,503);
 await stop();await start({STUL_ROOM_BYTES_LIMIT:'1'});assert.equal((await post({action:'restore',backup})).status,503);
 const auth={Authorization:'Bearer '+successful.token};
 assert.equal((await post({action:'chat',room:successful.room,text:'Storage growth',requestId:crypto.randomUUID()},auth)).status,503);
 assert.equal((await post({action:'notes',room:successful.room,notes:'',expected:{notes:backup.game.notes}},auth)).status,200);
 await stop();await start({STUL_ROOM_CREATE_RATE:'0',STUL_ROOM_LIMIT:'invalid',STUL_ROOM_BYTES_LIMIT:'-1'});assert.equal((await post({action:'create'})).status,200);
 await stop();rmSync(dir,{recursive:true,force:true});await start({STUL_ROOM_CREATE_RATE:'',STUL_ROOM_LIMIT:'',STUL_ROOM_BYTES_LIMIT:''});
 const defaults=spawn(process.execPath,['scripts/test-public-admission-api.mjs',origin],{stdio:'inherit'});assert.equal(await new Promise(r=>defaults.once('exit',r)),0);
 console.log('PASS: concurrent global admission, spoofed IP headers, restore/create budget, persistent capacity across restart and byte capacity.');
}finally{if(server?.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true});}
