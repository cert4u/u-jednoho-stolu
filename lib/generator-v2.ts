import {cellKey,emptyDungeon,perimeter,type Dungeon,type Point} from './dungeon';
import type {GeneratedDungeon,GeneratedFloor,GeneratorOptions,GenerationMetadata,LogicalRoom,RoomConnection,GeneratorMetrics} from './generator-types';
import {validateGeneratedFloor} from './generator-validation';

// Changing the PRNG, candidate count or weights changes V2 output: version them together.
export const V2_CANDIDATES=6;
export const QUALITY_WEIGHTS={mainPath:24,branches:14,loops:14,occupancy:12,roomVariety:20,corridors:16} as const;
const DIRS:Point[]=[[1,0],[0,1],[-1,0],[0,-1]];
const PRESETS={small:{min:2,max:4},medium:{min:3,max:6},large:{min:5,max:9}};
type Slot={x:number;y:number;width:number;height:number;col:number;row:number};
type Random=()=>number;
export function seededRandom(seed:string):Random{let state=2166136261;for(let i=0;i<seed.length;i++)state=Math.imul(state^seed.charCodeAt(i),16777619);return()=>{state=(state+0x6D2B79F5)|0;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return((n^(n>>>14))>>>0)/4294967296;};}
const edge=(a:Point,b:Point)=>a[0]===b[0]?`h:${a[0]}:${Math.max(a[1],b[1])}`:`v:${Math.max(a[0],b[0])}:${a[1]}`;
const point=(key:string)=>key.split(',').map(Number) as Point;
const orderCells=(cells:Iterable<string>)=>[...cells].sort((a,b)=>{const p=point(a),q=point(b);return p[1]-q[1]||p[0]-q[0];});
function shuffle<T>(items:T[],random:Random){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function partition(total:number,count:number,min:number,random:Random){const parts=Array<number>(count).fill(min);for(let left=total-count*min;left>0;left--)parts[Math.floor(random()*count)]++;return parts;}
function slotsFor(options:GeneratorOptions,random:Random):Slot[]{
 const min=PRESETS[options.size].min+2,choices:{cols:number;rows:number;score:number}[]=[];
 for(let cols=1;cols<=Math.floor(26/min);cols++)for(let rows=1;rows<=Math.floor(18/min);rows++)if(cols*rows>=options.rooms&&cols*rows<=options.rooms+2)choices.push({cols,rows,score:(cols*rows-options.rooms)*3+Math.abs((26/cols)/(18/rows)-1)+random()*.8});
 choices.sort((a,b)=>a.score-b.score);const grid=choices[0];if(!grid)throw Error('Tolik místností se v této velikosti nevejde na papír 28 × 20.');
 const widths=partition(26,grid.cols,min,random),heights=partition(18,grid.rows,min,random),slots:Slot[]=[];let y=1;
 for(let row=0;row<grid.rows;row++){let x=1;for(let col=0;col<grid.cols;col++){slots.push({x,y,width:widths[col],height:heights[row],col,row});x+=widths[col];}y+=heights[row];}
 // Choose a connected polyomino before any room shape is drawn.
 const corners=slots.filter(s=>(s.col===0||s.col===grid.cols-1)&&(s.row===0||s.row===grid.rows-1));
 const chosen=[corners[Math.floor(random()*corners.length)]],selected=new Set(chosen),stack=[chosen[0]];
 const adjacent=(a:Slot,b:Slot)=>Math.abs(a.col-b.col)+Math.abs(a.row-b.row)===1;
 while(chosen.length<options.rooms){let next:Slot|undefined;
  if(options.style==='mine'){while(stack.length&&!next){next=shuffle(slots.filter(s=>!selected.has(s)&&adjacent(stack.at(-1)!,s)),random)[0];if(!next)stack.pop();}if(next)stack.push(next);}
  else{const frontier=shuffle(slots.filter(s=>!selected.has(s)&&chosen.some(c=>adjacent(c,s))),random);if(options.style==='cave')frontier.sort((a,b)=>chosen.filter(c=>adjacent(b,c)).length-chosen.filter(c=>adjacent(a,c)).length);next=frontier[0];}
  if(!next)throw Error('Nelze naplánovat souvislé rozložení místností.');selected.add(next);chosen.push(next);
 }
 return chosen;
}
function planGraph(slots:Slot[],options:GeneratorOptions,random:Random){
 const available:[number,number][]=[];for(let a=0;a<slots.length;a++)for(let b=a+1;b<slots.length;b++)if(Math.abs(slots[a].col-slots[b].col)+Math.abs(slots[a].row-slots[b].row)===1)available.push([a,b]);
 const links:[number,number][]=[],visited=new Set([0]),stack=[0];
 while(visited.size<slots.length){let selected:[number,number]|undefined;
  if(options.style==='mine'){while(stack.length&&!selected){const a=stack.at(-1)!;selected=shuffle(available.filter(([x,y])=>(x===a&&!visited.has(y))||(y===a&&!visited.has(x))),random)[0];if(!selected)stack.pop();}if(selected)stack.push(visited.has(selected[0])?selected[1]:selected[0]);}
  else{let choices=shuffle(available.filter(([a,b])=>visited.has(a)!==visited.has(b)),random);if(options.style==='cave')choices=choices.sort((a,b)=>links.filter(p=>p.includes(b.find(n=>visited.has(n))!)).length-links.filter(p=>p.includes(a.find(n=>visited.has(n))!)).length);selected=choices[0];}
  if(!selected)throw Error('Graf místností není souvislý.');links.push(selected);visited.add(selected[0]);visited.add(selected[1]);
 }
 const extras=shuffle(available.filter(([a,b])=>!links.some(([x,y])=>x===a&&y===b)),random);links.push(...extras.slice(0,Math.floor(random()*(Math.min(options.connections,extras.length)+1))));
 const neighbors=slots.map((_,i)=>links.flatMap(([a,b])=>a===i?[b]:b===i?[a]:[]));
 const queue=[0],parents=new Map<number,number|null>([[0,null]]);for(let i=0;i<queue.length;i++)for(const next of neighbors[queue[i]])if(!parents.has(next)){parents.set(next,queue[i]);queue.push(next);}
 const goal=queue.at(-1)!,main:number[]=[];let cursor:number|null=goal;while(cursor!==null){main.push(cursor);cursor=parents.get(cursor)??null;}main.reverse();return {links,neighbors,goal,main};
}
function makeRoom(slot:Slot,index:number,level:number,options:GeneratorOptions,random:Random):LogicalRoom{
 const preset=PRESETS[options.size],pick=(min:number,max:number)=>min+Math.floor(random()*(max-min+1));
 let width=pick(preset.min,Math.min(preset.max,slot.width-2)),height=pick(preset.min,Math.min(preset.max,slot.height-2));
 if(options.style==='mine'){if(random()<.55){width=Math.min(slot.width-2,Math.max(width,preset.min+1));height=Math.min(height,2+Math.floor(random()*2));}else{height=Math.min(slot.height-2,Math.max(height,preset.min+1));width=Math.min(width,2+Math.floor(random()*2));}}
 const x=pick(slot.x+1,slot.x+slot.width-width-1),y=pick(slot.y+1,slot.y+slot.height-height-1),center:Point=[x+Math.floor(width/2),y+Math.floor(height/2)],cells=new Set<string>();
 for(let dy=0;dy<height;dy++)for(let dx=0;dx<width;dx++){
  let fill=true;
  if(options.style==='cave'){const nx=(dx-(width-1)/2)/(width/2),ny=(dy-(height-1)/2)/(height/2);fill=dx===Math.floor(width/2)||dy===Math.floor(height/2)||nx*nx+ny*ny<.75+random()*.4;}
  if(fill)cells.add(cellKey(x+dx,y+dy));
 }
 // Organic rooms retain a connected central cross and deliberately irregular outline.
 if(options.style==='cave'&&width>1&&height>1)cells.delete(cellKey(x,y));
 const connected=new Set<string>([cellKey(...center)]),queue=[center];for(let i=0;i<queue.length;i++)for(const [dx,dy] of DIRS){const p:Point=[queue[i][0]+dx,queue[i][1]+dy],key=cellKey(...p);if(cells.has(key)&&!connected.has(key)){connected.add(key);queue.push(p);}}
 return {id:`v2-l${level}-r${index}`,x,y,width,height,center,cells:orderCells(connected),role:index===0?'entrance':'room',neighbors:[],mainPath:false};
}
function ports(room:LogicalRoom,dx:number,dy:number):{inside:Point;outside:Point}[]{
 const set=new Set(room.cells);return room.cells.flatMap(key=>{const inside=point(key),outside:Point=[inside[0]+dx,inside[1]+dy];return !set.has(cellKey(...outside))?[{inside,outside}]:[];});
}
// Direction-aware A*: immutable room interiors and reserved corridor cells are obstacles.
function route(start:Point,end:Point,region:{x0:number;y0:number;x1:number;y1:number},blocked:Set<string>,noise:Map<string,number>,options:GeneratorOptions):Point[]|null{
 type State={p:Point;direction:number;g:number;f:number;parent?:State};
 const distance=(p:Point)=>Math.abs(p[0]-end[0])+Math.abs(p[1]-end[1]);
 const open:State[]=[{p:start,direction:4,g:0,f:distance(start)}],best=new Map<string,number>();let steps=0;
 while(open.length&&steps++<12000){let index=0;for(let i=1;i<open.length;i++)if(open[i].f<open[index].f)index=i;const current=open.splice(index,1)[0],state=cellKey(...current.p)+':'+current.direction;if((best.get(state)??Infinity)<current.g)continue;
  if(current.p[0]===end[0]&&current.p[1]===end[1]){const path:Point[]=[];let item:State|undefined=current;while(item){path.push(item.p);item=item.parent;}return path.reverse();}
  for(let direction=0;direction<DIRS.length;direction++){const d=DIRS[direction],p:Point=[current.p[0]+d[0],current.p[1]+d[1]],key=cellKey(...p);if(p[0]<region.x0||p[0]>region.x1||p[1]<region.y0||p[1]>region.y1||blocked.has(key))continue;
   const turn=current.direction!==4&&current.direction!==direction?options.style==='castle'?.65:.12:0;
   const jitter=(noise.get(key)??0)*(options.corridors==='winding'?(options.style==='cave'?3:2):.1),g=current.g+1+turn+jitter,next=key+':'+direction;if(g>=(best.get(next)??Infinity))continue;best.set(next,g);open.push({p,direction,g,f:g+distance(p),parent:current});
  }
 }
 return null;
}
function metrics(rooms:LogicalRoom[],connections:RoomConnection[],main:number[]):GeneratorMetrics{
 let turns=0;for(const {path} of connections)for(let i=2;i<path.length;i++)if(path[i][0]-path[i-1][0]!==path[i-1][0]-path[i-2][0]||path[i][1]-path[i-1][1]!==path[i-1][1]-path[i-2][1])turns++;
 const branches=rooms.filter(r=>r.neighbors.length===1&&r.role!=='entrance'&&r.role!=='goal').length,loops=connections.length-rooms.length+1,occupancy=(rooms.reduce((sum,r)=>sum+r.cells.length,0)+connections.reduce((sum,c)=>sum+c.path.length-2,0))/560,roomVariety=new Set(rooms.map(r=>`${r.width}:${r.height}:${r.cells.length}`)).size/rooms.length;
 const corridorLength=connections.reduce((sum,c)=>sum+c.path.length,0),score=QUALITY_WEIGHTS.mainPath*main.length/rooms.length+QUALITY_WEIGHTS.branches*Math.min(1,branches/Math.max(1,rooms.length/3))+QUALITY_WEIGHTS.loops*Math.min(1,loops/3)+QUALITY_WEIGHTS.occupancy*Math.min(1,occupancy/.6)+QUALITY_WEIGHTS.roomVariety*roomVariety+QUALITY_WEIGHTS.corridors*Math.max(0,1-turns/Math.max(1,corridorLength));
 return {score:Math.round(score*100)/100,mainPathLength:main.length,branches,loops,occupancy,roomVariety,turns};
}
function candidateFloor(options:GeneratorOptions,level:number,candidate:number):GeneratedFloor{
 const random=seededRandom(`v2:${options.seed}:${options.style}:${options.variant}:${level}:${candidate}`),slots=slotsFor(options,random),graph=planGraph(slots,options,random),rooms=slots.map((s,i)=>makeRoom(s,i,level,options,random)),blocked=new Set(rooms.flatMap(r=>r.cells)),corridors=new Set<string>(),connections:RoomConnection[]=[],allowed=new Set<string>();
 const mainPairs=new Set(graph.main.slice(1).map((n,i)=>[n,graph.main[i]].sort((a,b)=>a-b).join(':')));
 for(let i=0;i<rooms.length;i++){const room=rooms[i];room.neighbors=graph.neighbors[i].map(n=>rooms[n].id);room.mainPath=graph.main.includes(i);room.role=i===0?'entrance':i===graph.goal?'goal':room.neighbors.length>=3?'junction':room.neighbors.length===1?'dead-end':room.cells.length>=PRESETS[options.size].max**2*.65?'chamber':'room';const cells=new Set(room.cells);for(const key of cells){const p=point(key);for(const d of DIRS){const q:Point=[p[0]+d[0],p[1]+d[1]];if(cells.has(cellKey(...q)))allowed.add(edge(p,q));}}}
 const noise=new Map<string,number>();for(let y=1;y<19;y++)for(let x=1;x<27;x++)noise.set(cellKey(x,y),random());
 for(const [a,b] of graph.links){const roomA=rooms[a],roomB=rooms[b],slotA=slots[a],slotB=slots[b],dx=Math.sign(slotB.col-slotA.col),dy=Math.sign(slotB.row-slotA.row),pa=shuffle(ports(roomA,dx,dy),random),pb=shuffle(ports(roomB,-dx,-dy),random);
  const pairs=pa.flatMap(from=>pb.map(to=>({from,to,distance:Math.abs(from.outside[0]-to.outside[0])+Math.abs(from.outside[1]-to.outside[1])+random()*2}))).sort((x,y)=>x.distance-y.distance);
  const region={x0:Math.min(slotA.x,slotB.x),y0:Math.min(slotA.y,slotB.y),x1:Math.max(slotA.x+slotA.width,slotB.x+slotB.width)-1,y1:Math.max(slotA.y+slotA.height,slotB.y+slotB.height)-1};
  let full:Point[]|null=null;for(const pair of pairs){if(blocked.has(cellKey(...pair.from.outside))||blocked.has(cellKey(...pair.to.outside)))continue;const path=route(pair.from.outside,pair.to.outside,region,blocked,noise,options);if(path){full=[pair.from.inside,...path,pair.to.inside];break;}}
  if(!full)throw Error('Chodbu nelze bezpečně vést mimo ostatní místnosti.');
  const doors=options.style==='castle'||options.style==='mine'&&random()<.65?[edge(full[0],full[1]),edge(full.at(-2)!,full.at(-1)!)]:[];
  for(const p of full.slice(1,-1)){const key=cellKey(...p);blocked.add(key);corridors.add(key);}for(let i=1;i<full.length;i++)allowed.add(edge(full[i-1],full[i]));
  connections.push({id:`v2-l${level}-c${connections.length}`,from:roomA.id,to:roomB.id,path:full,doors,mainPath:mainPairs.has([a,b].sort((x,y)=>x-y).join(':'))});
 }
 const floors=orderCells([...rooms.flatMap(r=>r.cells),...corridors]),map:Dungeon={...emptyDungeon(),floors,edges:{},autoEdges:[...perimeter(floors)],stairMarks:{}};
 // Wall every unplanned contact, including adjacent corridor segments. Geometry cannot add a graph edge.
 for(const key of floors){const p=point(key);for(const d of DIRS){const q:Point=[p[0]+d[0],p[1]+d[1]],key=edge(p,q);if(!allowed.has(key))map.edges[key]='wall';}}
 for(const connection of connections)for(const key of connection.doors)map.edges[key]='door';
 const metadata:GenerationMetadata={version:'v2',options:structuredClone(options),seed:options.seed,style:options.style,variant:options.variant,candidate,levelIndex:level,status:'valid',rooms,connections,metrics:metrics(rooms,connections,graph.main),goalRoomId:rooms[graph.goal].id};
 map.generation=metadata;validateGeneratedFloor(map,metadata,false);return {name:level===0?`${options.name} · přízemí`:`${options.name} · -${level}. patro`,map,rooms};
}
export function generateDungeonV2(options:GeneratorOptions):GeneratedDungeon{
 const floors:GeneratedFloor[]=[];
 for(let level=0;level<options.levels;level++){let best:GeneratedFloor|undefined;for(let candidate=0;candidate<V2_CANDIDATES;candidate++){try{const next=candidateFloor(options,level,candidate);if(!best||next.map.generation!.metrics.score>best.map.generation!.metrics.score)best=next;}catch{/* Deterministic bounded rejection; no invalid candidate is returned. */}}
  if(!best)throw Error('Tuto konfiguraci nelze bezpečně vytvořit. Zkus méně místností, menší velikost nebo jinou variantu.');floors.push(best);
 }
 const stairs:GeneratedDungeon['stairs']=[];for(let i=0;i<floors.length-1;i++){const from=floors[i].map.generation!,to=floors[i+1].map.generation!,a=from.rooms.find(r=>r.id===from.goalRoomId)!.center,b=to.rooms[0].center;floors[i].map.stairMarks![cellKey(...a)]='down';floors[i+1].map.stairMarks![cellKey(...b)]='up';stairs.push({from:i,to:i+1,a:[...a],b:[...b]});}
 const entry=floors[0].map.generation!.rooms[0].center;floors[0].map.access={entrance:[...entry]};
 if(options.separateExit){const meta=floors[0].map.generation!,goal=meta.rooms.find(r=>r.id===meta.goalRoomId)!,choices=goal.cells.filter(key=>!floors[0].map.stairMarks?.[key]&&key!==cellKey(...entry));choices.sort((a,b)=>{const p=point(a),q=point(b);return (Math.abs(q[0]-entry[0])+Math.abs(q[1]-entry[1]))-(Math.abs(p[0]-entry[0])+Math.abs(p[1]-entry[1]));});floors[0].map.access.exit=point(choices[0]);}
 for(const floor of floors)validateGeneratedFloor(floor.map,floor.map.generation!);
 return {options,floors,stairs,entry:[...entry]};
}
