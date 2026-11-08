import { cellKey } from '../../../lib/dungeon';
import { PAD, SIZE } from '../model';
import type { CanvasProps } from '../canvas-types';
type Props = Pick<
  CanvasProps,
  'notes' | 'appearance' | 'busy' | 'pj' | 'exploration' | 'onOpenNote'
> &
  Pick<CanvasProps['map'], 'shown' | 'visible' | 'lit'> &
  Pick<
    CanvasProps['input'],
    'stroke' | 'effectiveTool' | 'space' | 'setKeyboard'
  >;
export default function MapNotes({
  notes,
  appearance,
  busy,
  pj,
  exploration,
  onOpenNote,
  shown,
  visible,
  lit,
  stroke,
  effectiveTool,
  space,
  setKeyboard,
}: Props) {
  return (
    <>
      {notes
        .filter(
          (n) =>
            !visible ||
            (n.shared &&
              shown.floors.includes(cellKey(n.x, n.y)) &&
              shown.revealed.includes(cellKey(n.x, n.y))),
        )
        .map((n) => {
          const title =
            pj && visible ? n.published?.title || 'Popis místa' : n.title;
          const number = pj && visible ? n.published?.roomNumber : n.roomNumber;
          const dragged = stroke?.note === n.id;
          const x = dragged ? stroke!.end[0] : n.x,
            y = dragged ? stroke!.end[1] : n.y;
          const open = () => {
            if (!busy) {
              setKeyboard([n.x, n.y]);
              onOpenNote({ levelId: n.levelId, x: n.x, y: n.y }, visible);
            }
          };
          return (
            <g
              key={n.id}
              data-map-note={n.id}
              role="button"
              tabIndex={0}
              aria-label={`${number ? `Místnost ${number}` : visible ? 'Popis místa' : 'Poznámka PJ'}: ${title} · políčko ${n.x + 1}, ${n.y + 1}`}
              transform={
                number
                  ? `translate(${PAD + (x + 0.5) * SIZE},${PAD + (y + 0.5) * SIZE})`
                  : `translate(${PAD + (x + 1) * SIZE - 7},${PAD + y * SIZE + 7})`
              }
              opacity={
                visible && exploration?.enabled && !lit.has(cellKey(n.x, n.y))
                  ? 0.45
                  : 1
              }
              style={{
                cursor: 'pointer',
                pointerEvents:
                  visible || ['note', 'move', 'inspect'].includes(effectiveTool)
                    ? 'auto'
                    : 'none',
              }}
              onFocus={() => setKeyboard([n.x, n.y])}
              onPointerDown={(e) => {
                if (visible && !e.ctrlKey && !space && effectiveTool !== 'hand')
                  e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (visible && !e.ctrlKey && !space && effectiveTool !== 'hand')
                  open();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  open();
                }
              }}
            >
              <rect x="-16" y="-16" width="32" height="32" fill="transparent" />
              <title>
                {`${title}${!visible && !n.shared ? ' · pouze PJ' : ''}`}
              </title>
              {number ? (
                <>
                  <circle
                    r={appearance === 'hand-drawn' ? 14 : 13}
                    fill="#faf6e7"
                    stroke={appearance === 'hand-drawn' ? '#493e2e' : '#77705d'}
                    strokeWidth="1.2"
                    strokeDasharray={!n.shared ? '3 2' : undefined}
                  />
                  <text
                    y="4"
                    textAnchor="middle"
                    fontSize={appearance === 'hand-drawn' ? 16 : 12}
                    fontFamily="Georgia,serif"
                    fill={appearance === 'hand-drawn' ? '#352e25' : '#555140'}
                    pointerEvents="none"
                  >
                    {number}
                  </text>
                  <text
                    className="map-room-name"
                    y="28"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {title.length > 24 ? title.slice(0, 23) + '…' : title}
                  </text>
                </>
              ) : (
                <>
                  <rect
                    x="-6"
                    y="-6"
                    width="12"
                    height="12"
                    rx="2"
                    fill={n.shared ? '#b58b4b' : '#939984'}
                    stroke="#fff9e9"
                    strokeWidth="1"
                    strokeDasharray={!n.shared ? '2 1' : undefined}
                  />
                  <text
                    y="3.5"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="Georgia,serif"
                    fill="#fff9e9"
                    pointerEvents="none"
                  >
                    i
                  </text>
                </>
              )}
            </g>
          );
        })}
    </>
  );
}
