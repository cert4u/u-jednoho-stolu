import assert from 'node:assert/strict';
const base=process.argv[2];assert(base&&['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
let successes=0;
for(let i=0;i<101;i++){
 const response=await fetch(base+'/api/game',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'192.0.2.'+i},body:JSON.stringify({action:'create',name:'Admission test'})});
 if(response.status===429){assert.equal(response.headers.get('retry-after'),'60');break;}
 assert.equal(response.status,200,await response.text());successes++;
}
assert.equal(successes,100,'fresh default-budget fixture must admit exactly 100 rooms, then reject the next');
console.log('PASS: default global creation budget is enforced by the runtime API, independent of forged proxy headers.');
