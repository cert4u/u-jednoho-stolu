import assert from 'node:assert/strict';
import {generateDungeon} from './generator-test-import.mjs';
const {inspectArea}=await import('../lib/map-inspection.ts');
const {emptyDungeon,editDungeon}=await import('../lib/dungeon.ts');
let map=editDungeon(emptyDungeon(),{tool:'room',from:[1,1],to:[8,4]});
map=editDungeon(map,{tool:'wall',points:[[5,1],[5,5]]});map=editDungeon(map,{tool:'door',edges:['v:5:2']});map.openDoors=['v:5:2'];
const left=inspectArea(map,[2,2]),right=inspectArea(map,[6,2]);assert.equal(left.cells.length,16);assert.equal(right.cells.length,16);assert(!left.cells.includes('6,2'));assert.deepEqual(left.doors,['v:5:2']);assert.equal(left.kind,'space');assert.equal(inspectArea(map,[0,0]).kind,'empty');
map=editDungeon(map,{tool:'erase',edges:['v:5:2']});assert.equal(inspectArea(map,[2,2]).cells.length,32);
// Only cardinal connectivity counts; diagonal rooms do not become one room.
let diagonal=editDungeon(emptyDungeon(),{tool:'room',from:[1,1],to:[2,2]});diagonal=editDungeon(diagonal,{tool:'room',from:[3,3],to:[4,4]});assert.equal(inspectArea(diagonal,[1,1]).cells.length,4);
for(const style of ['castle','mine','cave'])for(const floor of generateDungeon({version:'v2',style,variant:0,name:'Inspekce',levels:3,rooms:6,size:'medium',corridors:'winding',connections:2,seed:'inspection'}).floors){for(const room of floor.map.generation.rooms){const area=inspectArea(floor.map,room.center);assert.equal(area.kind,'room');assert.deepEqual(new Set(area.cells),new Set(room.cells));}const modified=structuredClone(floor.map);modified.generation.status='modified';assert.equal(inspectArea(modified,modified.generation.rooms[0].center).kind,'space');}
console.log('PASS: inspection respects walls, open/closed door boundaries, diagonal separation, removed partitions, generated irregular room cells and modified-geometry fallback.');
