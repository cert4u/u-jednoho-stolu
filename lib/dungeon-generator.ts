import {emptyDungeon,perimeter,cellKey,type Dungeon,type Point} from './dungeon';
export type GeneratorOptions={name:string;levels:number;rooms:number;size:'small'|'medium'|'large';corridors:'direct'|'winding';connections:number;seed:string};
export type GeneratedRoom={x:number;y:number;width:number;height:number;center:Point};
export type GeneratedFloor={name:string;map:Dungeon;rooms:GeneratedRoom[]};
export type GeneratedDungeon={options:GeneratorOptions;floors:GeneratedFloor[];stairs:{from:number;to:number;a:Point;b:Point}[];entry:Point};
const sizes={small:{min:2,max:4},medium:{min:3,max:6},large:{min:5,max:9}};
function integer(value:unknown,min:number,max:number,label:string){if(typeof value!=='number'||!Number.isInteger(value)||value<min||value>max)throw new Error(`${label}: zadej celé číslo od ${min} do ${max}.`);return value;}
export function generatorOptions(value:unknown):GeneratorOptions{
 const v=value as GeneratorOptions;if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Vyplň parametry jeskyně.');
 if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>35)throw new Error('Název jeskyně musí mít 1 až 35 znaků.');
 if(!Object.hasOwn(sizes,v.size)||!['direct','winding'].includes(v.corridors))throw new Error('Vyber velikost místností a podobu chodeb.');
 if(typeof v.seed!=='string'||!v.seed.trim()||v.seed.trim().length>64)throw new Error('Semínko musí mít 1 až 64 znaků.');
 return {name:v.name.trim(),levels:integer(v.levels,1,8,'Počet pater'),rooms:integer(v.rooms,2,v.size==='large'?6:12,'Místností na patro'),size:v.size,corridors:v.corridors,connections:integer(v.connections,0,4,'Další propojení'),seed:v.seed.trim()};
}
function randomFor(seed:string){let state=2166136261;for(let i=0;i<seed.length;i++)state=Math.imul(state^seed.charCodeAt(i),16777619);return ()=>{state=(state+0x6D2B79F5)|0;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};}
export function generateDungeon(raw:unknown):GeneratedDungeon{
 const options=generatorOptions(raw),random=randomFor(options.seed),pick=(min:number,max:number)=>min+Math.floor(random()*(max-min+1));
 const shuffle=<T,>(input:T[])=>{const a=[...input];for(let i=a.length-1;i>0;i--){const j=pick(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;};
 const divide=(total:number,count:number,min:number)=>{const parts=Array(count).fill(min) as number[];for(let left=total-count*min;left>0;left--)parts[pick(0,count-1)]++;return parts;};
 const floors:GeneratedFloor[]=[];
 for(let level=0;level<options.levels;level++){
  const preset=sizes[options.size],minimum=preset.min+2,grids:{cols:number;rows:number;score:number}[]=[];
  for(let cols=1;cols<=Math.floor(26/minimum);cols++)for(let rows=1;rows<=Math.floor(18/minimum);rows++)if(cols*rows>=options.rooms)grids.push({cols,rows,score:(cols*rows-options.rooms)*5+Math.abs((26/cols)/(18/rows)-1)+random()*.4});
  grids.sort((a,b)=>a.score-b.score);const grid=grids[0];if(!grid)throw new Error('Tolik místností se v této velikosti nevejde na papír 28 × 20.');
  const widths=divide(26,grid.cols,minimum),heights=divide(18,grid.rows,minimum),slots:{x:number;y:number;width:number;height:number}[]=[];
  let y=1;for(const height of heights){let x=1;for(const width of widths){slots.push({x,y,width,height});x+=width;}y+=height;}
  const rooms=shuffle(slots).slice(0,options.rooms).map(slot=>{const width=pick(preset.min,Math.min(preset.max,slot.width-2)),height=pick(preset.min,Math.min(preset.max,slot.height-2)),x=pick(slot.x+1,slot.x+slot.width-width-1),y=pick(slot.y+1,slot.y+slot.height-height-1);return {x,y,width,height,center:[x+Math.floor(width/2),y+Math.floor(height/2)] as Point};});
  const cells=new Set<string>();for(const room of rooms)for(let y=room.y;y<room.y+room.height;y++)for(let x=room.x;x<room.x+room.width;x++)cells.add(cellKey(x,y));
  const paths=new Set<string>(),connected=new Set([0]),links:[number,number][]=[];
  const pairKey=(a:number,b:number)=>[a,b].sort((x,y)=>x-y).join(':');
  // A spanning tree joins every room before optional extra connections are added.
  while(connected.size<rooms.length){let best:[number,number]=[0,0],distance=Infinity;for(const a of connected)for(let b=0;b<rooms.length;b++)if(!connected.has(b)){const d=Math.abs(rooms[a].center[0]-rooms[b].center[0])+Math.abs(rooms[a].center[1]-rooms[b].center[1])+random();if(d<distance){distance=d;best=[a,b];}}links.push(best);paths.add(pairKey(...best));connected.add(best[1]);}
  const extra:[number,number][]=[];for(let a=0;a<rooms.length;a++)for(let b=a+1;b<rooms.length;b++)if(!paths.has(pairKey(a,b)))extra.push([a,b]);links.push(...shuffle(extra).slice(0,options.connections));
  const draw=(a:Point,b:Point)=>{let [x,y]=a;cells.add(cellKey(x,y));while(x!==b[0]||y!==b[1]){if(x!==b[0])x+=Math.sign(b[0]-x);else y+=Math.sign(b[1]-y);cells.add(cellKey(x,y));}};
  for(const [a,b] of links){const start=rooms[a].center,end=rooms[b].center;let points:Point[];
   if(options.corridors==='winding'){if(random()<.5){const x=Math.max(1,Math.min(26,Math.floor((start[0]+end[0])/2)+pick(-3,3)));points=[start,[x,start[1]],[x,end[1]],end];}else{const y=Math.max(1,Math.min(18,Math.floor((start[1]+end[1])/2)+pick(-3,3)));points=[start,[start[0],y],[end[0],y],end];}}
   else points=random()<.5?[start,[end[0],start[1]],end]:[start,[start[0],end[1]],end];
   for(let i=1;i<points.length;i++)draw(points[i-1],points[i]);
  }
  const boundary=[...perimeter(cells)],map:Dungeon={...emptyDungeon(),floors:[...cells],edges:Object.fromEntries(boundary.map(edge=>[edge,'wall'])),autoEdges:boundary,stairMarks:{}};
  floors.push({name:`${options.name} · ${level+1}. patro`,map,rooms});
 }
 const stairs:GeneratedDungeon['stairs']=[];for(let i=0;i<floors.length-1;i++){const a=floors[i].rooms.at(-1)!.center,b=floors[i+1].rooms[0].center;stairs.push({from:i,to:i+1,a,b});floors[i].map.stairMarks![cellKey(...a)]='down';floors[i+1].map.stairMarks![cellKey(...b)]='up';}
 return {options,floors,stairs,entry:floors[0].rooms[0].center};
}
