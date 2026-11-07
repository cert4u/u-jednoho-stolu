import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,rename,lstat} from 'node:fs/promises';
import path from 'node:path';
import {dataDirectory} from './database.mjs';
const digestPattern=/^[a-f0-9]{64}$/;
export function assetPath(digest){if(!digestPattern.test(digest))throw new Error('Neplatný otisk obrázku.');return path.join(dataDirectory(),'catalog-assets',digest+'.webp');}
async function regularFile(file){const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Příloha není obyčejný soubor.');return readFile(file);}
export const catalogFiles={
 async read(digest){const bytes=await regularFile(assetPath(digest));if(createHash('sha256').update(bytes).digest('hex')!==digest)throw new Error('Příloha neodpovídá svému otisku.');return bytes;},
 async builtin(portrait){
  if(!/^[a-z][a-z0-9-]{0,49}$/.test(portrait))throw new Error('Neplatný portrét.');
  for(const base of ['dist/client/monsters','public/monsters'])try{return await regularFile(path.join(base,portrait+'.webp'));}catch(error){if(error.code!=='ENOENT')throw error;}
  throw new Error('Chybí vestavěný obrázek.');
 },
};
export async function saveAsset(digest,bytes){
 const file=assetPath(digest);await mkdir(path.dirname(file),{recursive:true,mode:0o700});
 try{const old=await regularFile(file);if(!old.equals(Buffer.from(bytes)))throw new Error('Kolize nebo poškození obrázku.');return;}catch(error){if(error.code!=='ENOENT')throw error;}
 const temp=file+'.'+crypto.randomUUID()+'.tmp';await writeFile(temp,bytes,{mode:0o600,flag:'wx',flush:true});await rename(temp,file);
}
