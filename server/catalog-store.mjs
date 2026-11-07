import {openDatabase} from './database.mjs';
import {saveAsset,catalogFiles} from './catalog-files.mjs';
import {bundleDigest,unpackCatalog,packCatalog,hashBytes} from './catalog-pack.mjs';
const core=()=>import('../dist/catalog-core.mjs');
const now=()=>new Date().toISOString();
const previews=new Map();
const clone=value=>structuredClone(value);
function rows(db=openDatabase()){return db.prepare('SELECT * FROM catalogs ORDER BY installed_at,id').all().map(row=>({kind:row.kind,enabled:Boolean(row.enabled),revision:row.revision,digest:row.digest,bundle:JSON.parse(row.payload),source:row.source?JSON.parse(row.source):undefined,installedAt:row.installed_at,checkedAt:row.checked_at,updatedAt:row.updated_at}));}
function requireCatalog(id){const found=rows().find(c=>c.bundle.manifest.id===id);if(!found)throw new Error('Katalog neexistuje.');return found;}
function writable(id,expected){const c=requireCatalog(id);if(c.kind!=='local')throw new Error('Komunitní originál je pouze pro čtení. Vytvoř vlastní kopii.');if(c.revision!==expected)throw new Error('Katalog se změnil; načti aktuální verzi.');return c;}
function validateLibrary(core,all){
 const everything=all.map(c=>({...c,enabled:true}));
 for(const c of all)core.validateCatalog(c.bundle,everything);
 for(const c of all.filter(c=>c.enabled))core.validateCatalog(c.bundle,all);
 const byId=new Map(all.map(c=>[c.bundle.manifest.id,c]));
 const visit=(id,stack)=>{if(stack.includes(id))throw new Error('Cyklická závislost katalogů.');for(const dep of byId.get(id)?.bundle.manifest.dependencies??[])visit(dep.id,[...stack,id]);};
 for(const id of byId.keys())visit(id,[]);
}
function transaction(fn){const db=openDatabase();db.exec('BEGIN IMMEDIATE');try{const result=fn(db);db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}
function remember(db,c){db.prepare('INSERT INTO catalog_versions(catalog_id,digest,payload,source,saved_at) VALUES(?,?,?,?,?)').run(c.bundle.manifest.id,c.digest,JSON.stringify(c.bundle),c.source?JSON.stringify(c.source):null,now());db.prepare('DELETE FROM catalog_versions WHERE catalog_id=? AND id NOT IN (SELECT id FROM catalog_versions WHERE catalog_id=? ORDER BY id DESC LIMIT 10)').run(c.bundle.manifest.id,c.bundle.manifest.id);}
function persist(db,c,previous){
 if(previous)remember(db,previous);
 db.prepare('INSERT INTO catalogs(id,kind,enabled,revision,digest,payload,source,installed_at,checked_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,revision=excluded.revision,digest=excluded.digest,payload=excluded.payload,source=excluded.source,checked_at=excluded.checked_at,updated_at=excluded.updated_at').run(c.bundle.manifest.id,c.kind,Number(c.enabled),(previous?.revision??0)+1,c.digest,JSON.stringify(c.bundle),c.source?JSON.stringify(c.source):null,c.installedAt??now(),c.checkedAt??null,previous?.digest===c.digest?previous.updatedAt:now());
}
function checkRevision(previous,expected){if((previous?.revision??null)!==expected)throw new Error('Katalog se mezitím změnil. Připrav nový návrh.');}
function assetQuota(db,assets){if(db.prepare('SELECT count(*) n FROM catalog_assets').get().n+assets.filter(a=>!db.prepare('SELECT digest FROM catalog_assets WHERE digest=?').get(a.digest)).length>4096)throw new Error('Knihovna podporuje nejvýše 4096 neměnných příloh.');const used=db.prepare('SELECT coalesce(sum(bytes),0) n FROM catalog_assets').get().n;const fresh=assets.filter(a=>!db.prepare('SELECT digest FROM catalog_assets WHERE digest=?').get(a.digest));if(used+fresh.reduce((n,a)=>n+a.bytes,0)>128_000_000)throw new Error('Přílohy knihovny překračují limit 128 MB.');for(const a of fresh)db.prepare('INSERT OR IGNORE INTO catalog_assets VALUES(?,?,?)').run(a.digest,a.bytes,a.mime);}
export function catalogUsage(id){
 const usages=[];
 for(const row of openDatabase().prepare('SELECT id,data FROM rooms').all()){
  const game=JSON.parse(row.data),pins=game.contentLibrary?.entries??[],refs=[];
  for(const m of game.monsters??[])if(m.templateId?.startsWith(id+':'))refs.push(['bestiary',m.templateId]);
  const maps=[game.dungeon,...(game.mapHistory??[]),...(game.atlas?.levels.flatMap(l=>[l.map,l.memory,...l.history])??[])].filter(Boolean);
  for(const map of maps)for(const p of [...(map.scenery??[]),...(map.surfaces??[])])if(p.kind.startsWith(id+':'))refs.push(['scenery',p.kind]);
  if(refs.length||pins.some(p=>p.catalogId===id))usages.push({room:row.id,preserved:refs.every(([type,ref])=>pins.some(p=>p.type===type&&p.catalogId===id&&p.data.id===ref.slice(id.length+1)))});
 }
 return usages;
}
export async function listCatalogs(){
 const {builtinCatalog}=await core();return [builtinCatalog,...rows()].map(c=>({...c,bundle:undefined,manifest:c.bundle.manifest,counts:Object.fromEntries(Object.entries(c.bundle.entries).map(([k,v])=>[k,v.length])),usage:c.kind==='builtin'?[]:catalogUsage(c.bundle.manifest.id)}));
}
export async function viewCatalog(id){const c=id==='builtin'?(await core()).builtinCatalog:requireCatalog(id);return {...c,usage:id==='builtin'?[]:catalogUsage(id),history:id==='builtin'?[]:openDatabase().prepare('SELECT id,digest,saved_at FROM catalog_versions WHERE catalog_id=? ORDER BY id DESC').all(id)};}
export async function createCatalog(manifest){
 const api=await core(),bundle=api.validateCatalog({manifest,entries:api.emptyEntries(),assets:[]},rows());
 transaction(db=>{if(rows(db).some(c=>c.bundle.manifest.id===bundle.manifest.id))throw new Error('ID katalogu již existuje.');if(rows(db).length>=16)throw new Error('Knihovna podporuje nejvýše 16 místních katalogů.');persist(db,{kind:'local',enabled:true,bundle,digest:bundleDigest(bundle)},null);});return viewCatalog(bundle.manifest.id);
}
async function saveLocal(id,expected,change){
 const api=await core();return transaction(db=>{
  const previous=writable(id,expected),next=clone(previous);change(next,api);next.bundle=api.catalogBundleSchema.parse(next.bundle);next.digest=bundleDigest(next.bundle);
  validateLibrary(api,rows(db).map(c=>c.bundle.manifest.id===id?next:c));assetQuota(db,next.bundle.assets);persist(db,next,previous);return {ok:true,revision:previous.revision+1};
 });
}
export async function editManifest(id,expected,manifest){return saveLocal(id,expected,next=>{if(manifest.id!==id)throw new Error('Interní ID katalogu je neměnné.');next.bundle.manifest=manifest;});}
export async function editEntry({id,expectedRevision,type,entry,originalId,remove=false,validateOnly=false}){
 const api=await core();if(!api.catalogTypes.includes(type))throw new Error('Neznámý typ položky.');
 const change=next=>{
  const entries=next.bundle.entries[type],index=entries.findIndex(e=>e.id===originalId);
  if(originalId&&index<0)throw new Error('Položka neexistuje.');
  if(remove){
   if(!originalId)throw new Error('Vyber položku k odstranění.');
   for(const row of openDatabase().prepare('SELECT data FROM rooms').all())if(JSON.parse(row.data).contentLibrary?.entries.some(p=>p.catalogId===id&&p.type===type&&p.data.id===originalId))throw new Error('Položku používá kampaň. Zachovej ji v katalogu nebo vytvoř novou variantu.');
   entries.splice(index,1);delete next.bundle.manifest.fileLicenses[`${type}/${originalId}.json`];if(next.bundle.manifest.attributions)delete next.bundle.manifest.attributions[`${type}/${originalId}.json`];return;
  }
  const value=api.entrySchemas[type].parse(entry);
  if(originalId&&value.id!==originalId)throw new Error('ID existující položky neměň; použij Duplikovat.');
  if(index<0&&entries.some(e=>e.id===value.id))throw new Error('Položka s tímto ID již existuje.');
  if(index<0)entries.push(value);else entries[index]=value;
 };
 if(validateOnly){const next=clone(writable(id,expectedRevision));change(next);api.validateCatalog(next.bundle,rows());return {valid:true,entry:api.entrySchemas[type].parse(entry)};}
 return saveLocal(id,expectedRevision,change);
}
export async function copyEntry({sourceId,targetId,type,itemId,newId,expectedRevision}){
 const api=await core(),source=sourceId==='builtin'?api.builtinCatalog:requireCatalog(sourceId);
 if(!api.catalogTypes.includes(type))throw new Error('Neznámý typ položky.');
 const original=source.bundle.entries[type].find(e=>e.id===itemId);if(!original)throw new Error('Položka neexistuje.');
 return saveLocal(targetId,expectedRevision,next=>{
  const entry=clone(original);entry.id=newId;
  if(next.bundle.entries[type].some(e=>e.id===newId))throw new Error('ID kopie již existuje.');
  const explicit=ref=>{const qualified=api.referenceInCatalog(ref,sourceId),[owner,local]=api.splitReference(qualified);if(owner!==targetId&&!next.bundle.manifest.dependencies.some(d=>d.id===owner)){const dependency=owner==='builtin'?api.builtinCatalog:requireCatalog(owner);next.bundle.manifest.dependencies.push({id:owner,minVersion:dependency.bundle.manifest.version});}return `${owner}:${local}`;};
  if(type==='adventures'){entry.dungeonPreset=explicit(entry.dungeonPreset);for(const room of entry.rooms)if(room.monsters)room.monsters=room.monsters.map(explicit);}
  if(type==='bestiary'){
   if(sourceId==='builtin')entry.portrait=`builtin:${entry.portrait??itemId}`;
   else if(!entry.portrait?.startsWith('builtin:')){
    const asset=source.bundle.assets.find(a=>a.path===`images/${entry.portrait??itemId}.webp`);
    if(asset){entry.portrait=newId;const path=`images/${newId}.webp`;if(next.bundle.assets.some(a=>a.path===path))throw new Error('Pro kopii zvol jiné ID obrázku.');next.bundle.assets.push({...asset,path});}
   }
  }
  const originalPath=`${type}/${itemId}.json`,copiedPath=`${type}/${newId}.json`;
  next.bundle.manifest.fileLicenses[copiedPath]=source.bundle.manifest.fileLicenses[originalPath]??source.bundle.manifest.license;
  next.bundle.manifest.attributions??={};next.bundle.manifest.attributions[copiedPath]=source.bundle.manifest.attributions?.[originalPath]??{author:source.bundle.manifest.author,source:`${sourceId}@${source.bundle.manifest.version}`};
  if(type==='bestiary'&&entry.portrait===newId){const copiedImage=`images/${newId}.webp`,originalImage=`images/${original.portrait??itemId}.webp`;next.bundle.manifest.fileLicenses[copiedImage]=source.bundle.manifest.fileLicenses[originalImage]??source.bundle.manifest.license;next.bundle.manifest.attributions[copiedImage]=source.bundle.manifest.attributions?.[originalImage]??{author:source.bundle.manifest.author,source:`${sourceId}@${source.bundle.manifest.version}`};}
  next.bundle.entries[type].push(entry);
 });
}
export async function uploadImage(id,expectedRevision,portrait,bytes){
 const api=await core();api.inspectCatalogWebp(bytes);if(!/^[a-z][a-z0-9-]{0,49}$/.test(portrait))throw new Error('Neplatné ID obrázku.');
 writable(id,expectedRevision);const digest=hashBytes(bytes);transaction(db=>assetQuota(db,[{digest,bytes:bytes.length,mime:'image/webp'}]));await saveAsset(digest,bytes);
 return saveLocal(id,expectedRevision,next=>{const path=`images/${portrait}.webp`;next.bundle.assets=next.bundle.assets.filter(a=>a.path!==path);next.bundle.assets.push({path,digest,bytes:bytes.length,mime:'image/webp'});});
}
export async function setCatalogEnabled(id,expectedRevision,enabled){
 if(typeof enabled!=='boolean')throw new Error('Neplatný stav katalogu.');const api=await core();
 return transaction(db=>{const previous=requireCatalog(id);checkRevision(previous,expectedRevision);const next={...previous,enabled};validateLibrary(api,rows(db).map(c=>c.bundle.manifest.id===id?next:c));if(!enabled&&catalogUsage(id).some(u=>!u.preserved))throw new Error('Některá kampaň nemá zachované podklady. Katalog nelze zakázat.');persist(db,next,previous);return {ok:true};});
}
export async function removeCatalog(id,expectedRevision,preserveCampaigns){
 return transaction(db=>{const c=requireCatalog(id);checkRevision(c,expectedRevision);if(rows(db).some(other=>other.bundle.manifest.dependencies.some(d=>d.id===id)))throw new Error('Na katalogu závisejí další katalogy.');const usage=catalogUsage(id);if(usage.some(u=>!u.preserved)||usage.length&&!preserveCampaigns)throw new Error('Potvrď zachování připnutých kopií v kampaních; neúplné podklady odstranění blokují.');db.prepare('DELETE FROM catalogs WHERE id=?').run(id);db.prepare('DELETE FROM catalog_versions WHERE catalog_id=?').run(id);return {ok:true,preservedCampaigns:usage.length};});
}
function prunePreviews(){for(const [key,value]of previews)if(value.expires<Date.now())previews.delete(key);}
export async function prepareCatalogImport(bytes,{source,updateId}={}){
 const api=await core(),prepared=await unpackCatalog(bytes,api,rows()),id=prepared.bundle.manifest.id,previous=rows().find(c=>c.bundle.manifest.id===id);
 if(updateId){if(id!==updateId||previous?.kind!=='community'||previous.source?.repository!==source?.repository)throw new Error('Aktualizace musí patřit původnímu komunitnímu zdroji.');if(api.compareVersions(prepared.bundle.manifest.version,previous.bundle.manifest.version)<0)throw new Error('Starší verzi instaluj pouze návratem historie.');}
 else if(previous)throw new Error('Katalog s tímto ID již existuje. Vytvoř vlastní kopii nebo použij aktualizaci zdroje.');
 const old=new Map(Object.entries(previous?.bundle.entries??{}).flatMap(([type,entries])=>entries.map(e=>[`${type}/${e.id}`,JSON.stringify(e)]))),fresh=new Map(Object.entries(prepared.bundle.entries).flatMap(([type,entries])=>entries.map(e=>[`${type}/${e.id}`,JSON.stringify(e)])));
 const items={added:[...fresh.keys()].filter(k=>!old.has(k)),changed:[...fresh.keys()].filter(k=>old.has(k)&&fresh.get(k)!==old.get(k)),removed:[...old.keys()].filter(k=>!fresh.has(k))};
 const diff=Object.fromEntries(Object.entries(items).map(([key,value])=>[key,value.length]));
 const dependencies=prepared.bundle.manifest.dependencies.filter(d=>!previous?.bundle.manifest.dependencies.some(p=>p.id===d.id&&p.minVersion===d.minVersion));
 const summary={manifest:prepared.bundle.manifest,digest:prepared.digest,source,currentVersion:previous?.bundle.manifest.version,currentRevision:previous?.revision,currentDigest:previous?.digest,currentSource:previous?.source,diff,items,newDependencies:dependencies,counts:Object.fromEntries(Object.entries(prepared.bundle.entries).map(([k,v])=>[k,v.length])),preservedCampaigns:updateId?catalogUsage(id).length:0};
 if(updateId&&prepared.digest===previous.digest)return {...summary,upToDate:true};
 if(updateId&&catalogUsage(id).some(u=>!u.preserved))throw new Error('Nejdřív zachovej podklady existujících kampaní.');
 prunePreviews();if(previews.size>=2)throw new Error('Dokonči nebo zahoď předchozí návrh importu.');
 const token=crypto.randomUUID();previews.set(token,{...prepared,source,previousRevision:previous?.revision??null,expires:Date.now()+5*60e3});
 return {...summary,token,upToDate:false};
}
export function discardImport(token){previews.delete(token);return {ok:true};}
export async function installPrepared(token){
 prunePreviews();const prepared=previews.get(token);if(!prepared)throw new Error('Náhled vypršel. Připrav nový import.');const api=await core();
 transaction(db=>assetQuota(db,prepared.bundle.assets));
 for(const [digest,bytes]of prepared.images)await saveAsset(digest,bytes);
 const result=transaction(db=>{
  const all=rows(db),id=prepared.bundle.manifest.id,previous=all.find(c=>c.bundle.manifest.id===id);checkRevision(previous,prepared.previousRevision);
  if(previous&&catalogUsage(id).some(u=>!u.preserved))throw new Error('Kampaň nemá zachované podklady; aktualizace je blokována.');
  if(previous?.kind==='local')throw new Error('Vlastní katalog nelze přepsat importem.');if(!previous&&all.length>=16)throw new Error('Knihovna podporuje nejvýše 16 místních katalogů.');
  const next={bundle:prepared.bundle,digest:prepared.digest,source:prepared.source,kind:'community',enabled:previous?.enabled??true,installedAt:previous?.installedAt??now(),checkedAt:now()};
  validateLibrary(api,[...all.filter(c=>c!==previous),next]);assetQuota(db,next.bundle.assets);persist(db,next,previous);return {ok:true,id};
 });previews.delete(token);return result;
}
export async function exportCatalog(id){if(id==='builtin')throw new Error('Zkopíruj vybrané položky do vlastního katalogu.');return packCatalog(requireCatalog(id).bundle,digest=>catalogFiles.read(digest));}
export async function rollbackCatalog(id,expectedRevision,historyId){
 const api=await core();return transaction(db=>{const previous=requireCatalog(id);checkRevision(previous,expectedRevision);const history=db.prepare('SELECT * FROM catalog_versions WHERE catalog_id=? AND id=?').get(id,historyId);if(!history)throw new Error('Bod návratu neexistuje.');const next={...previous,bundle:JSON.parse(history.payload),digest:history.digest,source:history.source?JSON.parse(history.source):undefined};validateLibrary(api,rows(db).map(c=>c.bundle.manifest.id===id?next:c));persist(db,next,previous);return {ok:true};});
}
