import { cellKey } from '../../../lib/dungeon';
import { PAD, SIZE } from '../model';
import type { CanvasProps } from '../canvas-types';
type Props = Pick<
  CanvasProps,
  'members' | 'exploration' | 'preview' | 'selected'
> &
  Pick<CanvasProps['map'], 'visible' | 'revealed'> &
  Pick<CanvasProps['input'], 'stroke' | 'effectiveTool'>;
export default function PlayerTokens({
  members,
  exploration,
  preview,
  selected,
  visible,
  revealed,
  stroke,
  effectiveTool,
}: Props) {
  return (
    <>
      {(!exploration?.enabled ||
        (exploration.battle &&
          exploration.battle.levelId === exploration.levelId)) &&
        members
          .filter(
            (m) =>
              m.role === 'player' &&
              (!visible || revealed.has(cellKey(m.x, m.y))),
          )
          .map((m) => {
            const dragging = stroke?.token === m.id;
            const x = dragging ? stroke!.end[0] : m.x,
              y = dragging ? stroke!.end[1] : m.y;
            return (
              <g
                key={m.id}
                data-token={m.id}
                role="button"
                aria-label={
                  visible ? m.name : `${m.name}, políčko ${x + 1}, ${y + 1}`
                }
                transform={`translate(${PAD + x * SIZE + SIZE / 2},${PAD + y * SIZE + SIZE / 2})`}
                opacity={!visible && !revealed.has(cellKey(x, y)) ? 0.4 : 1}
                style={{
                  cursor: preview ? 'default' : 'grab',
                  pointerEvents: effectiveTool === 'move' ? 'auto' : 'none',
                }}
              >
                <title>{`${m.name} · ${m.hp}/${m.maxHp} životů`}</title>
                {selected === m.id && (
                  <circle
                    r="17"
                    fill="none"
                    stroke="#81936a"
                    strokeWidth="1.5"
                  />
                )}
                <circle
                  r="13"
                  fill={m.color}
                  stroke="#fffdf1"
                  strokeWidth="2"
                />
                <text
                  y="4.5"
                  textAnchor="middle"
                  fill="#fffdf1"
                  fontSize="14"
                  fontFamily="Lora,serif"
                  pointerEvents="none"
                >
                  {m.name[0]}
                </text>
              </g>
            );
          })}
    </>
  );
}
