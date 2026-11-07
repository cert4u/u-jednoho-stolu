import { z } from 'zod';
import type { Dungeon } from './dungeon';
import type { Game } from './game';
import { sceneryCatalog,type SceneryDefinition } from './scenery-catalog';
import type { Scenery } from './scenery';
import { EditConflict } from './sheets';

export const sceneryFillOptionsSchema = z.object({
  seed:z.string().trim().min(1).max(80), environment:z.enum(['auto','castle','mine','cave']),
  density:z.enum(['sparse','balanced','rich']),hidden:z.boolean().default(false),
}).strict();
export type SceneryFillOptions=z.infer<typeof sceneryFillOptionsSchema>;
export type ScenerySuggestion=Pick<Scenery,'kind'|'x'|'y'|'size'|'rotation'>;
const key=(x:number,y:number)=>`${x},${y}`;
const sort=(a:string,b:string)=>a<b?-1:a>b?1:0;
/** Independent coordinate noise: never consumes the V1/V2 generator PRNG. */
function noise(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;return (h>>>0)/4294967296;}
export function sceneryFillBlocked(game:Game,requested?:unknown):string[]{
  const levelId=typeof requested==='string'?requested:game.atlas?.location?.levelId ?? game.atlas?.levels[0]?.id ?? 'ground';
  const result=new Set<string>();
  for(const stair of game.atlas?.stairs??[])for(const end of [stair.a,stair.b])if(end.levelId===levelId)result.add(key(end.x,end.y));
  for(const note of game.mapNotes??[])if(note.levelId===levelId)result.add(key(note.x,note.y));
  for(const monster of game.monsters??[])if(!monster.archived&&monster.levelId===levelId&&monster.x!==null&&monster.y!==null)result.add(key(monster.x,monster.y));
  const party=game.atlas?.location;
  if(party?.levelId===levelId)result.add(key(party.x,party.y));
  if(!game.atlas?.location || game.atlas.location.levelId===levelId)
    for(const member of game.members)if(member.role==='player'&&!member.archived)result.add(key(member.x,member.y));
  return [...result].sort(sort);
}
export function sceneryFillStamp(map:Dungeon,blocked:readonly string[],entries:readonly SceneryDefinition[]=sceneryCatalog):string{
  return JSON.stringify({surfaces:map.surfaces,floors:[...map.floors].sort(sort),edges:Object.entries(map.edges).sort(([a],[b])=>sort(a,b)),
    stairs:map.stairMarks,access:map.access,generation:map.generation?[map.generation.status,map.generation.style]:null,
    scenery:(map.scenery??[]).map(({id,x,y,kind,rotation,size,revision})=>({id,x,y,kind,rotation,size,revision})).sort((a,b)=>sort(a.id,b.id)),blocked:[...blocked].sort(sort),
    catalog:entries.filter(entry=>entry.automatic).map(({id,environments})=>[id,environments])});
}
export function proposeScenery(map:Dungeon,blocked:readonly string[],raw:unknown,entries:readonly SceneryDefinition[]=sceneryCatalog):ScenerySuggestion[]{
  const parsed=sceneryFillOptionsSchema.safeParse(raw);
  if(!parsed.success)throw new Error('Zvol prostředí, hustotu a semínko návrhu do 80 znaků.');
  const options=parsed.data;
  const environment=options.environment==='auto'?(map.generation?.status==='valid'?map.generation.style:undefined):options.environment;
  const kinds=entries.filter(entry=>entry.category==='floor'&&entry.automatic&&(!environment||entry.environments.includes(environment))).map(entry=>entry.id).sort(sort);
  if(!kinds.length)return [];
  const floors=new Set(map.floors),occupied=new Set([...blocked,...(map.surfaces??[]).map(item=>key(item.x,item.y)),...(map.scenery??[]).map(item=>key(item.x,item.y)),...Object.keys(map.stairMarks??{}),...Object.values(map.access??{}).filter(p=>p).map(p=>p!.join(','))]);
  for(const [edge,kind]of Object.entries(map.edges))if(kind==='door'){
    const [axis,xs,ys]=edge.split(':'),x=Number(xs),y=Number(ys);
    for(const [cx,cy]of axis==='h'?[[x,y-1],[x,y]]:[[x-1,y],[x,y]])occupied.add(key(cx,cy));
  }
  const candidates=[...floors].filter(cell=>{
    if(occupied.has(cell))return false;
    const [x,y]=cell.split(',').map(Number);
    return [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([x,y])=>floors.has(key(x,y))).length>=3;
  }).sort((a,b)=>noise(options.seed+':'+a)-noise(options.seed+':'+b)||sort(a,b));
  const ratio={sparse:.04,balanced:.08,rich:.14}[options.density],cap={sparse:10,balanced:20,rich:30}[options.density];
  const count=Math.min(200-(map.scenery?.length??0),cap,Math.max(1,Math.ceil(floors.size*ratio)));
  const result:ScenerySuggestion[]=[];
  for(const cell of candidates){
    if(result.length>=count)break;
    const [x,y]=cell.split(',').map(Number);
    if(result.some(item=>Math.max(Math.abs(item.x-x),Math.abs(item.y-y))<2))continue;
    result.push({kind:kinds[Math.floor(noise(options.seed+':kind:'+cell)*kinds.length)],x,y,
      rotation:([0,90,180,270] as const)[Math.floor(noise(options.seed+':angle:'+cell)*4)],size:noise(options.seed+':size:'+cell)>.65?'medium':'small'});
  }
  return result;
}
export function applySceneryFill(map:Dungeon,input:Record<string,unknown>,entries:readonly SceneryDefinition[]=sceneryCatalog){
  // The HTTP dispatcher replaces this context using current server-owned actors/notes.
  const blocked=Array.isArray(input.fillBlocked)?input.fillBlocked as string[]:[];
  if(input.expectedStamp!==sceneryFillStamp(map,blocked,entries))throw new EditConflict('Mapa nebo obsazení se změnily. Připrav nový návrh stafáže.');
  const options=sceneryFillOptionsSchema.parse(input.options);
  const proposed=proposeScenery(map,blocked,options,entries);
  if(!proposed.length)throw new Error('Pro další střídmé podlahové detaily není vhodné volné místo.');
  map.scenery=[...(map.scenery??[]),...proposed.map(item=>({...item,id:crypto.randomUUID(),revision:crypto.randomUUID(),hidden:options.hidden,note:''}))];
}
