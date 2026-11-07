import { z } from 'zod';
import { contentReference } from './content-schema';
import { findSceneryEntry } from './scenery-catalog';
import type { Dungeon, Point } from './dungeon';

export const surfaceCellSchema = z.object({
  kind: contentReference, x: z.number().int().min(0).max(27), y: z.number().int().min(0).max(19),
  hidden: z.boolean().optional(),
}).strict();
export type SurfaceCell = z.infer<typeof surfaceCellSchema>;
export type SurfaceBrush = {kind:string;op:'add'|'remove';hidden:boolean};
export const surfaceListSchema = z.array(surfaceCellSchema).max(560)
  .refine(items=>new Set(items.map(p=>`${p.x},${p.y}`)).size===items.length);
const strokeSchema=z.object({
  kind:contentReference,op:z.enum(['add','remove']),hidden:z.boolean().default(false),
  points:z.array(z.tuple([z.number().int().min(0).max(27),z.number().int().min(0).max(19)])).min(1).max(2048),
});
const key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
export function publicSurfaces(items:SurfaceCell[]=[]):SurfaceCell[]{
  return items.filter(p=>!p.hidden).map(({kind,x,y})=>({kind,x,y}));
}
export function observedSurfaces(map:Dungeon,seen:ReadonlySet<string>):SurfaceCell[]{
  const floor=new Set(map.floors);
  return publicSurfaces(map.surfaces).filter(p=>floor.has(key(p))&&seen.has(key(p)));
}
export function rememberSurfaces(memory:Dungeon,source:Dungeon,visible:ReadonlySet<string>):SurfaceCell[]{
  return [...publicSurfaces(memory.surfaces).filter(p=>!visible.has(key(p))),...observedSurfaces(source,visible)];
}
/** One transaction per brush stroke. Different materials replace only painted cells. */
export function paintSurface(map:Dungeon,raw:Record<string,unknown>){
  const parsed=strokeSchema.safeParse(raw);
  if(!parsed.success)throw new Error('Vyber platný materiál a tah uvnitř mapy (nejvýše 2048 bodů).');
  const {kind,op,hidden,points}=parsed.data;
  if(op==='add'&&!findSceneryEntry(kind)?.surface)throw new Error('Tento materiál plochy v místním katalogu neexistuje.');
  const cells=new Map((map.surfaces??[]).map(p=>[key(p),p])),floor=new Set(map.floors);
  let touched=false;
  const paint=(x:number,y:number)=>{
    const k=`${x},${y}`;
    if(op==='remove'){if(cells.get(k)?.kind===kind){cells.delete(k);touched=true;}}
    else if(floor.has(k)){cells.set(k,{kind,x,y,hidden});touched=true;}
  };
  for(let i=0;i<points.length;i++){
    const a=points[Math.max(0,i-1)],b=points[i];
    const steps=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));
    let previous=a;
    for(let n=0;n<=steps;n++){
      const t=steps?n/steps:0,x=Math.round(a[0]+(b[0]-a[0])*t),y=Math.round(a[1]+(b[1]-a[1])*t);
      if(x!==previous[0]&&y!==previous[1])paint(x,previous[1]);
      paint(x,y);previous=[x,y];
    }
  }
  if(op==='add'&&!touched)throw new Error('Plochu kresli na podlahu místnosti nebo chodby.');
  map.surfaces=[...cells.values()].sort((a,b)=>a.y-b.y||a.x-b.x);
}

export type SurfaceRegion={kind:string;hidden:boolean;cells:Point[]};
/** Walls and doors separate regions; diagonal cells do not merge. */
export function surfaceRegions(map:Dungeon):SurfaceRegion[]{
  const floor=new Set(map.floors),remaining=new Map((map.surfaces??[]).filter(p=>floor.has(key(p))).map(p=>[key(p),p]));
  const regions:SurfaceRegion[]=[];
  for(const start of [...remaining.values()].sort((a,b)=>a.y-b.y||a.x-b.x)){
    if(!remaining.has(key(start)))continue;
    const queue=[start];remaining.delete(key(start));
    for(let i=0;i<queue.length;i++){
      const p=queue[i];
      for(const [x,y,edge] of [[p.x-1,p.y,`v:${p.x}:${p.y}`],[p.x+1,p.y,`v:${p.x+1}:${p.y}`],[p.x,p.y-1,`h:${p.x}:${p.y}`],[p.x,p.y+1,`h:${p.x}:${p.y+1}`]] as [number,number,string][]){
        const next=remaining.get(`${x},${y}`);
        if(next&&next.kind===start.kind&&Boolean(next.hidden)===Boolean(start.hidden)&&!map.edges[edge]){
          queue.push(next);remaining.delete(key(next));
        }
      }
    }
    regions.push({kind:start.kind,hidden:Boolean(start.hidden),cells:queue.map(p=>[p.x,p.y])});
  }
  return regions;
}
