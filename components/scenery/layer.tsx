import type { Dungeon } from '../../lib/dungeon';
import { sceneryCells, sceneryName } from '../../lib/scenery';
import { PAD, SIZE } from '../dungeon-map/model';
import SceneryGlyph from './glyph';

export default function SceneryLayer({ map, lit, revealed, visible, exploring, editable }: {
  map: Dungeon; lit: ReadonlySet<string>; revealed: ReadonlySet<string>;
  visible: boolean; exploring: boolean; editable: boolean;
}) {
  return <g data-map-layer="scenery">
    {(map.scenery ?? []).map(item => {
      const cells = sceneryCells(item,map), now = cells.some(key => lit.has(key));
      const scale = item.size === 'small' ? .6 : item.size === 'large' ? .96 : .78;
      const opacity = visible ? exploring && !now ? .24 : .65 : item.hidden ? .2 : cells.some(key => revealed.has(key)) ? .65 : .32;
      return <g key={item.id} data-scenery={item.id} data-scenery-kind={item.kind}
        role={editable ? 'button' : undefined} aria-label={editable ? `Upravit stafáž: ${sceneryName(item.kind)}` : undefined}
        pointerEvents={editable ? 'all' : 'none'} opacity={opacity} color="#65543f"
        transform={`translate(${PAD+(item.x+.5)*SIZE} ${PAD+(item.y+.5)*SIZE}) rotate(${item.rotation}) scale(${scale}) translate(-16 -16)`}>
        <title>{sceneryName(item.kind)}{!visible && item.hidden ? ' · skryté před hráči' : ''}</title>
        {editable && <rect width="32" height="32" fill="transparent" />}
        <SceneryGlyph kind={item.kind} />
      </g>;
    })}
  </g>;
}
