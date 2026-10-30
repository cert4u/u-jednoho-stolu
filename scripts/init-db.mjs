import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {projectRoot} from './sites-env.mjs';
if(!existsSync('dist/server/wrangler.json'))throw new Error('Nejdřív spusť npm run build.');
const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state'],{cwd:projectRoot,stdio:'inherit',env:{...process.env,CI:'true'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
