import { useId, useMemo } from 'react';
import type { Dungeon } from '../../lib/dungeon';
import { surfaceRegions } from '../../lib/surfaces';
import { organicSurfacePath } from '../../lib/surface-drawing';
import { findSceneryEntry } from '../../lib/scenery-catalog';
import { PAD,SIZE } from '../dungeon-map/model';

function Texture({type}:{type:string}){
  if(type==='ripples')return <path d="M.1 .35Q.3 .22 .5 .35T.9 .35M.45 .9Q.65 .78 .9 .9"/>;
  if(type==='stones')return <path d="M.12 .3l.15-.12 .17 .1-.08 .18-.2-.02ZM.66 .72l.16-.1 .16 .13-.1 .2-.18-.06Z"/>;
  if(type==='speckles')return <g><circle cx=".22" cy=".3" r=".025"/><circle cx=".68" cy=".75" r=".035"/><path d="M.6 .2l.12 .02M.15 .85l.1-.02"/></g>;
  return <path d="M.18 .45l.03-.18 .09 .1M.6 .85l.05-.22 .08 .1M.8 .25l.06-.12"/>;
}
export default function OrganicSurfaces({map,lit,revealed,visible,exploring}:{
  map:Dungeon;lit:ReadonlySet<string>;revealed:ReadonlySet<string>;visible:boolean;exploring:boolean;
}){
  const id=useId().replaceAll(':','');
  const regions=useMemo(()=>surfaceRegions(map).map(region=>{
    const profile=findSceneryEntry(region.kind)?.surface??{color:'#938571',roughness:.5,texture:'strokes'};
    const floor=new Set(map.floors),own=new Set(region.cells.map(p=>p.join(',')));
    const occupied=new Set((map.surfaces??[]).map(p=>`${p.x},${p.y}`));
    const support=new Map(region.cells.map(p=>[p.join(','),p]));
    for(const [x,y]of region.cells)for(const [nx,ny,edge]of [[x-1,y,`v:${x}:${y}`],[x+1,y,`v:${x+1}:${y}`],[x,y-1,`h:${x}:${y}`],[x,y+1,`h:${x}:${y+1}`]] as [number,number,string][]){
      const k=`${nx},${ny}`;
      if(floor.has(k)&&!map.edges[edge]&&(!occupied.has(k)||own.has(k)))support.set(k,[nx,ny]);
    }
    return {...region,support:[...support.values()],profile,path:organicSurfacePath(region,profile.roughness)};
  }),[map.surfaces,map.floors,map.edges]);
  return <g data-map-layer="surfaces" pointerEvents="none" transform={`translate(${PAD} ${PAD}) scale(${SIZE})`}>
    {regions.map((region,i)=>{
      const uid=`surface-${id}-${i}`;
      const passes=[false,true].map(bright=>({bright,cells:region.support.filter(([x,y])=>{
        const k=`${x},${y}`;return (visible? !exploring||lit.has(k):revealed.has(k))===bright;
      })}));
      return <g key={uid} data-surface-kind={region.kind}>
        <title>{findSceneryEntry(region.kind)?.name??`Neznámá plocha (${region.kind})`}</title>
        <defs>
          <clipPath id={uid}><path d={region.path} clipRule="evenodd"/></clipPath>
          <pattern id={`${uid}-texture`} patternUnits="userSpaceOnUse" width="1.1" height="1.1">
            <g fill="none" stroke={region.profile.color} strokeWidth=".023" strokeLinecap="round"><Texture type={region.profile.texture}/></g>
          </pattern>
          {passes.map(pass=><clipPath key={String(pass.bright)} id={`${uid}-${pass.bright}`}>
            {pass.cells.map(([x,y])=><rect key={`${x},${y}`} x={x} y={y} width="1" height="1"/>)}
          </clipPath>)}
        </defs>
        {passes.filter(pass=>pass.cells.length).map(pass=><g key={String(pass.bright)} clipPath={`url(#${uid}-${pass.bright})`} opacity={region.hidden ? .3 : pass.bright ? 1 : visible ? .38 : .55}>
          <path d={region.path} fill={region.profile.color} fillOpacity=".19" fillRule="evenodd" stroke={region.profile.color} strokeOpacity=".55" strokeWidth=".018"/>
          <rect width="28" height="20" clipPath={`url(#${uid})`} fill={`url(#${uid}-texture)`} opacity=".55"/>
        </g>)}
      </g>;
    })}
  </g>;
}
