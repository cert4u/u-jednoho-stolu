import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeZip} from '../server/catalog-zip.mjs';
export const demoDirectory=fileURLToPath(new URL('../examples/catalogs/abandoned-dwarf-mine/',import.meta.url));
export async function demoFiles(){
 const files=new Map();
 async function visit(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const path=resolve(directory,entry.name);
   if(entry.isDirectory())await visit(path);
   else if(entry.isFile())files.set(relative(demoDirectory,path).split(sep).join('/'),await readFile(path));
   else throw Error('Demonstrační katalog smí obsahovat pouze běžné soubory.');
  }
 }
 await visit(demoDirectory);return files;
}
if(resolve(process.argv[1]??'')===fileURLToPath(import.meta.url)){
 if(!process.argv[2])throw Error('Zadej výstupní ZIP: npm run catalog:demo -- /tmp/opusteny-trpaslici-dul.zip');
 const output=resolve(process.argv[2]);await writeFile(output,writeZip(await demoFiles()),{flag:'wx'});console.log(output);
}
