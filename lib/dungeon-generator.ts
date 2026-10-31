import {generateDungeon as generateV1} from './dungeon-generator-v1';
import {generateDungeonV2} from './generator-v2';
import type {GeneratedDungeon,GeneratorOptions} from './generator-types';
export type {GeneratorOptions,GeneratedDungeon,GeneratedFloor,GeneratedRoom,GenerationMetadata,DungeonStyle} from './generator-types';
function integer(value:unknown,min:number,max:number,label:string){if(typeof value!=='number'||!Number.isInteger(value)||value<min||value>max)throw new Error(`${label}: zadej celé číslo od ${min} do ${max}.`);return value;}
export function generatorOptions(raw:unknown):GeneratorOptions{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Vyplň parametry jeskyně.');
 const v=raw as Record<string,unknown>,version=v.version===undefined?'v1':v.version,style=v.style===undefined?'castle':v.style,variant=integer(v.variant===undefined?0:v.variant,0,2,'Varianta');
 if(version!=='v1'&&version!=='v2')throw new Error('Neznámá verze generátoru.');
 if(typeof style!=='string'||!['castle','mine','cave'].includes(style))throw new Error('Vyber styl podzemí.');
 if(version==='v1'&&(style!=='castle'||variant!==0))throw new Error('Původní generátor V1 podporuje pouze původní styl a variantu 1.');
 if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>35)throw new Error('Název jeskyně musí mít 1 až 35 znaků.');
 if(typeof v.size!=='string'||!['small','medium','large'].includes(v.size)||typeof v.corridors!=='string'||!['direct','winding'].includes(v.corridors))throw new Error('Vyber velikost místností a podobu chodeb.');
 if(typeof v.seed!=='string'||!v.seed.trim()||v.seed.trim().length>64)throw new Error('Semínko musí mít 1 až 64 znaků.');
 if(v.separateExit!==undefined&&typeof v.separateExit!=='boolean')throw new Error('Vyber, zda vytvořit samostatný východ.');
 return {version,style:style as GeneratorOptions['style'],variant,separateExit:(v.separateExit as boolean|undefined)??false,name:v.name.trim(),levels:integer(v.levels,1,8,'Počet pater'),rooms:integer(v.rooms,2,v.size==='large'?6:12,'Místností na patro'),size:v.size as GeneratorOptions['size'],corridors:v.corridors as GeneratorOptions['corridors'],connections:integer(v.connections,0,4,'Další propojení'),seed:v.seed.trim()};
}
export function generateDungeon(raw:unknown):GeneratedDungeon{const options=generatorOptions(raw);return options.version==='v1'?{...generateV1(options),options}:generateDungeonV2(options);}
