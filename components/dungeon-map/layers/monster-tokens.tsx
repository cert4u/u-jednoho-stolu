import { PAD, SIZE } from '../model';
import type { CanvasProps } from '../canvas-types';
type Props = Pick<
  CanvasProps,
  'monsters' | 'pj' | 'preview' | 'selectedMonster'
> &
  Pick<CanvasProps['map'], 'visible'> &
  Pick<CanvasProps['input'], 'stroke' | 'effectiveTool'>;
export default function MonsterTokens({
  monsters,
  pj,
  preview,
  selectedMonster,
  visible,
  stroke,
  effectiveTool,
}: Props) {
  return (
    <>
      {monsters
        .filter(
          (m) =>
            !m.archived &&
            m.x !== null &&
            m.y !== null &&
            (!visible || !pj || m.visibleToPlayers),
        )
        .map((m) => {
          const dragging = stroke?.monster === m.id;
          const x = dragging ? stroke!.end[0] : m.x!,
            y = dragging ? stroke!.end[1] : m.y!;
          const active = selectedMonster === m.id;
          return (
            <g
              key={m.id}
              data-monster={m.id}
              data-monster-number={m.number}
              role={pj ? 'button' : 'img'}
              aria-label={`${m.name}, číslo ${m.number}${m.defeated ? ', poražená' : ''}`}
              transform={`translate(${PAD + (x + 0.5) * SIZE},${PAD + (y + 0.5) * SIZE})`}
              opacity={pj && !m.visibleToPlayers ? 0.4 : 1}
              style={{
                cursor: pj && !preview ? 'grab' : 'default',
                pointerEvents:
                  pj &&
                  !preview &&
                  ['monster', 'move', 'inspect'].includes(effectiveTool)
                    ? 'auto'
                    : 'none',
              }}
            >
              <title>
                {`${m.name} #${m.number}${pj ? ` · ${m.hp}/${m.maxHp} životů${m.hidden ? ' · ručně skrytá' : ''}` : m.defeated ? ' · poražená' : ''}`}
              </title>
              {active && pj && (
                <rect
                  x="-17"
                  y="-17"
                  width="34"
                  height="34"
                  rx="7"
                  fill="none"
                  stroke="#ab735a"
                  strokeWidth="1.5"
                />
              )}
              <rect
                x="-13"
                y="-13"
                width="26"
                height="26"
                rx="5"
                fill={m.defeated ? '#9a9485' : '#9d6250'}
                stroke="#fff9e9"
                strokeWidth="1.5"
                strokeDasharray={m.hidden && pj ? '3 2' : undefined}
              />
              <text
                y="4"
                textAnchor="middle"
                fontSize="11"
                fill="#fff9e9"
                fontFamily="DM Sans,sans-serif"
                pointerEvents="none"
              >
                {m.number}
              </text>
              {m.defeated && (
                <path
                  d="M-10 -10L10 10M10 -10L-10 10"
                  stroke="#eee6d2"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />
              )}
              {pj && (
                <g pointerEvents="none">
                  <rect
                    x="-12"
                    y="16"
                    width="24"
                    height="2.5"
                    rx="1"
                    fill="#ddd4bb"
                  />
                  <rect
                    x="-12"
                    y="16"
                    width={(24 * (m.hp ?? 0)) / Math.max(1, m.maxHp ?? 1)}
                    height="2.5"
                    rx="1"
                    fill="#9d6250"
                  />
                </g>
              )}
            </g>
          );
        })}
    </>
  );
}
