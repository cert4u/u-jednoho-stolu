import type { ScenerySuggestion } from '../../lib/scenery-fill';
import { PAD,SIZE } from '../dungeon-map/model';
import SceneryGlyph from './glyph';
export default function SceneryPreview({items}:{items:ScenerySuggestion[]}){
  return <g data-scenery-preview="true" pointerEvents="none" aria-hidden="true" color="#8c6339">
    {items.map(item=><g key={`${item.x},${item.y}`} transform={`translate(${PAD+item.x*SIZE} ${PAD+item.y*SIZE})`}>
      <rect x="2" y="2" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity=".7" />
      <g opacity=".6" transform={`translate(18 18) rotate(${item.rotation}) scale(${item.size==='small'?.6:.78}) translate(-16 -16)`}><SceneryGlyph kind={item.kind}/></g>
    </g>)}
  </g>;
}
