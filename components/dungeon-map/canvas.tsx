import type { CanvasProps } from './canvas-types';
import PlayerTokens from './layers/player-tokens';
import MonsterTokens from './layers/monster-tokens';
import MapNotes from './layers/map-notes';
import { useCatalog } from '../catalog-provider';
import OrganicSurfaces from '../scenery/surfaces';
import { paintSurface } from '../../lib/surfaces';
import SceneryPreview from '../scenery/preview';
import SceneryLayer from '../scenery/layer';
import { useId, useMemo } from 'react';
import { cellKey, wallEdges } from '../../lib/dungeon';
import { W, H, WIDTH, HEIGHT, SIZE, PAD, PAPER_MARGIN } from './model';
import { StairSymbol } from './renderers/symbols';
import { ClassicSurface, ClassicWall } from './renderers/classic';
import { HandDrawnSurface } from './renderers/hand-drawn';
import { buildInkDrawing } from './drawing/geometry';

export default function MapCanvas({
  input,
  appearance,
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
  surfaceBrush,
  sceneryPreview = [],
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
  const { scenery: catalogScenery } = useCatalog();
  const uniqueId = useId().replace(/:/g, '');
  const drawingKey = JSON.stringify([
    [...shown.floors].sort(),
    Object.entries(shown.edges).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    ),
    shown.generation ?? null,
    shown.access ?? null,
    shown.stairMarks ?? null,
    [...revealed].sort(),
    [...lit].sort(),
    visible,
    Boolean(exploration?.enabled),
  ]);
  const drawing = useMemo(
    () =>
      appearance === 'hand-drawn'
        ? buildInkDrawing(
            shown,
            revealed,
            lit,
            visible,
            Boolean(exploration?.enabled),
          )
        : undefined,
    // A canonical content key keeps polling clones and pointer updates out of this calculation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appearance, drawingKey],
  );
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
      className={`graph-paper ${appearance}`}
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
      {drawing ? (
        <HandDrawnSurface
          drawing={drawing}
          id={uniqueId}
          shown={shown}
          revealed={revealed}
          lit={lit}
          visible={visible}
          exploring={Boolean(exploration?.enabled)}
        />
      ) : (
        <ClassicSurface
          shown={shown}
          revealed={revealed}
          lit={lit}
          visible={visible}
          exploring={Boolean(exploration?.enabled)}
        />
      )}
      <OrganicSurfaces
        map={(() => {
          if (!stroke?.surface) return shown;
          const draft = { ...shown, surfaces: shown.surfaces };
          try {
            paintSurface(
              draft,
              { ...stroke.surface, points: stroke.points },
              catalogScenery,
            );
            return draft;
          } catch {
            return shown;
          }
        })()}
        lit={lit}
        revealed={revealed}
        visible={visible}
        exploring={Boolean(exploration?.enabled)}
      />
      <SceneryLayer
        map={shown}
        lit={lit}
        revealed={revealed}
        visible={visible}
        exploring={Boolean(exploration?.enabled)}
        editable={
          pj && !preview && effectiveTool === 'scenery' && !surfaceBrush
        }
      />
      {pj && !preview && <SceneryPreview items={sceneryPreview} />}
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
        <ClassicWall key={'ghost' + k} edge={k} kind="wall" ghost />
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
      <PlayerTokens
        members={members}
        exploration={exploration}
        preview={preview}
        selected={selected}
        visible={visible}
        revealed={revealed}
        stroke={stroke}
        effectiveTool={effectiveTool}
      />
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
                {`Schodiště ${direction === 'up' ? 'nahoru' : direction === 'down' ? 'dolů' : 'oběma směry'}`}
              </title>
              <StairSymbol direction={direction} appearance={appearance} />
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
          <title>{`Družina · ${party.x + 1}, ${party.y + 1}`}</title>
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
      <MonsterTokens
        monsters={monsters}
        pj={pj}
        preview={preview}
        selectedMonster={selectedMonster}
        visible={visible}
        stroke={stroke}
        effectiveTool={effectiveTool}
      />
      <MapNotes
        notes={notes}
        appearance={appearance}
        busy={busy}
        pj={pj}
        exploration={exploration}
        onOpenNote={onOpenNote}
        shown={shown}
        visible={visible}
        lit={lit}
        stroke={stroke}
        effectiveTool={effectiveTool}
        space={space}
        setKeyboard={setKeyboard}
      />
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
