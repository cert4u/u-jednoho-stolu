import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {writeZip,readZip} from '../server/catalog-zip.mjs';
const dir=await mkdtemp(join(tmpdir(),'stul-catalog-admin-')),origin='http://127.0.0.1:18087',password='catalog-admin-test-password-long';let server,cookie;
async function start(){server=spawn(process.execPath,['server/start.mjs'],{env:{...process.env,STUL_DATA_DIR:dir,PORT:'18087',PUBLIC_ORIGIN:origin,STUL_ADMIN_PASSWORD:password,STUL_UPDATER_TOKEN:crypto.randomUUID()},stdio:['ignore','pipe','pipe']});let logs='';server.stdout.on('data',s=>logs+=s);server.stderr.on('data',s=>logs+=s);for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(logs);try{if((await fetch(origin+'/healthz')).ok)return;}catch{}await delay(100);}throw Error(logs||'Server timeout');}
async function stop(){if(server?.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}}
async function login(){const r=await fetch(origin+'/admin/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(r.status,200);cookie=r.headers.get('set-cookie');}
async function api(action='',data,expected=200,custom={}){const r=await fetch(origin+'/admin/api/catalogs'+(action?'/'+action:''),{headers:{Cookie:cookie,Origin:origin,...(data===undefined?{}:{'Content-Type':'application/json'}),...custom.headers},...(data===undefined?{}:{method:'POST',body:JSON.stringify(data)}),...custom});const value=await r.json();assert.equal(r.status,expected,value.error);return value;}
try{
 await start();assert.equal((await fetch(origin+'/admin/api/catalogs')).status,401);
 const create=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',name:'PJ'})});const pj=await create.json();
 assert.equal((await fetch(origin+'/admin/api/catalogs',{headers:{Authorization:'Bearer '+pj.token}})).status,401);
 await login();assert.equal((await api()).catalogs.length,1);
 const manifest={schemaVersion:1,id:'admin-test',name:'Správcův katalog',version:'1.0.0',author:'Test',license:'CC0-1.0',minAppVersion:'1.1.0'};
 await api('create',{manifest},403,{headers:{Cookie:cookie,Origin:'https://wrong.test','Content-Type':'application/json'}});
 await api('create',{manifest});let current=await api('view?id=admin-test');
 const entry={id:'rat',name:'Krysa',description:'Vlastní příšera.',gmHint:'TAJNÉ POUZE PRO PJ',environments:['caves'],maxHp:3,combat:{attack:1,defense:1,damage:0}};
 await api('entry',{id:'admin-test',expectedRevision:current.revision,type:'bestiary',entry,validateOnly:true});assert.equal((await api('view?id=admin-test')).bundle.entries.bestiary.length,0);
 await api('entry',{id:'admin-test',expectedRevision:current.revision,type:'bestiary',entry});current=await api('view?id=admin-test');
 await api('entry',{id:'admin-test',expectedRevision:current.revision,type:'bestiary',entry:{...entry,maxHp:-1},originalId:'rat'},400);
 const image=await readFile('public/monsters/kobold.webp');await api('image?'+new URLSearchParams({id:'admin-test',revision:String(current.revision),portrait:'rat'}),undefined,200,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'image/webp'},body:image});
 current=await api('view?id=admin-test');assert.equal((await fetch(origin+'/catalog-assets/'+current.bundle.assets[0].digest+'.webp')).headers.get('content-type'),'image/webp');
 const exported=await fetch(origin+'/admin/api/catalogs/export?id=admin-test',{headers:{Cookie:cookie}});assert.equal(exported.status,200);assert(readZip(Buffer.from(await exported.arrayBuffer())).has('images/rat.webp'));
 const friend={...manifest,id:'friend'},zip=writeZip(new Map([['catalog.json',Buffer.from(JSON.stringify(friend))],['bestiary/rat.json',Buffer.from(JSON.stringify(entry))]]));
 const prepared=await api('preview',undefined,200,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/zip'},body:zip});assert.equal((await api()).catalogs.length,2);
 await api('install',{token:prepared.token});const imported=await api('view?id=friend');assert.equal(imported.kind,'community');await api('entry',{id:'friend',expectedRevision:imported.revision,type:'bestiary',entry:{...entry,name:'Overwrite'},originalId:'rat'},400);
 await stop();await start();await login();assert.equal((await api('view?id=admin-test')).bundle.entries.bestiary[0].gmHint,entry.gmHint);
 assert.equal((await fetch(origin+'/admin/catalogs.js')).status,200);
 console.log('PASS: existing admin authentication/origin protections, PJ isolation, local editing/validation, images, ZIP preview/confirm/export and persisted library after restart.');
}finally{await stop();await rm(dir,{recursive:true,force:true});}
