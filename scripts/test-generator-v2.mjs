import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {generateDungeon} from './generator-test-import.mjs';
import {checkGeneratedDungeon,checkGeneratedFloor} from './generator-v2-test-validator.mjs';
const defaults={name:'Jeskyně',version:'v2',style:'castle',variant:0,levels:3,rooms:6,size:'medium',corridors:'direct',connections:1,seed:'v2-test',separateExit:true};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const geometry=draft=>draft.floors.map(f=>({floors:f.map.floors,edges:f.map.edges,access:f.map.access,stairMarks:f.map.stairMarks}));
// Pins obtained from the untouched V1 implementation before the V2 refactor.
const legacy=[
 [{seed:'legacy-golden',levels:1,rooms:2,size:'small',corridors:'direct',connections:0,separateExit:false},'adc7b6413e063615f5ceca88d61407c9304200cca29098bba90b3ed09924467e'],
 [{seed:'preview-seed',levels:3,rooms:6,size:'medium',corridors:'winding',connections:2,separateExit:true},'62591a423ccc418f289794615bb0537216322e69678a84459a94d3ccf455ea3f'],
 [{seed:'max-legacy',levels:8,rooms:6,size:'large',corridors:'winding',connections:4,separateExit:true},'558385189516607dba2471cf601e26a8fa83e953f56aa249d3e75a64722231c9'],
];
for(const [options,expected] of legacy){for(const version of [undefined,'v1']){const draft=generateDungeon({name:'Jeskyně',...options,...(version?{version}:{})});assert.equal(digest(draft.floors.map(f=>({name:f.name,map:f.map,rooms:f.rooms}))),expected,'V1 geometry changed');assert(draft.floors.every(f=>!f.map.generation));}}
// Pin the whole V2 result, including graph, geometry, quality choice and provenance.
// A deliberate algorithm change must receive a new version rather than updating these silently.
const v2Golden={castle:'b42c76c03ce8f97d69da325d184c445944a74bf2994f6154be19c8d1127e4cee',mine:'c924e3b8329263f2c8623b49087605683a0b346a5904d77cbd6a785202add32b',cave:'f621a9775e0fea739caa61e5bd54fee5c51d5c356d13395e386331143f608527'};
for(const [style,expected] of Object.entries(v2Golden)){const draft=checkGeneratedDungeon(generateDungeon({...defaults,style,levels:2,variant:1,corridors:'winding',connections:2,seed:'v2-published-golden'}));assert.equal(digest(draft),expected,`published V2 ${style} result changed`);}
const started=performance.now(),styles=['castle','mine','cave'],runMatrix=!process.argv.includes('--regressions-only');let scenarios=0,floors=0;
if(runMatrix)for(let seed=0;seed<20;seed++)for(const style of styles)for(const size of ['small','medium','large'])for(const rooms of size==='large'?[2,4,6]:[2,6,12])for(const corridors of ['direct','winding'])for(const levels of [1,2+seed%7]){
 const options={...defaults,style,size,rooms,corridors,levels,connections:seed%5,variant:seed%3,seed:`v2-matrix-${seed}`,separateExit:seed%2===0};
 let draft;try{draft=checkGeneratedDungeon(generateDungeon(options));}catch(error){error.message+=`\nConfiguration: ${JSON.stringify(options)}`;throw error;}
 for(const floor of draft.floors){assert(floor.map.generation.metrics.loops<=options.connections);if(options.connections===0)assert.equal(floor.map.generation.metrics.loops,0);}
 if(scenarios%97===0)assert.deepEqual(generateDungeon(options),draft,'same version/seed/variant/settings produced different output');
 scenarios++;floors+=draft.floors.length;
 if(scenarios%360===0)console.log(`V2 matrix: ${scenarios} scenarios / ${floors} floors validated`);
}
assert.equal(scenarios,runMatrix?2160:0);
// Check visible geometry differs, rather than relying on changed style labels.
const styleGeometry=new Map(),variants=new Set();let irregularCaves=0,castleDoors=0;
for(let seed=0;seed<12;seed++)for(const style of styles){const draft=checkGeneratedDungeon(generateDungeon({...defaults,style,levels:1,seed:`style-contrast-${seed}`}));styleGeometry.set(`${seed}:${style}`,digest(geometry(draft)));if(style==='cave'&&draft.floors[0].map.generation.rooms.some(r=>r.cells.length!==r.width*r.height))irregularCaves++;if(style==='castle')castleDoors+=Object.values(draft.floors[0].map.edges).filter(k=>k==='door').length;}
for(let seed=0;seed<12;seed++)assert.equal(new Set(styles.map(style=>styleGeometry.get(`${seed}:${style}`))).size,3,'styles only rename the same physical map');
assert(irregularCaves>0,'cave rooms never have irregular footprints');assert(castleDoors>0,'castle never has doors');
for(let variant=0;variant<3;variant++){const options={...defaults,variant,seed:'variant-selection'};const draft=checkGeneratedDungeon(generateDungeon(options));assert.deepEqual(generateDungeon(options),draft);variants.add(digest(geometry(draft)));}assert(variants.size>1,'variant selection does not change geometry');
for(const invalid of [{version:'v3'},{style:'unknown'},{variant:-1},{variant:3},{variant:1.5},{version:null},{style:'__proto__'},{connections:5},{rooms:13},{size:'large',rooms:7}])assert.throws(()=>generateDungeon({...defaults,...invalid}),JSON.stringify(invalid));
// Deliberate corruption must fail both the independent oracle and production validation.
const {validateGeneratedFloor}=await import('../lib/generator-validation.ts');
const original=generateDungeon({...defaults,levels:1,seed:'corruption-regression'}).floors[0];
function reject(change){const floor=structuredClone(original);change(floor);assert.throws(()=>checkGeneratedFloor(floor));assert.throws(()=>validateGeneratedFloor(floor.map,floor.map.generation));}
reject(f=>{const empty=Array.from({length:560},(_,i)=>`${i%28},${Math.floor(i/28)}`).find(k=>!f.map.floors.includes(k));f.map.floors.push(empty);});
reject(f=>{f.map.generation.rooms[0].cells.push(f.map.generation.rooms[1].cells[0]);});
reject(f=>{f.map.generation.rooms[0].neighbors.push('missing-room');});
reject(f=>{f.map.generation.connections[0].path.splice(1,0,[27,19]);});
reject(f=>{const boundary=Object.entries(f.map.edges).find(([key])=>{const [axis,x,y]=key.split(':');const adjacent=axis==='h'?[`${x},${+y-1}`,`${x},${y}`]:[`${+x-1},${y}`,`${x},${y}`];return adjacent.filter(c=>f.map.floors.includes(c)).length===1;});f.map.edges[boundary[0]]='door';});
let shortcutChecked=false;for(let seed=0;seed<20&&!shortcutChecked;seed++){const f=generateDungeon({...defaults,levels:1,seed:'shortcut-'+seed}).floors[0];const separating=Object.entries(f.map.edges).find(([key,kind])=>{if(kind!=='wall')return false;const [axis,x,y]=key.split(':');return (axis==='h'?[`${x},${+y-1}`,`${x},${y}`]:[`${+x-1},${y}`,`${x},${y}`]).every(cell=>f.map.floors.includes(cell));});if(separating){delete f.map.edges[separating[0]];assert.throws(()=>checkGeneratedFloor(f));assert.throws(()=>validateGeneratedFloor(f.map,f.map.generation));shortcutChecked=true;}}assert(shortcutChecked,'no separating-wall shortcut regression exercised');
console.log(`PASS: ${runMatrix?`${scenarios} distinct V2 scenarios / ${floors} floors, edge-aware physical/logical parity`:'V2 regressions only (main matrix explicitly skipped)'}, deterministic samples, styles, variant replay, V1/V2 golden outputs and adversarial corruption (${Math.round(performance.now()-started)} ms).`);
