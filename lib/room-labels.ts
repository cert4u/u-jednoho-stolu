import type {Dungeon,Point} from './dungeon';
import type {GeneratedRoom} from './generator-types';
/** Keep room numbers on room floor, away from stairs and access symbols. */
export function roomLabelPoint(room:GeneratedRoom,map:Dungeon):Point{
 const occupied=new Set([...Object.keys(map.stairMarks||{}),...Object.values(map.access||{}).flatMap(p=>p?[p.join(',')]:[])]);
 const cells=room.cells||Array.from({length:room.width*room.height},(_,i)=>`${room.x+i%room.width},${room.y+Math.floor(i/room.width)}`);
 const floor=new Set(map.floors);
 const candidates=cells.filter(key=>floor.has(key)&&!occupied.has(key)).map(key=>key.split(',').map(Number) as Point);
 candidates.sort((a,b)=>Math.hypot(a[0]-room.center[0],a[1]-room.center[1])-Math.hypot(b[0]-room.center[0],b[1]-room.center[1])||a[1]-b[1]||a[0]-b[0]);
 return candidates[0]||room.center;
}
