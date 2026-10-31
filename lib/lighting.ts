import type {Dungeon,Point} from './dungeon';
export const DEFAULT_LIGHT_RADIUS=4;
export type LightingSettings={enabled:boolean;darkRadius:number};
export const defaultLighting=():LightingSettings=>({enabled:false,darkRadius:1});
export type LightSource={point:Point;radius:number};
/** Visibility requires both illumination and the observer's unobstructed sight. */
export function lightVisibility(map:Dungeon,observers:Point[],sources:LightSource[],cap:number,darkRadius:number,trace:(map:Dungeon,from:Point,radius:number)=>string[]):string[]{
 const illuminated=new Set(sources.flatMap(source=>trace(map,source.point,source.radius)));
 const visible=new Set<string>();
 for(const observer of observers){for(const key of trace(map,observer,Math.min(cap,darkRadius)))visible.add(key);for(const key of trace(map,observer,cap))if(illuminated.has(key))visible.add(key);}
 return [...visible];
}
