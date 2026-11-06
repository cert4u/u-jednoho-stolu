import type { RefObject } from 'react';
import { cellKey, edgeCells, wallEdges, type Dungeon } from '../../lib/dungeon';
import type { ExplorationView, Location } from '../../lib/exploration';
import type { MonsterView } from '../../lib/monsters';
import type { MapNoteView, NoteAnchor } from '../../lib/map-notes';
import {
  W,
  H,
  WIDTH,
  HEIGHT,
  SIZE,
  PAD,
  PAPER_MARGIN,
  edgeVertices,
  type Tool,
  type Marker,
} from './model';
import type { useMapInput } from './use-map-input';

type CanvasInput = Pick<
  ReturnType<typeof useMapInput>,
  | 'stroke'
  | 'keyboard'
  | 'keyboardStart'
  | 'setKeyboard'
  | 'begin'
  | 'drag'
  | 'finish'
  | 'cancel'
  | 'lostCapture'
  | 'keyAction'
> & {
  svg: RefObject<SVGSVGElement | null>;
  zoom: number;
  ctrlPan: boolean;
  space: boolean;
  effectiveTool: Tool;
  tool: Tool;
};

type CanvasProps = {
  input: CanvasInput;
  map: {
    shown: Dungeon;
    revealed: Set<string>;
    lit: Set<string>;
    party?: Location;
    recapCell?: Location;
    visible: boolean;
  };
  busy: boolean;
  exploration?: ExplorationView;
  members: Marker[];
  monsters: MonsterView[];
  notes: MapNoteView[];
  onOpenNote: (anchor: NoteAnchor, publicView: boolean) => void;
  pj: boolean;
  preview: boolean;
  selected: string;
  selectedMonster: string;
};

function Wall({
  edge,
  kind,
  opacity = 1,
  ghost = false,
  open = false,
}: {
  edge: string;
  open?: boolean;
  kind: 'wall' | 'door';
  opacity?: number;
  ghost?: boolean;
}) {
  const [a, b] = edgeVertices(edge);
  const x = PAD + a[0] * SIZE,
    y = PAD + a[1] * SIZE,
    horizontal = a[1] === b[1];
  return (
    <g
      opacity={opacity}
      data-map-edge={ghost ? undefined : edge}
      data-edge-kind={kind}
      pointerEvents="none"
    >
      <line
        x1={x}
        y1={y}
        x2={PAD + b[0] * SIZE}
        y2={PAD + b[1] * SIZE}
        stroke={ghost ? '#87956e' : '#565648'}
        strokeWidth={ghost ? 2 : 2.6}
        strokeLinecap="square"
      />
      {kind === 'door' && (
        <g transform={`translate(${x},${y}) rotate(${horizontal ? 0 : 90})`}>
          <rect x="6" y="-4" width="24" height="8" fill="#faf7e9" />
          <rect
            transform={open ? 'rotate(55 7 -3)' : undefined}
            x="7"
            y="-3"
            width="22"
            height="6"
            fill="#f0ead4"
            stroke="#67634e"
            strokeWidth="1.5"
          />
          <line
            transform={open ? 'rotate(55 7 -3)' : undefined}
            x1="10"
            x2="26"
            y1="0"
            y2="0"
            stroke="#9f987c"
            strokeWidth=".7"
          />
        </g>
      )}
    </g>
  );
}

export default function MapCanvas({
  input,
  map,
  busy,
  exploration,
  members,
  monsters,
  notes,
  onOpenNote,
  pj,
  preview,
  selected,
  selectedMonster,
}: CanvasProps) {
  const { shown, revealed, lit, party, recapCell, visible } = map;
  const {
    zoom,
    stroke,
    ctrlPan,
    space,
    effectiveTool,
    tool,
    keyboard,
    keyboardStart,
    setKeyboard,
    begin,
    drag,
    finish,
    cancel,
    lostCapture,
    keyAction,
    svg,
  } = input;
  const ghostEdges =
    stroke && tool === 'wall'
      ? stroke.points.slice(1).flatMap((p, i) => wallEdges(stroke.points[i], p))
      : [];
  const area =
    stroke && ['room', 'reveal', 'hide'].includes(tool)
      ? {
          x: Math.min(stroke.start[0], stroke.end[0]),
          y: Math.min(stroke.start[1], stroke.end[1]),
          w: Math.abs(stroke.start[0] - stroke.end[0]) + 1,
          h: Math.abs(stroke.start[1] - stroke.end[1]) + 1,
        }
      : null;

  return (
    <svg
      ref={svg}
      className="graph-paper"
      width={WIDTH * zoom}
      height={HEIGHT * zoom}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="application"
      aria-label="Herní mapa. Šipkami vyber políčko, Enter potvrdí tah; místnost a oblast potvrdíš dvakrát, Escape zruší."
      tabIndex={0}
      onPointerDown={begin}
      onPointerMove={drag}
      onPointerUp={finish}
      onPointerCancel={cancel}
      onLostPointerCapture={lostCapture}
      onKeyDown={keyAction}
      style={{
        left: PAPER_MARGIN * zoom,
        top: PAPER_MARGIN * zoom,
        cursor: stroke?.pan
          ? 'grabbing'
          : ctrlPan || space || effectiveTool === 'hand'
            ? 'grab'
            : effectiveTool === 'move'
              ? 'default'
              : 'crosshair',
      }}
    >
      <defs>
        <pattern
          id="squared-paper"
          width={SIZE}
          height={SIZE}
          patternUnits="userSpaceOnUse"
          x={PAD}
          y={PAD}
        >
          <path
            d={`M ${SIZE} 0 L 0 0 0 ${SIZE}`}
            fill="none"
            stroke="#99aebc"
            strokeOpacity=".32"
            strokeWidth=".8"
          />
        </pattern>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="transparent" />
      <rect
        x={PAD}
        y={PAD}
        width={W * SIZE}
        height={H * SIZE}
        fill="none"
        stroke="none"
      />
      {Array.from({ length: W }, (_, x) => (
        <text
          key={'x' + x}
          x={PAD + x * SIZE + SIZE / 2}
          y={16}
          textAnchor="middle"
          className="paper-ruler"
        >
          {x + 1}
        </text>
      ))}
      {Array.from({ length: H }, (_, y) => (
        <text
          key={'y' + y}
          x={12}
          y={PAD + y * SIZE + SIZE / 2 + 3}
          textAnchor="middle"
          className="paper-ruler"
        >
          {y + 1}
        </text>
      ))}
      {shown.floors.map((k) => {
        const [x, y] = k.split(',').map(Number);
        return (
          <rect
            key={k}
            data-map-floor={k}
            x={PAD + x * SIZE + 1}
            y={PAD + y * SIZE + 1}
            width={SIZE - 2}
            height={SIZE - 2}
            fill={revealed.has(k) ? '#ded3ae' : '#bcc1ad'}
            opacity={
              exploration?.enabled && visible && !lit.has(k)
                ? 0.06
                : revealed.has(k)
                  ? 0.2
                  : 0.13
            }
            pointerEvents="none"
          />
        );
      })}
      {Object.entries(shown.edges).map(([key, kind]) => (
        <Wall
          key={key}
          edge={key}
          kind={kind}
          open={shown.openDoors?.includes(key)}
          opacity={
            exploration?.enabled &&
            visible &&
            !edgeCells(key).some((k) => lit.has(k))
              ? 0.3
              : visible || edgeCells(key).some((k) => revealed.has(k))
                ? 1
                : 0.25
          }
        />
      ))}
      {area && (
        <rect
          x={PAD + area.x * SIZE}
          y={PAD + area.y * SIZE}
          width={area.w * SIZE}
          height={area.h * SIZE}
          fill={tool === 'hide' ? '#b38a67' : '#88a074'}
          fillOpacity=".18"
          stroke={tool === 'room' ? '#5c644e' : '#8b9f72'}
          strokeWidth="2"
          strokeDasharray={tool === 'room' ? undefined : '5 4'}
          pointerEvents="none"
        />
      )}
      {ghostEdges.map((k) => (
        <Wall key={'ghost' + k} edge={k} kind="wall" ghost />
      ))}
      {stroke &&
        (tool === 'floor' || tool === 'subtract') &&
        stroke.points.map(([x, y], i) => (
          <rect
            key={i}
            x={PAD + x * SIZE}
            y={PAD + y * SIZE}
            width={SIZE}
            height={SIZE}
            fill={tool === 'subtract' ? '#b98b77' : '#aebc92'}
            opacity=".25"
            pointerEvents="none"
          />
        ))}
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
                aria-label={`${m.name}, políčko ${x + 1}, ${y + 1}`}
                transform={`translate(${PAD + x * SIZE + SIZE / 2},${PAD + y * SIZE + SIZE / 2})`}
                opacity={!visible && !revealed.has(cellKey(x, y)) ? 0.4 : 1}
                style={{
                  cursor: preview ? 'default' : 'grab',
                  pointerEvents: effectiveTool === 'move' ? 'auto' : 'none',
                }}
              >
                <title>
                  {m.name} · {m.hp}/{m.maxHp} životů
                </title>
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

      {Object.entries({
        ...Object.fromEntries(
          (exploration?.stairs || []).map((stair) => [
            cellKey(stair.x, stair.y),
            'both',
          ]),
        ),
        ...shown.stairMarks,
      })
        .filter(([key]) => !visible || shown.revealed.includes(key))
        .map(([key, direction]) => {
          const [x, y] = key.split(',').map(Number);
          return (
            <g
              key={key}
              data-map-stairs={key}
              data-stair-direction={direction}
              transform={`translate(${PAD + x * SIZE + 4},${PAD + y * SIZE + 4})`}
              opacity={
                visible && exploration?.enabled && !lit.has(key) ? 0.3 : 1
              }
              pointerEvents="none"
            >
              <title>
                Schodiště{' '}
                {direction === 'up'
                  ? 'nahoru'
                  : direction === 'down'
                    ? 'dolů'
                    : 'oběma směry'}
              </title>
              <path
                d="M1 25H7V19H13V13H19V7H25"
                fill="none"
                stroke="#877a56"
                strokeWidth="1.8"
              />
              <text x="22" y="24" fontSize="15" fill="#877a56">
                {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '↕'}
              </text>
            </g>
          );
        })}
      {party && exploration?.enabled && !exploration.battle && (
        <g
          data-party="true"
          transform={`translate(${PAD + (party.x + 0.5) * SIZE},${PAD + (party.y + 0.5) * SIZE})`}
          pointerEvents="none"
        >
          <circle r="15" fill="#536b43" stroke="#fffbed" strokeWidth="2" />
          <text y="5" textAnchor="middle" fontSize="15" fill="#fffbed">
            ♟
          </text>
          <title>
            Družina · {party.x + 1}, {party.y + 1}
          </title>
        </g>
      )}
      {Object.entries(shown.access || {}).map(
        ([kind, p]) =>
          p && (
            <g
              key={kind}
              data-map-access={kind}
              role="img"
              aria-label={
                kind === 'entrance' ? 'Vchod do podzemí' : 'Východ z podzemí'
              }
              transform={`translate(${PAD + p[0] * SIZE + 2},${PAD + p[1] * SIZE + 2})`}
              opacity={
                visible && exploration?.enabled && !lit.has(cellKey(...p))
                  ? 0.3
                  : 1
              }
              pointerEvents="none"
            >
              <title>
                {kind === 'entrance'
                  ? 'Vchod · výchozí bod dobrodružství'
                  : 'Východ z podzemí'}
              </title>
              <rect
                width="14"
                height="14"
                rx="3"
                fill="#faf5e5"
                stroke={kind === 'entrance' ? '#52704d' : '#a56e3e'}
              />
              <path
                d={
                  kind === 'entrance'
                    ? 'M3 7H11M8 4L11 7L8 10'
                    : 'M11 7H3M6 4L3 7L6 10'
                }
                fill="none"
                stroke={kind === 'entrance' ? '#52704d' : '#a56e3e'}
                strokeWidth="1.4"
              />
            </g>
          ),
      )}
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
                {m.name} #{m.number}
                {pj
                  ? ` · ${m.hp}/${m.maxHp} životů${m.hidden ? ' · ručně skrytá' : ''}`
                  : m.defeated
                    ? ' · poražená'
                    : ''}
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
                {title}
                {!visible && !n.shared ? ' · pouze PJ' : ''}
              </title>
              {number ? (
                <>
                  <circle
                    r="13"
                    fill="#faf6e7"
                    stroke="#77705d"
                    strokeWidth="1.2"
                    strokeDasharray={!n.shared ? '3 2' : undefined}
                  />
                  <text
                    y="4"
                    textAnchor="middle"
                    fontSize="12"
                    fontFamily="Georgia,serif"
                    fill="#555140"
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
      {recapCell && (
        <rect
          role="img"
          aria-label="Uložené místo z minulého sezení"
          x={PAD + recapCell.x * SIZE + 2}
          y={PAD + recapCell.y * SIZE + 2}
          width={SIZE - 4}
          height={SIZE - 4}
          rx="4"
          fill="none"
          stroke="#9d5d24"
          strokeWidth="3"
          strokeDasharray="5 3"
          pointerEvents="none"
        />
      )}
      <rect
        className="keyboard-cell"
        x={PAD + keyboard[0] * SIZE + 2}
        y={PAD + keyboard[1] * SIZE + 2}
        width={SIZE - 4}
        height={SIZE - 4}
        fill="none"
        stroke="#7d9364"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        pointerEvents="none"
      />
      {keyboardStart && (
        <circle
          cx={PAD + keyboardStart[0] * SIZE}
          cy={PAD + keyboardStart[1] * SIZE}
          r="4"
          fill="#7c9366"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
