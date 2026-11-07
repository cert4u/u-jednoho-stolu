import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(path.join(tmpdir(),'stul-catalog-store-'));process.env.STUL_DATA_DIR=dir;
const store=await import('../server/catalog-store.mjs'),core=await import('../dist/catalog-core.mjs');
const ordered=b=>({...b,entries:Object.fromEntries(Object.entries(b.entries).map(([k,v])=>[k,[...v].sort((a,b)=>a.id.localeCompare(b.id))]))});
const {writeZip}=await import('../server/catalog-zip.mjs');
const {unpackCatalog}=await import('../server/catalog-pack.mjs');
try{
 const manifest={schemaVersion:1,id:'mine',name:'Doly',version:'1.0.0',author:'Test',license:'CC0-1.0',minAppVersion:'1.1.0'};
 await store.createCatalog(manifest);await assert.rejects(store.createCatalog(manifest),/existuje/);
 let current=await store.viewCatalog('mine');
 const rat={...core.builtinCatalog.bundle.entries.bestiary[0],id:'rat',portrait:undefined};
 await store.editEntry({id:'mine',type:'bestiary',entry:rat,expectedRevision:current.revision});
 await assert.rejects(store.editEntry({id:'mine',type:'bestiary',entry:rat,expectedRevision:current.revision}),/změnil/);
 current=await store.viewCatalog('mine');
 await assert.rejects(store.editEntry({id:'mine',type:'bestiary',entry:rat,expectedRevision:current.revision}),/již existuje/);
 await assert.rejects(store.editEntry({id:'mine',type:'bestiary',entry:{...rat,maxHp:-1},originalId:'rat',expectedRevision:current.revision}));
 await store.editEntry({id:'mine',type:'bestiary',entry:{...rat,maxHp:42},originalId:'rat',expectedRevision:current.revision});
 current=await store.viewCatalog('mine');assert.equal(current.bundle.entries.bestiary[0].maxHp,42);
 await store.copyEntry({sourceId:'builtin',targetId:'mine',type:'bestiary',itemId:'kobold',newId:'kobold-copy',expectedRevision:current.revision});
 current=await store.viewCatalog('mine');assert.equal(current.bundle.entries.bestiary[1].portrait,'builtin:kobold');
 await store.copyEntry({sourceId:'mine',targetId:'mine',type:'bestiary',itemId:'rat',newId:'rat-copy',expectedRevision:current.revision});
 current=await store.viewCatalog('mine');await store.editEntry({id:'mine',type:'bestiary',originalId:'rat-copy',remove:true,expectedRevision:current.revision});
 current=await store.viewCatalog('mine');
 const image=readFileSync('public/monsters/kobold.webp');core.inspectCatalogWebp(image);
 await store.uploadImage('mine',current.revision,'my-rat',image);current=await store.viewCatalog('mine');
 await store.editEntry({id:'mine',type:'bestiary',entry:{...rat,portrait:'my-rat'},originalId:'rat',expectedRevision:current.revision});current=await store.viewCatalog('mine');
 const exported=await store.exportCatalog('mine'),unpacked=await unpackCatalog(exported,core,[]);
 assert.deepEqual(ordered(unpacked.bundle),ordered(current.bundle));assert.equal(unpacked.digest,current.digest);
 const child=spawnSync(process.execPath,['--input-type=module','-e',"import {viewCatalog} from './server/catalog-store.mjs';const c=await viewCatalog('mine');if(c.bundle.entries.bestiary.length!==2)process.exit(2);"],{env:{...process.env},encoding:'utf8'});assert.equal(child.status,0,child.stderr);
 await store.removeCatalog('mine',current.revision,true);
 const preview=await store.prepareCatalogImport(exported);assert.equal((await store.listCatalogs()).length,1,'Preview must not install.');await store.installPrepared(preview.token);
 current=await store.viewCatalog('mine');assert.equal(current.kind,'community');assert.deepEqual(current.bundle,unpacked.bundle);
 await assert.rejects(store.editManifest('mine',current.revision,{...current.bundle.manifest,name:'Overwrite'}),/pouze pro čtení/);
 const invalid=Buffer.from(exported);invalid[0]=0;await assert.rejects(store.prepareCatalogImport(invalid));assert.equal((await store.listCatalogs()).length,2);
 await store.createCatalog({...manifest,id:'other',name:'Vlastní'});
 let other=await store.viewCatalog('other');await store.copyEntry({sourceId:'mine',targetId:'other',type:'bestiary',itemId:'rat',newId:'copied-rat',expectedRevision:other.revision});other=await store.viewCatalog('other');assert.equal(other.bundle.assets.length,1);
 const before=structuredClone(other.bundle);
 await store.editManifest('other',other.revision,{...other.bundle.manifest,name:'Nový název'});other=await store.viewCatalog('other');assert.equal(other.bundle.manifest.id,'other');
 await store.rollbackCatalog('other',other.revision,other.history[0].id);assert.deepEqual((await store.viewCatalog('other')).bundle,before);
 const countBefore=(await store.listCatalogs()).length;
 for(const files of [
  new Map([['catalog.json',Buffer.from('{bad')]]),
  new Map([['catalog.json',Buffer.from(JSON.stringify({...manifest,id:'bad-import',schemaVersion:99}))]]),
  new Map([['catalog.json',Buffer.from(JSON.stringify({...manifest,id:'bad-import'}))],['bestiary/broken.json',Buffer.from('{bad')]]),
  new Map([['catalog.json',Buffer.from(JSON.stringify({...manifest,id:'bad-import'}))],['script.js',Buffer.from('throw new Error()')]]),
 ]){await assert.rejects(store.prepareCatalogImport(writeZip(files)));assert.equal((await store.listCatalogs()).length,countBefore);}
 console.log('PASS: local catalog CRUD, immediate validation, collisions/CAS, copy/duplicate/delete, immutable community origins, image persistence, export/import meaning, restart and history rollback.');
}finally{rmSync(dir,{recursive:true,force:true});}
