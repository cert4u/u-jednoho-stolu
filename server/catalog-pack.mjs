import {createHash} from 'node:crypto';
import {readZip,writeZip} from './catalog-zip.mjs';
export const hashBytes=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export function bundleDigest(bundle){return hashBytes(JSON.stringify(stable({...bundle,assets:[...bundle.assets].sort((a,b)=>a.path.localeCompare(b.path)),entries:Object.fromEntries(Object.entries(bundle.entries).map(([k,v])=>[k,[...v].sort((a,b)=>a.id.localeCompare(b.id))]))})));}
export async function unpackCatalog(bytes,core,installed=[]){
 const files=readZip(bytes),manifests=[...files.keys()].filter(p=>p==='catalog.json'||p.endsWith('/catalog.json'));
 if(manifests.length!==1)throw new Error('Archiv musí obsahovat právě jeden catalog.json.');
 const prefix=manifests[0].slice(0,-'catalog.json'.length),entries=core.emptyEntries(),assets=[],images=new Map();let manifest;
 for(const [full,data]of files){
  if(!full.startsWith(prefix))throw new Error('Všechny soubory musí patřit do kořene katalogu.');
  const name=full.slice(prefix.length);
  if(name==='catalog.json'){
   if(data.length>64_000)throw new Error('Manifest je příliš velký.');
   manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));continue;
  }
  if(['README.md','LICENSE','LICENSE.txt','.gitignore'].includes(name)){if(data.length>64_000)throw new Error('Dokument je příliš velký.');continue;}
  const json=name.match(/^(bestiary|dungeon-presets|adventures|scenery)\/([a-z][a-z0-9-]{0,49})\.json$/);
  if(json){
   if(data.length>256_000)throw new Error('JSON položka je příliš velká.');
   const entry=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));if(entry?.id!==json[2])throw new Error('ID položky musí odpovídat názvu souboru.');entries[json[1]].push(entry);continue;
  }
  if(/^images\/[a-z][a-z0-9-]{0,49}\.webp$/.test(name)){
   core.inspectCatalogWebp(data);const digest=hashBytes(data);assets.push({path:name,digest,bytes:data.length,mime:'image/webp'});images.set(digest,data);continue;
  }
  throw new Error(`Nepovolený soubor ${name}.`);
 }
 const bundle=core.validateCatalog({manifest,entries,assets},installed);
 return {bundle,images,digest:bundleDigest(bundle)};
}
export async function packCatalog(bundle,readImage){
 const files=new Map([['catalog.json',Buffer.from(JSON.stringify(bundle.manifest,null,2)+'\n')]]);
 for(const [type,entries]of Object.entries(bundle.entries))for(const entry of entries)files.set(`${type}/${entry.id}.json`,Buffer.from(JSON.stringify(entry,null,2)+'\n'));
 for(const asset of bundle.assets){const bytes=await readImage(asset.digest);if(bytes.length!==asset.bytes||hashBytes(bytes)!==asset.digest)throw new Error('Příloha je poškozená.');files.set(asset.path,bytes);}
 return writeZip(files);
}
