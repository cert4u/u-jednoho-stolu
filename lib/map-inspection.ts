import {cellKey,type Dungeon,type Point} from './dungeon';
export type InspectedArea={cells:string[];kind:'room'|'space'|'empty';roomNumber?:number;doors:string[]};
/** Doors delimit rooms even when open. Modified geometry uses current walls. */
export function inspectArea(map:Dungeon,point:Point):InspectedArea{
 const key=cellKey(...point),floor=new Set(map.floors);
 if(!floor.has(key))return {cells:[],kind:'empty',doors:[]};
 const generated=map.generation?.status==='valid'?map.generation.rooms.find(r=>r.cells.includes(key)):undefined;
 const cells=new Set<string>(generated?.cells||[key]);
 if(!generated){const queue:Point[]=[point];for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const next:Point=[x+dx,y+dy],k=cellKey(...next),edge=dx?`v:${Math.max(x,next[0])}:${y}`:`h:${x}:${Math.max(y,next[1])}`;if(floor.has(k)&&!cells.has(k)&&!map.edges[edge]){cells.add(k);queue.push(next);}}}}
 const doors=Object.entries(map.edges).filter(([edge,type])=>{if(type!=='door')return false;const [axis,sx,sy]=edge.split(':'),x=Number(sx),y=Number(sy);return (axis==='h'?[cellKey(x,y-1),cellKey(x,y)]:[cellKey(x-1,y),cellKey(x,y)]).some(k=>cells.has(k));}).map(([edge])=>edge);
 return {cells:[...cells],kind:generated?'room':'space',...(generated?{roomNumber:map.generation!.rooms.indexOf(generated)+1}:{}),doors};
}
