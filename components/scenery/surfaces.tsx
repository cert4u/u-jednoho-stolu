import {useCatalog} from '../catalog-provider';
import {surfaceTextureMarks} from '../../lib/surface-texture';
import { useId, useMemo } from 'react';
import type { Dungeon } from '../../lib/dungeon';
import { surfaceRegions } from '../../lib/surfaces';
import { organicSurfacePath } from '../../lib/surface-drawing';
import { findSceneryEntry } from '../../lib/scenery-catalog';
import { PAD,SIZE } from '../dungeon-map/model';

export default function OrganicSurfaces({map,lit,revealed,visible,exploring}:{
  map:Dungeon;lit:ReadonlySet<string>;revealed:ReadonlySet<string>;visible:boolean;exploring:boolean;
}){
  const {scenery}=useCatalog();
  const id=useId().replaceAll(':','');
  const regions = useMemo(() => {
    const regions = surfaceRegions(map);
    if (!regions.length) return [];
    const floor = new Set(map.floors);
    const occupied = new Set((map.surfaces ?? []).map(p => `${p.x},${p.y}`));
    return regions.map(region => {
      const profile = findSceneryEntry(region.kind, scenery)?.surface ?? {
        color: '#938571',
        roughness: 0.5,
        texture: 'strokes',
      };
      const support = new Map(region.cells.map(p => [p.join(','), p]));
      const own = new Set(support.keys());
      for (const [x, y] of region.cells) {
        for (const [nx, ny, edge] of [
          [x - 1, y, `v:${x}:${y}`],
          [x + 1, y, `v:${x + 1}:${y}`],
          [x, y - 1, `h:${x}:${y}`],
          [x, y + 1, `h:${x}:${y + 1}`],
        ] as [number, number, string][]) {
          const k = `${nx},${ny}`;
          if (floor.has(k) && !map.edges[edge] && (!occupied.has(k) || own.has(k)))
            support.set(k, [nx, ny]);
        }
      }
      const cells = [...support.values()];
      return {
        ...region,
        support: cells,
        profile,
        marks: surfaceTextureMarks(cells, region.kind, profile.texture),
        path: organicSurfacePath(region, profile.roughness),
      };
    });
  }, [map, scenery]);
  return <g data-map-layer="surfaces" pointerEvents="none" transform={`translate(${PAD} ${PAD}) scale(${SIZE})`}>
    {regions.map((region,i)=>{
      const uid=`surface-${id}-${i}`;
      const passes=[false,true].map(bright=>({bright,cells:region.support.filter(([x,y])=>{
        const k=`${x},${y}`;return (visible? !exploring||lit.has(k):revealed.has(k))===bright;
      })}));
      return <g key={uid} data-surface-kind={region.kind}>
        <title>{findSceneryEntry(region.kind,scenery)?.name??`Neznámá plocha (${region.kind})`}</title>
        <defs>
          <clipPath id={uid}><path d={region.path} clipRule="evenodd"/></clipPath>
          {passes.map(pass=><clipPath key={String(pass.bright)} id={`${uid}-${pass.bright}`}>
            {pass.cells.map(([x,y])=><rect key={`${x},${y}`} x={x} y={y} width="1" height="1"/>)}
          </clipPath>)}
        </defs>
        {passes.filter(pass=>pass.cells.length).map(pass=><g key={String(pass.bright)} clipPath={`url(#${uid}-${pass.bright})`} opacity={region.hidden ? .3 : pass.bright ? 1 : visible ? .38 : .55}>
          <path d={region.path} fill={region.profile.color} fillOpacity=".19" fillRule="evenodd" stroke={region.profile.color} strokeOpacity=".55" strokeWidth=".018"/>
          <g clipPath={`url(#${uid})`} fill="none" stroke={region.profile.color} strokeLinecap="round" strokeLinejoin="round">
            {region.marks.map((mark,j)=><path key={j} d={mark.d} strokeWidth={mark.width} opacity={mark.opacity}/>)}
          </g>
        </g>)}
      </g>;
    })}
  </g>;
}
