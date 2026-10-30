import {spawnSync} from 'node:child_process';
const base=process.argv[2]||'http://127.0.0.1:5173';
const url=new URL(base);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Integrační testy spouštěj jen proti místní testovací instanci.');
for(const name of ['game','map','exploration','monsters','mechanics','initiative','conditions','powers','recovery','journey','map-notes','note-alerts','challenges','loot','equipment','repairs']){
 console.log(`\nTest: ${name}`);
 const result=spawnSync(process.execPath,['--experimental-strip-types',`scripts/test-${name}.mjs`,base],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
