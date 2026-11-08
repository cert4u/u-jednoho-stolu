import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,copyFileSync,readFileSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';import {setTimeout as delay} from 'node:timers/promises';
const oldRoot=process.argv[2];assert(oldRoot,'Pass an isolated built 1.2.1 source checkout.');assert.equal(JSON.parse(readFileSync(path.join(oldRoot,'dist/stul-build.json'))).version,'1.2.1');
const dir=mkdtempSync(path.join(os.tmpdir(),'stul-stable-upgrade-')),origin='http://127.0.0.1:18104';let server;
async function start(root,config={},lowDisk=false){
 server=spawn(process.execPath,[...(lowDisk?['--import',path.resolve('scripts/test-support/low-disk.mjs')]:[]),'server/start.mjs'],{cwd:root,env:{...process.env,PORT:'18104',PUBLIC_ORIGIN:origin,STUL_DATA_DIR:dir,STUL_ADMIN_PASSWORD:'stable-upgrade-test-password',STUL_UPDATER_TOKEN:'stable-upgrade-token-long-enough-32-characters',...config},stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',s=>logs+=s);server.stderr.on('data',s=>logs+=s);
 for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await delay(100);}throw Error(logs);
}
async function stop(){server.kill();await new Promise(r=>server.once('exit',r));}
async function post(action,data={},session){const response=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify({action,room:session?.room,requestId:crypto.randomUUID(),...data})});return {response,data:await response.json()};}
async function ok(action,data,session){const result=await post(action,data,session);assert.equal(result.response.status,200,JSON.stringify(result.data));return result.data;}
const rows=()=>{const db=new DatabaseSync(path.join(dir,'game.sqlite'));try{return db.prepare('SELECT id,data,version FROM rooms ORDER BY id').all();}finally{db.close();}};
const view=s=>fetch(origin+'/api/game?room='+s.room,{headers:{Authorization:'Bearer '+s.token}});
try{
 await start(oldRoot);const pj=await ok('create',{name:'Původní PJ'}),a=await ok('join',{room:pj.room,name:'Borin'}),b=await ok('join',{room:pj.room,name:'Ela'});await ok('create',{name:'Druhý stůl'});
 await ok('notes',{notes:'Příběh a tajné poznámky před aktualizací.',expected:{notes:pj.game.notes}},pj);await ok('monster',{op:'create',templateId:'kobold'},pj);await ok('chat',{text:'Staré šeptání',to:a.game.me},b);await stop();
 const original=rows(),db=new DatabaseSync(path.join(dir,'game.sqlite'));db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();const saved=path.join(dir,'before.sqlite');copyFileSync(path.join(dir,'game.sqlite'),saved);
 await start(process.cwd(),{STUL_ROOM_LIMIT:'2'});assert.deepEqual(rows(),original);for(const s of [pj,a,b])assert.equal((await view(s)).status,200);assert.equal((await post('create')).response.status,503);await stop();
 await start(process.cwd());assert.deepEqual(rows(),original);await ok('create',{name:'Nový stůl po migraci'});await stop();
 const migrated=new DatabaseSync(path.join(dir,'game.sqlite'));assert(migrated.prepare('PRAGMA table_info(rooms)').all().some(c=>c.name==='created_at'));assert.equal(migrated.prepare('SELECT created_at FROM rooms WHERE id=?').get(pj.room).created_at,0);migrated.close();
 await start(process.cwd(),{},true);assert.equal((await post('chat',{text:'Nedostatek místa'},a)).response.status,503);assert.equal((await view(a)).status,200);await stop();
 // A schema-compatible direct downgrade can read the additive migration, but the supported rollback restores its snapshot.
 await start(oldRoot);for(const s of [pj,a,b])assert.equal((await view(s)).status,200);await stop();
 const checkpoint=new DatabaseSync(path.join(dir,'game.sqlite'));checkpoint.exec('PRAGMA wal_checkpoint(TRUNCATE)');checkpoint.close();copyFileSync(saved,path.join(dir,'game.sqlite'));
 for(const suffix of ['-wal','-shm'])rmSync(path.join(dir,'game.sqlite')+suffix,{force:true});
 await start(oldRoot);assert.deepEqual(rows(),original);for(const s of [pj,a,b])assert.equal((await view(s)).status,200);await stop();
 await start(process.cwd());assert.deepEqual(rows(),original);
 console.log('PASS: real 1.2.1 → current → restart → 1.2.1 snapshot rollback → current, complete room JSON/tokens/art retention, admission capacity, additive schema and injected low-disk HTTP refusal with reads preserved.');
}finally{if(server?.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true});}
