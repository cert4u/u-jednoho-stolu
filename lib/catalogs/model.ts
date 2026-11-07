import {inspectCatalogWebp} from './images';
import { z } from 'zod';
import { contentId,contentReference } from '../content-schema';
import { bestiaryEntrySchema } from '../bestiary';
import { presetSchema } from '../dungeon-presets';
import { adventureDataSchema } from '../adventure-templates';
import { sceneryEntrySchema } from '../scenery-catalog';
export const catalogTypes=['bestiary','dungeon-presets','adventures','scenery'] as const;
export const catalogTypeSchema=z.enum(catalogTypes);
export type CatalogType=typeof catalogTypes[number];
export const versionSchema=z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/).max(32);
export function compareVersions(a:string,b:string){const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return Math.sign(x[i]-y[i]);return 0;}
export const digestSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const imagePathSchema=z.string().regex(/^images\/[a-z][a-z0-9-]{0,49}\.webp$/);
export const licensePathSchema=z.string().regex(/^(?:(?:bestiary|dungeon-presets|adventures|scenery)\/[a-z][a-z0-9-]{0,49}\.json|images\/[a-z][a-z0-9-]{0,49}\.webp)$/);
export const manifestSchema=z.object({
  schemaVersion:z.literal(1),id:contentId,name:z.string().trim().min(1).max(100),version:versionSchema,
  author:z.string().trim().min(1).max(100),license:z.string().trim().min(1).max(100),
  description:z.string().max(2000).default(''),minAppVersion:versionSchema,
  dependencies:z.array(z.object({id:contentId,minVersion:versionSchema}).strict()).max(16).default([]),
  attributions:z.record(licensePathSchema,z.object({author:z.string().max(100),source:z.string().max(300)}).strict()).optional(),
  fileLicenses:z.record(licensePathSchema,z.string().trim().min(1).max(150)).default({}),
}).strict().superRefine((m,ctx)=>{
  if(new Set(m.dependencies.map(d=>d.id)).size!==m.dependencies.length||m.dependencies.some(d=>d.id===m.id))ctx.addIssue({code:'custom',path:['dependencies'],message:'Závislosti musí být jedinečné a nesmějí odkazovat na vlastní katalog.'});
});
export const entrySchemas={'bestiary':bestiaryEntrySchema,'dungeon-presets':presetSchema,'adventures':adventureDataSchema,'scenery':sceneryEntrySchema};
export type CategoryData={ [K in CatalogType]:z.infer<(typeof entrySchemas)[K]> };
export const catalogBundleSchema=z.object({
  manifest:manifestSchema,
  entries:z.object({bestiary:z.array(bestiaryEntrySchema).max(200),'dungeon-presets':z.array(presetSchema).max(32),adventures:z.array(adventureDataSchema).max(50),scenery:z.array(sceneryEntrySchema).max(200)}).strict(),
  documents:z.record(z.string().regex(/^(README\.md|LICENSE|LICENSE\.txt|\.gitignore)$/),z.string().max(64000)).default({}),
  assets:z.array(z.object({path:imagePathSchema,digest:digestSchema,bytes:z.number().int().min(20).max(1_500_000),mime:z.literal('image/webp')}).strict()).max(200).default([]),
}).strict().superRefine((b,ctx)=>{
  for(const type of catalogTypes)if(new Set(b.entries[type].map(e=>e.id)).size!==b.entries[type].length)ctx.addIssue({code:'custom',path:['entries',type],message:'Duplicitní ID položky.'});
  if(new Set(b.assets.map(a=>a.path)).size!==b.assets.length)ctx.addIssue({code:'custom',path:['assets'],message:'Duplicitní cesta obrázku.'});
  for(const file of new Set([...Object.keys(b.manifest.fileLicenses),...Object.keys(b.manifest.attributions??{})])){
    const [type,name]=file.split('/');
    const exists=type==='images'?b.assets.some(a=>a.path===file):(catalogTypes as readonly string[]).includes(type)&&b.entries[type as CatalogType].some(e=>e.id===name.slice(0,-5));
    if(!exists)ctx.addIssue({code:'custom',path:['manifest','fileLicenses',file],message:'Licence nebo atribuce odkazuje na chybějící soubor.'});
  }
});
export type CatalogBundle=z.infer<typeof catalogBundleSchema>;
export type CatalogSource={repository:string;commit:string};
export type InstalledCatalog={bundle:CatalogBundle;digest:string;kind:'local'|'community'|'builtin';enabled:boolean;revision:number;source?:CatalogSource;installedAt?:string};
export const emptyEntries=():CatalogBundle['entries']=>({bestiary:[],'dungeon-presets':[],adventures:[],scenery:[]});
export function catalogReference(catalogId:string,localId:string){return catalogId==='builtin'?localId:`${catalogId}:${localId}`;}
export function splitReference(value:string):[string,string]{const parts=value.split(':');return parts.length===1?['builtin',value]:[parts[0],parts[1]];}
export function referenceInCatalog(value:string,catalogId:string){return value.includes(':')?catalogReference(...splitReference(value)):catalogReference(catalogId,value);}
export const pinnedEntrySchema=z.object({catalogId:contentId,version:versionSchema,digest:digestSchema,type:catalogTypeSchema,data:z.unknown()}).strict().superRefine((entry,ctx)=>{
  const result=entrySchemas[entry.type].safeParse(entry.data);
  if(!result.success)for(const issue of result.error.issues)ctx.addIssue({code:'custom',path:['data',...issue.path],message:issue.message});
});
export const campaignCatalogSchema=z.object({
  entries:z.array(pinnedEntrySchema).max(512),
  images:z.record(digestSchema,z.object({data:z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/).max(2_000_000),mime:z.literal('image/webp')}).strict()).default({}),
  portraits:z.record(contentReference,digestSchema).default({}),
}).strict().superRefine((content,ctx)=>{
  const ids=content.entries.map(e=>`${e.type}/${e.catalogId}/${(e.data as {id?:unknown})?.id}`);
  if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Duplicitní připnutá položka.'});
  if(JSON.stringify(content).length>2_400_000)ctx.addIssue({code:'custom',message:'Připnuté katalogy kampaně překračují 2,4 MB.'});
  for(const image of Object.values(content.images))try{const bytes=Uint8Array.from(atob(image.data),c=>c.charCodeAt(0));inspectCatalogWebp(bytes);}catch{ctx.addIssue({code:'custom',path:['images'],message:'Neplatný přenositelný obrázek.'});}
  for(const [ref,digest]of Object.entries(content.portraits))if(!content.images[digest])ctx.addIssue({code:'custom',path:['portraits',ref],message:'Chybí přenositelný obrázek.'});
});
export type CampaignCatalog=z.infer<typeof campaignCatalogSchema>;
export async function sha256(data:Uint8Array|string){const bytes=typeof data==='string'?new TextEncoder().encode(data):data;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('');}
