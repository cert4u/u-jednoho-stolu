import {readFileSync,existsSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const result=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'});
if(result.status!==0)throw Error('Kontrola dokumentace vyžaduje Git checkout.');
const files=[...new Set(result.stdout.split('\0').filter(p=>p.endsWith('.md')&&!p.startsWith('vendor/')&&!p.startsWith('scripts/')&&!p.startsWith('node_modules/')))];
const scripts=JSON.parse(readFileSync('package.json','utf8')).scripts,errors=[],cache=new Map();let links=0;
function headings(file){if(cache.has(file))return cache.get(file);const anchors=new Set(),counts=new Map(),body=readFileSync(file,'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm,'');for(const match of body.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)){const slug=match[1].replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<[^>]*>/g,'').toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu,'').replace(/\s/g,'-');const count=counts.get(slug)||0;counts.set(slug,count+1);anchors.add(slug+(count?'-'+count:''));}for(const match of body.matchAll(/\bid=["']([^"']+)["']/g))anchors.add(match[1]);cache.set(file,anchors);return anchors;}
for(const file of files){const text=readFileSync(file,'utf8');const body=text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm,'');for(const match of body.matchAll(/\]\((<?[^\s)]+>?)(?:\s+["'][^)]*)?\)/g)){let target=match[1].replace(/^<|>$/g,'');if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target))continue;let parsed;try{parsed=target.split('#').map(decodeURIComponent);}catch{errors.push(`${file}: neplatné kódování odkazu ${target}`);continue;}const [name,fragment]=parsed;const resolved=path.resolve(path.dirname(file),name||path.basename(file));links++;if(!existsSync(resolved)){errors.push(`${file}: chybí ${target}`);continue;}if(fragment&&resolved.endsWith('.md')&&statSync(resolved).isFile()&&!headings(resolved).has(fragment))errors.push(`${file}: chybí kotva ${target}`);}
for(const match of text.matchAll(/\bnpm run ([a-zA-Z0-9][a-zA-Z0-9:_-]*)/g))if(!Object.hasOwn(scripts,match[1]))errors.push(`${file}: neexistující npm skript ${match[1]}`);
if((text.match(/^```/gm)||[]).length%2)errors.push(`${file}: neuzavřený blok kódu`);
if((text.match(/<details(?:\s[^>]*)?>/g)||[]).length!==(text.match(/<\/details>/g)||[]).length)errors.push(`${file}: neuzavřený blok details`);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`PASS: ${files.length} dokumentů, ${links} místních odkazů/kotev, npm příkazy a uzavřené bloky. Externí odkazy ani provozní příkazy se nespouštějí.`);
