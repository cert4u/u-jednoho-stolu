import {spawnSync} from 'node:child_process';
const base=process.argv[2]||'http://127.0.0.1:5173';
const url=new URL(base);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Integrační testy spouštěj jen proti místní testovací instanci.');
const cases=['game','map','scenery','surfaces-api','exploration','monsters','mechanics','initiative','conditions','powers','recovery','journey','map-notes','note-alerts','room-parchments','session-recap','story-outline','challenges','loot','equipment','life','adventures','catalog-portable','generator-core','generator-v2','generator','generation-v2-integration','access','voice','repairs','basic-mechanics','lighting','message-replay','conditional-game','stabilization','public-admission-api'];
const requested=process.env.STUL_TEST_CASES?.split(',').filter(Boolean);
if(requested?.some(name=>!cases.includes(name)))throw new Error('Neznámý integrační scénář.');
for(const name of cases.filter(name=>!requested||requested.includes(name))){
 console.log(`\nTest: ${name}`);
 const result=spawnSync(process.execPath,['--experimental-strip-types',`scripts/test-${name}.mjs`,base],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
