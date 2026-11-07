import {prepareCatalogImport} from './catalog-store.mjs';
import {openDatabase} from './database.mjs';
export function githubRepository(value){
 let url;try{url=new URL(value);}catch{throw new Error('Zadej veřejný repozitář https://github.com/autor/katalog.');}
 const path=url.pathname.replace(/\/$/,'').replace(/\.git$/,'');
 if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password||url.search||url.hash||!/^\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(path)||['.','..'].includes(path.split('/')[2]))throw new Error('Podporované jsou pouze veřejné repozitáře na github.com bez dalších cest.');
 return {slug:path.slice(1).toLowerCase(),repository:'https://github.com'+path.toLowerCase()};
}
export async function fetchCatalogBytes(url,max,fetchImpl=fetch,accept='application/vnd.github+json'){
 const target=new URL(url);
 if(target.protocol!=='https:'||target.username||target.password||target.port||!['api.github.com','codeload.github.com'].includes(target.hostname))throw new Error('Nepovolený distribuční server.');
 let response;
 try{response=await fetchImpl(target.href,{headers:{Accept:accept,'User-Agent':'U-jednoho-stolu-catalog-library'},redirect:'manual',signal:AbortSignal.timeout(18_000)});}catch{throw new Error('GitHub není dostupný. Místní knihovna zůstává beze změny.');}
 if(response.status!==200)throw new Error(response.status>=300&&response.status<400?'Přesměrování GitHubu není povolené; ověř přesnou adresu repozitáře.':`GitHub nevrátil obsah (${response.status}). Katalog musí být veřejný; ověř také limit požadavků.`);
 if(Number(response.headers.get('content-length'))>max)throw new Error('Stažený obsah překračuje velikostní limit.');
 const reader=response.body?.getReader();if(!reader)throw new Error('GitHub vrátil prázdný obsah.');
 let size=0;const parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error('Stažený obsah překračuje velikostní limit.');parts.push(Buffer.from(value));}}catch(error){await reader.cancel().catch(()=>{});throw error;}
 return Buffer.concat(parts);
}
export async function downloadGithubCatalog(repository,ref='HEAD',fetchImpl=fetch){
 const source=githubRepository(repository);
 if(typeof ref!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/.test(ref)||ref.split('/').some(p=>p==='.'||p==='..'))throw new Error('Neplatná revize nebo tag.');
 const metadata=JSON.parse((await fetchCatalogBytes(`https://api.github.com/repos/${source.slug}/commits/${encodeURIComponent(ref)}`,2_000_000,fetchImpl)).toString('utf8'));
 if(!/^[a-f0-9]{40}$/.test(metadata.sha??''))throw new Error('GitHub nevrátil konkrétní commit.');
 const bytes=await fetchCatalogBytes(`https://codeload.github.com/${source.slug}/zip/${metadata.sha}`,40_000_000,fetchImpl,'application/zip');
 return {bytes,source:{repository:source.repository,commit:metadata.sha}};
}
export async function prepareGithubCatalog({repository,ref,updateId},fetchImpl=fetch){
 const download=await downloadGithubCatalog(repository,ref||'HEAD',fetchImpl);
 const result=await prepareCatalogImport(download.bytes,{source:download.source,updateId});
 if(updateId)openDatabase().prepare('UPDATE catalogs SET checked_at=? WHERE id=?').run(new Date().toISOString(),updateId);
 return result;
}
export async function recommendedCatalogs(fetchImpl=fetch){
 const bytes=await fetchCatalogBytes('https://api.github.com/repos/cert4u/u-jednoho-stolu/contents/content/community-catalogs.json',64_000,fetchImpl);
 const response=JSON.parse(bytes.toString('utf8'));
 if(response.encoding!=='base64'||typeof response.content!=='string'||response.content.length>48_000)throw new Error('Doporučený seznam není dostupný ve známém formátu.');
 const list=JSON.parse(Buffer.from(response.content,'base64').toString('utf8'));
 if(!Array.isArray(list)||list.length>50)throw new Error('Neplatný doporučený seznam.');
 return list.map(item=>{
  if(!item||typeof item.id!=='string'||!/^[a-z][a-z0-9-]{0,49}$/.test(item.id)||typeof item.name!=='string'||item.name.length>100||typeof item.author!=='string'||item.author.length>100)throw new Error('Neplatný záznam doporučeného seznamu.');
  return {id:item.id,name:item.name,author:item.author,repository:githubRepository(item.repository).repository};
 });
}
