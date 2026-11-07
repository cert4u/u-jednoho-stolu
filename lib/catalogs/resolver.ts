import {generateDungeon} from '../dungeon-generator';
import {resolveAdventureRooms} from '../adventure-templates';
import {builtinCatalog} from './builtin';
import {catalogTypes,catalogReference,referenceInCatalog,splitReference,compareVersions,catalogBundleSchema,sha256,campaignCatalogSchema,type CatalogBundle,type InstalledCatalog,type CatalogType,type CategoryData,type CampaignCatalog} from './model';
export type ResolvedEntry<T extends CatalogType=CatalogType>={ref:string;catalogId:string;version:string;digest:string;data:CategoryData[T]};
export class CatalogResolver{
  readonly catalogs:InstalledCatalog[];
  private index=new Map<string,ResolvedEntry>();
  constructor(installed:InstalledCatalog[]=[],pinned?:CampaignCatalog){
    this.catalogs=[builtinCatalog,...installed.filter(c=>c.enabled)];
    for(const catalog of this.catalogs)for(const type of catalogTypes)for(const data of catalog.bundle.entries[type])this.add(type,catalog.bundle.manifest.id,catalog.bundle.manifest.version,catalog.digest,data);
    for(const entry of pinned?.entries??[])this.add(entry.type,entry.catalogId,entry.version,entry.digest,entry.data as CategoryData[CatalogType]);
  }
  private add(type:CatalogType,catalogId:string,version:string,digest:string,raw:CategoryData[CatalogType]){
    const data=structuredClone(raw),ref=catalogReference(catalogId,data.id);data.id=ref;
    if(type==='adventures'){
      const a=data as CategoryData['adventures'];a.dungeonPreset=referenceInCatalog(a.dungeonPreset,catalogId);
      for(const room of a.rooms)if(room.monsters)room.monsters=room.monsters.map(id=>referenceInCatalog(id,catalogId));
    }
    this.index.set(`${type}/${ref}`,{ref,catalogId,version,digest,data});
  }
  get<T extends CatalogType>(type:T,id:unknown):ResolvedEntry<T>|undefined{
    if(typeof id!=='string')return;const ref=catalogReference(...splitReference(id));return this.index.get(`${type}/${ref}`) as ResolvedEntry<T>|undefined;
  }
  list<T extends CatalogType>(type:T,environment?:string):ResolvedEntry<T>[]{
    return [...this.index.entries()].filter(([k,e])=>k.startsWith(type+'/')&&(!environment||!('environments' in e.data)||(e.data as CategoryData['scenery']).environments.includes(environment as 'cave'))).map(([,e])=>e as ResolvedEntry<T>);
  }
  source(ref:string){const [id]=splitReference(ref);return this.catalogs.find(c=>c.bundle.manifest.id===id);}
}
export function validateCatalog(raw:unknown,installed:InstalledCatalog[]=[],appVersion=builtinCatalog.bundle.manifest.version):CatalogBundle{
  const result=catalogBundleSchema.safeParse(raw);
  if(!result.success)throw new Error(result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('\n'));
  const bundle=result.data,m=bundle.manifest;
  if(m.id==='builtin')throw new Error('ID builtin je vyhrazené vestavěnému katalogu.');
  if(compareVersions(m.minAppVersion,appVersion)>0)throw new Error(`Katalog vyžaduje aplikaci ${m.minAppVersion}.`);
  const available=[builtinCatalog,...installed.filter(c=>c.enabled&&c.bundle.manifest.id!==m.id)];
  for(const dep of m.dependencies){const found=available.find(c=>c.bundle.manifest.id===dep.id);if(!found||compareVersions(found.bundle.manifest.version,dep.minVersion)<0)throw new Error(`Chybí závislost ${dep.id} >= ${dep.minVersion}.`);}
  const resolver=new CatalogResolver([...available.filter(c=>c.kind!=='builtin'),{bundle,digest:'0'.repeat(64),kind:'local',enabled:true,revision:0}]);
  const checkRef=(type:CatalogType,id:string)=>{
    const ref=referenceInCatalog(id,m.id),[owner]=splitReference(ref);
    if(owner!==m.id&&!m.dependencies.some(d=>d.id===owner))throw new Error(`Odkaz ${id} vyžaduje deklarovanou závislost ${owner}.`);
    if(!resolver.get(type,ref))throw new Error(`Neexistující odkaz ${type}/${ref}.`);
  };
  for(const entry of bundle.entries.bestiary){
    if(entry.portrait?.includes(':')){
      const [owner,id]=splitReference(entry.portrait);
      if(owner!=='builtin'||!builtinCatalog.bundle.entries.bestiary.some(e=>e.id===id||e.portrait===id))throw new Error(`Neplatný vestavěný portrét ${entry.portrait}.`);
    }else if(entry.portrait&&!bundle.assets.some(a=>a.path===`images/${entry.portrait}.webp`))throw new Error(`Chybí obrázek images/${entry.portrait}.webp.`);
  }
  for(const entry of bundle.entries.adventures){
    checkRef('dungeon-presets',entry.dungeonPreset);
    for(const room of entry.rooms)for(const id of room.monsters??[])checkRef('bestiary',id);
    const resolved=resolver.get('adventures',catalogReference(m.id,entry.id))!.data;
    const preset=resolver.get('dungeon-presets',resolved.dungeonPreset)!.data;
    resolveAdventureRooms(resolved,generateDungeon(preset.options).floors);
  }
  return bundle;
}
export type CatalogFiles={read:(digest:string)=>Promise<Uint8Array>;builtin:(portrait:string)=>Promise<Uint8Array>};
export async function pinContent(current:CampaignCatalog|undefined,resolver:CatalogResolver,type:CatalogType,ref:string,files?:CatalogFiles):Promise<CampaignCatalog>{
  const snapshot=structuredClone(current??{entries:[],images:{},portraits:{}});
  const visit=async(type:CatalogType,ref:string):Promise<void>=>{
    const entry=resolver.get(type,ref);if(!entry)throw new Error(`Katalogová položka ${type}/${ref} není dostupná.`);
    const localId=splitReference(entry.ref)[1];
    if(snapshot.entries.some(p=>p.type===type&&p.catalogId===entry.catalogId&&(p.data as {id:string}).id===localId))return;
    const data=structuredClone(entry.data);data.id=localId;
    if(type==='adventures'){
      const a=data as CategoryData['adventures'];a.dungeonPreset=splitReference(a.dungeonPreset).join(':');
      for(const room of a.rooms)if(room.monsters)room.monsters=room.monsters.map(id=>splitReference(id).join(':'));
    }
    // Store normalized cross-references, so no future catalog can change their meaning.
    snapshot.entries.push({type,catalogId:entry.catalogId,version:entry.version,digest:entry.digest,data});
    if(type==='adventures'){
      const a=entry.data as CategoryData['adventures'];await visit('dungeon-presets',a.dungeonPreset);
      for(const room of a.rooms)for(const id of room.monsters??[])await visit('bestiary',id);
    }
    if(type==='bestiary'&&files){
      const item=entry.data as CategoryData['bestiary'];let bytes:Uint8Array|undefined;
      const source=resolver.source(entry.ref);
      if(entry.catalogId==='builtin')bytes=await files.builtin(item.portrait??localId);
      else if(item.portrait?.startsWith('builtin:'))bytes=await files.builtin(item.portrait.slice(8));
      else{const asset=source?.bundle.assets.find(a=>a.path===`images/${item.portrait??localId}.webp`);if(asset)bytes=await files.read(asset.digest);}
      if(bytes){const digest=await sha256(bytes);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);snapshot.images[digest]={data:btoa(binary),mime:'image/webp'};snapshot.portraits[entry.ref]=digest;}
    }
  };
  await visit(type,ref);
  return campaignCatalogSchema.parse(snapshot);
}
