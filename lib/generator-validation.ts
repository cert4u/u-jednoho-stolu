import {cellKey,edgeCells,type Dungeon,type Point} from './dungeon';
import type {GenerationMetadata} from './generator-types';
const DIRS:Point[]=[[1,0],[0,1],[-1,0],[0,-1]];
const keyForEdge=(a:Point,b:Point)=>a[0]===b[0]?`h:${a[0]}:${Math.max(a[1],b[1])}`:`v:${Math.max(a[0],b[0])}:${a[1]}`;
const point=(key:string)=>key.split(',').map(Number) as Point;
function demand(value:unknown,message:string):asserts value{if(!value)throw Error(`Neplatný návrh jeskyně: ${message}`);}
function validPoint(p:Point){return Array.isArray(p)&&p.length===2&&p.every(Number.isInteger)&&p[0]>=0&&p[0]<28&&p[1]>=0&&p[1]<20;}
function flood(start:string,cells:Set<string>,canPass:(a:Point,b:Point)=>boolean){const reached=new Set([start]),queue=[start];for(let i=0;i<queue.length;i++){const p=point(queue[i]);for(const d of DIRS){const q:Point=[p[0]+d[0],p[1]+d[1]],key=cellKey(...q);if(cells.has(key)&&!reached.has(key)&&canPass(p,q)){reached.add(key);queue.push(key);}}}return reached;}
/** Validate real wall-aware movement, logical ownership and all allowed contacts.
 * complete=false is internal to candidate scoring before entrance/stairs are added.
 */
export function validateGeneratedFloor(map:Dungeon,metadata:GenerationMetadata,complete=true):void{
 demand(metadata.version==='v2'&&metadata.status==='valid','metadata nejsou platná pro V2.');
 demand(metadata.options.version==='v2'&&metadata.seed===metadata.options.seed&&metadata.style===metadata.options.style&&metadata.variant===metadata.options.variant,'původ generování se rozchází s parametry.');
 demand(Number.isInteger(metadata.levelIndex)&&metadata.levelIndex>=0&&metadata.levelIndex<metadata.options.levels,'neplatné číslo patra.');
 const cells=new Set(map.floors),owners=new Map<string,string>(),rooms=new Map(metadata.rooms.map(r=>[r.id,r])),allowed=new Set<string>(),declaredDoors=new Set<string>();
 demand(cells.size===map.floors.length&&cells.size>0,'duplicitní nebo prázdná podlaha.');for(const key of cells)demand(/^\d+,\d+$/.test(key)&&validPoint(point(key)),'podlaha mimo mapu.');
 demand(rooms.size===metadata.rooms.length&&rooms.size===metadata.options.rooms,'počet nebo identifikátory místností.');
 demand(metadata.rooms[0]?.role==='entrance'&&metadata.rooms.filter(r=>r.role==='entrance').length===1,'vstupní místnost.');
 demand(rooms.has(metadata.goalRoomId)&&metadata.rooms.filter(r=>r.role==='goal').length===1&&rooms.get(metadata.goalRoomId)!.role==='goal','cílová místnost.');
 for(const room of metadata.rooms){
  demand(validPoint(room.center)&&room.width>=1&&room.height>=1&&room.x>=0&&room.y>=0&&room.x+room.width<=28&&room.y+room.height<=20,'rozměry místnosti.');
  const own=new Set(room.cells);demand(own.size===room.cells.length&&own.size>0&&own.has(cellKey(...room.center)),'buňky nebo střed místnosti.');
  for(const key of own){const p=point(key);demand(cells.has(key)&&!owners.has(key)&&p[0]>=room.x&&p[0]<room.x+room.width&&p[1]>=room.y&&p[1]<room.y+room.height,'překryv nebo neplatná buňka místnosti.');owners.set(key,room.id);for(const d of DIRS){const q:Point=[p[0]+d[0],p[1]+d[1]];if(own.has(cellKey(...q)))allowed.add(keyForEdge(p,q));}}
  demand(flood(cellKey(...room.center),own,()=>true).size===own.size,'nesouvislý interiér místnosti.');
 }
 const expectedNeighbors=new Map(metadata.rooms.map(r=>[r.id,[] as string[]])),connectionIds=new Set<string>(),pairs=new Set<string>();let turns=0;
 for(const connection of metadata.connections){
  demand(!connectionIds.has(connection.id)&&rooms.has(connection.from)&&rooms.has(connection.to)&&connection.from!==connection.to,'identifikátor nebo konce spojení.');connectionIds.add(connection.id);
  const pair=[connection.from,connection.to].sort().join(':');demand(!pairs.has(pair),'duplicitní propojení místností.');pairs.add(pair);
  const path=connection.path;demand(path.length>=3&&path.length<=560&&path.every(validPoint)&&new Set(path.map(p=>cellKey(...p))).size===path.length,'neplatná trasa chodby.');
  demand(owners.get(cellKey(...path[0]))===connection.from&&owners.get(cellKey(...path.at(-1)!))===connection.to,'konce chodby nejsou v příslušných místnostech.');
  for(const p of path.slice(1,-1)){const key=cellKey(...p);demand(cells.has(key)&&!owners.has(key),'chodba sdílí prostor s místností nebo jinou chodbou.');owners.set(key,'corridor:'+connection.id);}
  for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];demand(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])===1,'nesousední kroky chodby.');allowed.add(keyForEdge(a,b));if(i>=2&&(b[0]-a[0]!==a[0]-path[i-2][0]||b[1]-a[1]!==a[1]-path[i-2][1]))turns++;}
  const ends=[keyForEdge(path[0],path[1]),keyForEdge(path.at(-2)!,path.at(-1)!)];
  demand(new Set(connection.doors).size===connection.doors.length&&connection.doors.every(key=>ends.includes(key)&&map.edges[key]==='door'),'dveře mimo vstup do místnosti.');
  if(metadata.style==='castle')demand(connection.doors.length===2&&ends.every(key=>connection.doors.includes(key)),'umělému podzemí chybějí dveře.');
  for(const key of connection.doors){demand(!declaredDoors.has(key),'sdílené dveře.');declaredDoors.add(key);}
  expectedNeighbors.get(connection.from)!.push(connection.to);expectedNeighbors.get(connection.to)!.push(connection.from);
 }
 demand(owners.size===cells.size,'podlaha bez příslušnosti k místnosti nebo trase.');
 for(const room of metadata.rooms){const expected=expectedNeighbors.get(room.id)!;demand(new Set(room.neighbors).size===room.neighbors.length&&room.neighbors.length===expected.length&&room.neighbors.every(id=>expected.includes(id)),'sousedé místnosti nesouhlasí s grafem.');}
 for(const key of cells){const p=point(key);for(const d of DIRS){const q:Point=[p[0]+d[0],p[1]+d[1]],neighbor=cellKey(...q),key=keyForEdge(p,q),kind=map.edges[key];if(!cells.has(neighbor)){demand(kind==='wall','neuzavřený obvod podlahy.');continue;}const planned=allowed.has(key);demand(planned?kind!=='wall':kind==='wall','neplánovaná zkratka nebo přerušená chodba.');if(kind==='door')demand(declaredDoors.has(key),'nedeklarované dveře.');}}
 for(const [key,kind] of Object.entries(map.edges)){demand(/^[hv]:\d+:\d+$/.test(key)&&edgeCells(key).some(c=>cells.has(c)),'neplatná nebo opuštěná hrana.');if(kind==='door')demand(declaredDoors.has(key),'dveře bez příslušnosti ke spojení.');}
 const entrance=metadata.rooms[0],goal=rooms.get(metadata.goalRoomId)!,parents=new Map<string,string|null>([[entrance.id,null]]),queue=[entrance.id];for(let i=0;i<queue.length;i++)for(const next of expectedNeighbors.get(queue[i])!)if(!parents.has(next)){parents.set(next,queue[i]);queue.push(next);}
 demand(parents.size===rooms.size,'nesouvislý logický graf.');const main=new Set<string>(),mainRoute:string[]=[];let cursor:string|null=goal.id;while(cursor!==null){main.add(cursor);mainRoute.push(cursor);cursor=parents.get(cursor)??null;}mainRoute.reverse();const mainPairs=new Set(mainRoute.slice(1).map((id,i)=>[id,mainRoute[i]].sort().join(':')));for(const connection of metadata.connections)demand(connection.mainPath===mainPairs.has([connection.from,connection.to].sort().join(':')),'spojení na hlavní trase.');const distance=(id:string)=>{let length=0,current:string|null=id;while(current!==null){length++;current=parents.get(current)??null;}return length;};demand([...rooms.keys()].every(id=>distance(id)<=main.size),'cíl není na konci nejdelší postupové cesty.');
 for(const room of metadata.rooms)demand(room.mainPath===main.has(room.id),'označení hlavní trasy.');
 demand(flood(cellKey(...entrance.center),cells,(a,b)=>map.edges[keyForEdge(a,b)]!=='wall').size===cells.size,'skutečná geometrie není dosažitelná s otevřitelnými dveřmi.');
 const m=metadata.metrics;demand(Object.values(m).every(Number.isFinite)&&m.loops===metadata.connections.length-rooms.size+1&&m.mainPathLength===main.size&&m.branches===metadata.rooms.filter(r=>r.neighbors.length===1&&r.role!=='entrance'&&r.role!=='goal').length&&m.turns===turns&&Math.abs(m.occupancy-cells.size/560)<1e-9&&m.loops>=0&&m.loops<=metadata.options.connections&&Math.abs(m.roomVariety-new Set(metadata.rooms.map(r=>`${r.width}:${r.height}:${r.cells.length}`)).size/rooms.size)<1e-9,'neplatná hodnoticí metadata.');
 for(const [key,direction] of Object.entries(map.stairMarks||{}))demand(cells.has(key)&&['up','down','both'].includes(direction),'schody mimo podlahu.');
 for(const p of Object.values(map.access||{}))if(p)demand(validPoint(p)&&cells.has(cellKey(...p)),'vchod nebo východ mimo podlahu.');
 if(complete){
  if(metadata.levelIndex>0)demand(['up','both'].includes(map.stairMarks?.[cellKey(...entrance.center)]||''),'chybí navazující schody nahoru.');
  if(metadata.levelIndex<metadata.options.levels-1)demand(['down','both'].includes(map.stairMarks?.[cellKey(...goal.center)]||''),'chybí navazující schody dolů.');
  if(metadata.levelIndex===0){demand(map.access?.entrance?.join()===entrance.center.join(),'vchod není ve vstupní místnosti.');if(metadata.options.separateExit){const exit=map.access?.exit;demand(exit&&goal.cells.includes(cellKey(...exit))&&!map.stairMarks?.[cellKey(...exit)]&&exit.join()!==entrance.center.join(),'samostatný východ není bezpečně v cílové místnosti.');}else demand(!map.access?.exit,'nevyžádaný samostatný východ.');}
 }
}
