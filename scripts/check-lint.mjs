import {ESLint} from 'eslint';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const baseline=JSON.parse(readFileSync('scripts/lint-baseline.json','utf8'));
const results=await new ESLint().lintFiles(['.']);
let regressions=0,errors=0,warnings=0;
for(const result of results){
 const file=path.relative(process.cwd(),result.filePath),counts={};errors+=result.errorCount;warnings+=result.warningCount;
 for(const message of result.messages){const key=message.severity+':'+(message.ruleId??'fatal');counts[key]=(counts[key]??0)+1;}
 for(const [rule,count]of Object.entries(counts))if(count>(baseline[file]?.[rule]??0)){
  regressions++;console.error(`${file}: ${rule}: ${count} > ${baseline[file]?.[rule]??0}`);
 }
}
console.log(`Lint: ${errors} errors, ${warnings} warnings; ${regressions} increases against reviewed stabilization baseline.`);
if(regressions)process.exitCode=1;
