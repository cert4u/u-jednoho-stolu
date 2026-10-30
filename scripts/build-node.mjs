import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),pkg=require('../package.json');
const revision=process.env.STUL_REVISION||spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim()||'unknown';
const info={version:process.env.STUL_VERSION||pkg.version,revision,builtAt:new Date().toISOString()};
const result=spawnSync(process.execPath,['node_modules/vinext/dist/cli.js','build'],{stdio:'inherit',env:{...process.env,STUL_RUNTIME:'node'}});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);mkdirSync('dist',{recursive:true});writeFileSync('dist/stul-build.json',JSON.stringify(info));
