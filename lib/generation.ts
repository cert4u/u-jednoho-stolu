import type {Game,Member} from './game';
import {dungeonFor,emptyDungeon} from './dungeon';
import {ensureAtlas} from './exploration';
import {generateDungeon} from './dungeon-generator';
import {EditConflict} from './sheets';
export type GenerationOperation={id:string;levelIds:string[]};
export type GenerationState={available:number;reuseEmpty:boolean;stamp:string};
export function generationState(g:Game):GenerationState{
 const levels=g.atlas?.levels||[{id:'ground',map:dungeonFor(g),history:g.mapHistory||[],memory:emptyDungeon(),visible:[]}],ground=levels[0];
 const reuseEmpty=levels.length===1&&ground.id==='ground'&&!ground.map.floors.length&&!Object.keys(ground.map.edges).length&&!Object.keys(ground.map.stairMarks||{}).length&&!Object.keys(ground.map.access||{}).length&&!ground.history.length&&!ground.memory.floors.length&&!ground.memory.revealed.length&&!g.atlas?.location&&!g.atlas?.stairs.length&&!g.mapNotes?.some(n=>n.levelId==='ground')&&!g.monsters?.some(m=>m.levelId==='ground');
 return {available:8-levels.length+(reuseEmpty?1:0),reuseEmpty,stamp:JSON.stringify({ids:levels.map(l=>l.id),reuseEmpty})};
}
export function generationAction(g:Game,me:Member,b:Record<string,unknown>):string[]{
 if(me.role!=='pj')throw new Error('Jeskyni generuje pouze PJ.');
 if(typeof b.requestId!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(b.requestId))throw new Error('Chybí identifikátor generování.');
 const previous=g.generationOperations?.find(op=>op.id===b.requestId);if(previous)return previous.levelIds;
 const state=generationState(g);if(b.expectedState!==state.stamp)throw new EditConflict('Seznam pater nebo prázdná mapa se mezitím změnily. Vytvoř nový náhled.');
 const draft=generateDungeon(b.options);if(draft.floors.length>state.available)throw new Error(`Do dobrodružství lze přidat nejvýše ${state.available} pater (celkový limit 8).`);
 const atlas=ensureAtlas(g),ids=draft.floors.map((_,i)=>state.reuseEmpty&&i===0?'ground':crypto.randomUUID());
 const levels=draft.floors.map((floor,i)=>({id:ids[i],name:floor.name,map:floor.map,history:[],memory:emptyDungeon(),visible:[]}));
 if(state.reuseEmpty){atlas.levels=levels;g.dungeon=structuredClone(levels[0].map);g.mapHistory=[];}else atlas.levels.push(...levels);
 atlas.stairs.push(...draft.stairs.map(s=>({id:crypto.randomUUID(),a:{levelId:ids[s.from],x:s.a[0],y:s.a[1]},b:{levelId:ids[s.to],x:s.b[0],y:s.b[1]}})));
 g.generationOperations=[...(g.generationOperations||[]),{id:b.requestId,levelIds:ids}].slice(-64);
 return ids;
}
