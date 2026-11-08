import {readFileSync,writeFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const extension=['','.ts','.tsx','.mjs','.js','/index.ts','/index.tsx'];
const files=dir=>readdirSync(dir).flatMap(name=>{const file=path.join(dir,name);return statSync(file).isDirectory()?files(file):[file];});
const seen=new Set(),packages=new Set();
function visit(file){
 if(seen.has(file)||!existsSync(file))return;seen.add(file);
 const text=readFileSync(file,'utf8');
 for(const imported of ts.preProcessFile(text,true,true).importedFiles){
  const name=imported.fileName;
  if(name.startsWith('.')||name.startsWith('@/')){
   const base=name.startsWith('@/')?name.slice(2):path.join(path.dirname(file),name);
   const target=extension.map(e=>base+e).find(f=>existsSync(f)&&statSync(f).isFile());
   if(target&&!target.startsWith('dist/'))visit(target);
  }else packages.add(name.startsWith('@')?name.split('/').slice(0,2).join('/'):name.split('/')[0]);
 }
}
const roots=[...files('app').filter(f=>/\.[cm]?[jt]sx?$/.test(f)),'server/start.mjs','deploy/updater/start.mjs','worker/index.ts','vite.config.ts'];roots.forEach(visit);
const ui=files('components/ui').filter(f=>/\.[jt]sx?$/.test(f));
const css=readFileSync('app/globals.css','utf8');
const selectors=new Map();for(const match of css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)){const selector=match[1].trim();if(!selector.startsWith('@'))selectors.set(selector,(selectors.get(selector)??0)+1);}
const report={scope:'Static literal import graph from app/server/worker/build entry points; optional registry consumers and generated imports need separate review.',roots,reachableModules:seen.size,ui:{total:ui.length,reachable:ui.filter(f=>seen.has(f)),notReachable:ui.filter(f=>!seen.has(f))},dependenciesWithoutReachableImport:Object.keys(JSON.parse(readFileSync('package.json','utf8')).dependencies).filter(p=>!packages.has(p)),css:{bytes:Buffer.byteLength(css),important:(css.match(/!important/g)||[]).length,repeatedSelectors:[...selectors].filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([selector,count])=>({selector,count}))}};
writeFileSync('docs/performance/maintainability.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({reachableModules:seen.size,uiTotal:ui.length,uiReachable:report.ui.reachable,css:report.css}));
