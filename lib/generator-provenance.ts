import type {Game} from './game';
/** A saved floor graph includes its original generated stair endpoints. Manual
 * reconnection must not leave those generated links advertised as current. */
export function generationStairIssues(game:Pick<Game,'atlas'|'generationRuns'>):string[]{
 const atlas=game.atlas;if(!atlas)return [];
 const issues=new Set<string>();
 const same=(a:{levelId:string;x:number;y:number},b:{levelId:string;x:number;y:number})=>a.levelId===b.levelId&&a.x===b.x&&a.y===b.y;
 for(const run of game.generationRuns||[]){if(run.options.version!=='v2')continue;
  for(let i=1;i<run.levelIds.length;i++){
   const before=atlas.levels.find(l=>l.id===run.levelIds[i-1]),after=atlas.levels.find(l=>l.id===run.levelIds[i]);
   const from=before?.map.generation,to=after?.map.generation;if(!before||!after||!from||!to)continue;
   const goal=from.rooms.find(r=>r.id===from.goalRoomId),entry=to.rooms[0];if(!goal||!entry)continue;
   const a={levelId:before.id,x:goal.center[0],y:goal.center[1]},b={levelId:after.id,x:entry.center[0],y:entry.center[1]};
   if(!atlas.stairs.some(s=>same(s.a,a)&&same(s.b,b)||same(s.a,b)&&same(s.b,a))){if(from.status==='valid')issues.add(before.id);if(to.status==='valid')issues.add(after.id);}
  }
 }
 return [...issues];
}
export function reconcileGenerationMetadata(game:Pick<Game,'atlas'|'generationRuns'>){for(const id of generationStairIssues(game)){const metadata=game.atlas?.levels.find(l=>l.id===id)?.map.generation;if(metadata)metadata.status='modified';}}
