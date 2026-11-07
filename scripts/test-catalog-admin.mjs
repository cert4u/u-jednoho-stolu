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
 const gamePost=async(s,action,data={},expected=200)=>{
  const r=await fetch(origin+'/api/game',{method:'POST',headers:{'Content-Type':'application/json',...(s?{Authorization:'Bearer '+s.token}:{})},body:JSON.stringify({room:s?.room,action,requestId:crypto.randomUUID(),...data})});const value=await r.json();assert.equal(r.status,expected,value.error);return value;
 };
 const gameGet=async(s,query='',expected=200)=>{const r=await fetch(origin+'/api/game?'+new URLSearchParams({room:s.room})+query,{headers:{Authorization:'Bearer '+s.token}});const value=await r.json();assert.equal(r.status,expected,value.error);return value;};
 const core=await import('../dist/catalog-core.mjs');
 const edit=async(type,entry,originalId)=>{const c=await api('view?id=admin-test');await api('entry',{id:'admin-test',expectedRevision:c.revision,type,entry,originalId});};
 const box={...core.builtinCatalog.bundle.entries.scenery.find(e=>e.id==='crate'),id:'box',name:'Místní bedna'};
 const slime={...core.builtinCatalog.bundle.entries.scenery.find(e=>e.id==='water-area'),id:'slime',name:'Místní sliz'};
 await edit('scenery',box);await edit('scenery',slime);await edit('scenery',{...box,id:'secret-box',name:'TAJNÝ NEVIDITELNÝ SYMBOL'});
 const player=await gamePost(null,'join',{room:pj.room,name:'Hráč'});
 const catalog=await gameGet(pj,'&catalog=bestiary');assert(catalog.some(e=>e.id==='admin-test:rat'));assert(catalog.some(e=>e.id==='friend:rat'));
 await gameGet(player,'&catalog=bestiary',403);await gameGet(player,'&catalog=preparation',403);
 const prep=await gameGet(pj,'&catalog=preparation');assert(prep.scenery.some(e=>e.id==='admin-test:slime'));
 await gamePost(pj,'map',{tool:'room',from:[1,1],to:[12,12]});
 let added=await gamePost(pj,'monster',{op:'create',templateId:'admin-test:rat'});
 const instance=added.game.monsters[0];assert.equal(instance.maxHp,3);assert(instance.portrait.startsWith('data:image/webp;base64,'));
 await gamePost(pj,'map',{tool:'scenery',op:'save',kind:'admin-test:box',x:3,y:3,size:'medium',rotation:0,hidden:false,expectedRevision:null});
 await gamePost(pj,'map',{tool:'scenery',op:'save',kind:'admin-test:secret-box',x:8,y:8,size:'medium',rotation:0,hidden:true,expectedRevision:null});
 await gamePost(pj,'map',{tool:'surface',kind:'admin-test:slime',op:'add',points:[[4,4],[6,5]]});
 await gamePost(pj,'map',{tool:'reveal',from:[0,0],to:[27,19]});
 const visible=await gameGet(player);assert(visible.contentVisuals.some(e=>e.id==='admin-test:box'));assert(visible.contentVisuals.some(e=>e.id==='admin-test:slime'));assert(!JSON.stringify(visible).includes('TAJNÝ NEVIDITELNÝ SYMBOL'));assert(!JSON.stringify(visible).includes(entry.gmHint));assert(!('contentLibrary' in visible));
 await edit('bestiary',{...entry,maxHp:99},'rat');await edit('scenery',{...box,path:'M2 2L30 30'},'box');
 added=await gamePost(pj,'monster',{op:'create',templateId:'admin-test:rat'});assert(added.game.monsters.every(m=>m.maxHp===3),'Existing campaign pins its first template version.');
 assert.equal(added.game.contentVisuals.find(e=>e.id==='admin-test:box').path,box.path);
 const fresh=await gamePost(null,'create',{name:'Nový PJ'});assert.equal((await gamePost(fresh,'monster',{op:'create',templateId:'admin-test:rat'})).game.monsters[0].maxHp,99);
 const preset={...core.builtinCatalog.bundle.entries['dungeon-presets'][0],id:'mini',options:{...core.builtinCatalog.bundle.entries['dungeon-presets'][0].options,levels:1,rooms:4}};await edit('dungeon-presets',preset);
 await edit('adventures',{id:'tale',title:'Místní příběh',scene:'Místní jeskyně',summary:'Bez tajemství.',gmNotes:'TAJNÉ DOBRODRUŽSTVÍ',dungeonPreset:'mini',rooms:[{floor:1,role:'entrance',title:'Vchod',playerText:'Vstupujete.',gmNotes:'TAJNÉ MÍSTO',monsters:['rat']}]});
 const summaries=await (await fetch(origin+'/api/adventures')).json();assert(summaries.some(e=>e.id==='admin-test:tale'));assert(!JSON.stringify(summaries).includes('TAJNÉ'));
 const story=await gamePost(null,'create',{name:'PJ příběhu',adventureId:'admin-test:tale'});assert.equal(story.game.title,'Místní příběh');assert.equal(story.game.monsters[0].maxHp,99);
 // Server bundle must include both SQLite and immutable catalog files.
 const snapshotResponse=await fetch(origin+'/admin/api/backups',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'});assert.equal(snapshotResponse.status,201);const snapshot=(await snapshotResponse.json()).name;
 const fullResponse=await fetch(origin+'/admin/api/backup?'+new URLSearchParams({name:snapshot,bundle:'1'}),{headers:{Cookie:cookie}});assert.equal(fullResponse.status,200);
 const full=readZip(Buffer.from(await fullResponse.arrayBuffer()),{archive:280_000_000,total:256_000_000,file:128_000_000,files:4098});assert.equal(full.get('game.sqlite').subarray(0,15).toString(),'SQLite format 3');assert([...full.keys()].some(k=>k.startsWith('catalog-assets/')));
 const backup=await gameGet(pj,'&download=backup'),savedPortrait=backup.game.contentLibrary.images;
 current=await api('view?id=admin-test');await api('enable',{id:'admin-test',expectedRevision:current.revision,enabled:false});current=await api('view?id=admin-test');await api('remove',{id:'admin-test',expectedRevision:current.revision,preserveCampaigns:true});
 assert(!(await gameGet(fresh,'&catalog=preparation')).scenery.some(e=>e.id==='admin-test:box'));
 assert.equal((await gameGet(pj)).monsters[0].portrait,instance.portrait,'Removing a catalog must not change a used portrait.');
 const tampered=structuredClone(backup),first=Object.keys(tampered.game.contentLibrary.images)[0],corruptBytes=Buffer.from(tampered.game.contentLibrary.images[first].data,'base64');corruptBytes[64]^=1;tampered.game.contentLibrary.images[first].data=corruptBytes.toString('base64');await gamePost(null,'restore',{backup:tampered},400);
 const restored=await gamePost(null,'restore',{backup});assert.deepEqual((await gameGet(restored,'&download=backup')).game.contentLibrary.images,savedPortrait);assert.equal(restored.game.contentVisuals.find(e=>e.id==='admin-test:box').path,box.path);
 console.log('PASS: live bestiary/presets/adventures/scenery/materials, namespace collisions, private projections, frozen stats/artwork, portable backups, safe removal and full server asset bundles.');

 console.log('PASS: existing admin authentication/origin protections, PJ isolation, local editing/validation, images, ZIP preview/confirm/export and persisted library after restart.');
}finally{await stop();await rm(dir,{recursive:true,force:true});}
