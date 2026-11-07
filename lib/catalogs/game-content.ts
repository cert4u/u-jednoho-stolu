import type {Game,Member} from '../game';
import type {Dungeon} from '../dungeon';
import {getLevel} from '../exploration';
import {dungeonFor} from '../dungeon';
import {proposeScenery,sceneryFillBlocked} from '../scenery-fill';
import {sceneryCatalog,type SceneryDefinition} from '../scenery-catalog';
import {CatalogResolver,pinContent} from './resolver';
import {loadCatalogs,catalogFileAdapter} from './runtime';
import {MAX_BACKUP_BYTES,makeBackup} from '../backup';
export function resolvedScenery(library?:CatalogResolver):SceneryDefinition[]{return library?library.list('scenery').map(row=>({...row.data,kind:row.ref})):sceneryCatalog;}
/** Read only pinned visual data in normal game polling; never ship the private library. */
export function campaignVisuals(g:Game,map:Dungeon){
 const used=new Set([...(map.scenery??[]).map(p=>p.kind),...(map.surfaces??[]).map(p=>p.kind)]);
 if(!g.contentLibrary)return [];
 return resolvedScenery(new CatalogResolver([],g.contentLibrary)).filter(e=>used.has(e.id));
}
export async function prepareActionCatalog(g:Game,actor:Member,b:Record<string,unknown>):Promise<CatalogResolver|undefined>{
 if(actor.role!=='pj')return;
 const targets:[Parameters<CatalogResolver['get']>[0],string][]=[];
 const mapAction=b.action==='map'&&['scenery','surface','scenery-fill'].includes(String(b.tool));
 if(b.action==='monster'&&b.op==='create'&&typeof b.templateId==='string')targets.push(['bestiary',b.templateId]);
 if(b.action==='create'&&typeof b.adventureId==='string')targets.push(['adventures',b.adventureId]);
 if(b.action==='generate'&&typeof b.catalogPresetId==='string')targets.push(['dungeon-presets',b.catalogPresetId]);
 if(!targets.length&&!mapAction)return;
 const library=await loadCatalogs(g.contentLibrary);
 if(mapAction){
  if(b.tool==='scenery-fill'){
   const map=g.atlas?getLevel(g.atlas,b.levelId).map:dungeonFor(g);
   for(const item of proposeScenery(map,sceneryFillBlocked(g,b.levelId),b.options,resolvedScenery(library)))targets.push(['scenery',item.kind]);
  }else if((b.tool==='surface'&&b.op==='add'||b.tool==='scenery'&&b.op==='save')&&typeof b.kind==='string'&&library.get('scenery',b.kind))targets.push(['scenery',b.kind]);
 }
 for(const [type,ref]of targets)g.contentLibrary=await pinContent(g.contentLibrary,library,type,ref,catalogFileAdapter());
 if(new TextEncoder().encode(JSON.stringify(makeBackup(g))).length>MAX_BACKUP_BYTES)throw new Error('Použité podklady by překročily limit úplné zálohy kampaně. Zmenši obrázky katalogu.');
 return new CatalogResolver(library.catalogs.filter(c=>c.kind!=='builtin'),g.contentLibrary);
}
export function portraitForCatalog(library:CatalogResolver,ref:string,snapshot?:Game['contentLibrary']){
 const pinned=snapshot?.portraits[ref],image=pinned?snapshot?.images[pinned]:undefined;
 if(image)return `data:image/webp;base64,${image.data}`;
 const entry=library.get('bestiary',ref);if(!entry)return;
 if(entry.catalogId==='builtin')return entry.data.portrait??entry.data.id;
 if(entry.data.portrait?.startsWith('builtin:'))return entry.data.portrait.slice(8);
 const source=library.source(ref),local=entry.ref.split(':').at(-1);
 const asset=source?.bundle.assets.find(a=>a.path===`images/${entry.data.portrait??local}.webp`);
 return asset?`/catalog-assets/${asset.digest}.webp`:undefined;
}
