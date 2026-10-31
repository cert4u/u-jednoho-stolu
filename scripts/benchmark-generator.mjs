import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {generateDungeon} from './generator-test-import.mjs';
const runs=Number(process.env.STUL_GENERATOR_BENCH_RUNS||30);
if(!Number.isInteger(runs)||runs<5||runs>500)throw Error('STUL_GENERATOR_BENCH_RUNS must be an integer from 5 to 500.');
const base={name:'Benchmark',levels:3,rooms:6,size:'medium',corridors:'winding',connections:2,separateExit:true,variant:0};
const cases=[{version:'v1',style:'castle'},{version:'v2',style:'castle'},{version:'v2',style:'mine'},{version:'v2',style:'cave'},{version:'v2',style:'castle',levels:8,rooms:12}];
const round=value=>Math.round(value*1000)/1000,results=[];
for(const settings of cases){const options={...base,...settings};for(let i=0;i<5;i++)generateDungeon({...options,seed:'warm-'+i});const times=[];let cells=0;for(let i=0;i<runs;i++){const started=performance.now(),draft=generateDungeon({...options,seed:'bench-'+i});times.push(performance.now()-started);cells+=draft.floors.reduce((sum,f)=>sum+f.map.floors.length,0);}times.sort((a,b)=>a-b);results.push({settings:options,runs,medianMs:round(times[Math.floor(runs/2)]),p95Ms:round(times[Math.min(runs-1,Math.ceil(runs*.95)-1)]),maxMs:round(times.at(-1)),meanFloorCells:Math.round(cells/runs/options.levels)});}
console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,comment:'Informational measurements on this machine. No performance pass/fail threshold.',results},null,2));
