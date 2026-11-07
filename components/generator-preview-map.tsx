'use client';

import { memo, useId, useMemo } from 'react';
import { roomLabelPoint } from '../lib/room-labels';
import type { GeneratedFloor, RoomRole } from '../lib/generator-types';
import { HEIGHT, PAD, SIZE, WIDTH } from './dungeon-map/model';
import { buildInkDrawing } from './dungeon-map/drawing/geometry';
import { ClassicSurface } from './dungeon-map/renderers/classic';
import { HandDrawnSurface } from './dungeon-map/renderers/hand-drawn';
import { StairSymbol } from './dungeon-map/renderers/symbols';
import type { MapAppearance } from './dungeon-map/use-map-appearance';

const roles: Record<RoomRole, string> = {
  entrance: 'vstupní místnost', room: 'místnost', junction: 'křižovatka',
  'dead-end': 'slepá odbočka', chamber: 'významná komnata', goal: 'cílová místnost',
};

/** Uses exactly the same floor/wall/door presentation as the playing canvas.
 * The generated proposal is private to PJ; topology highlights are preview-only.
 */
export default memo(function GeneratorPreviewMap({ floor, appearance }: {
  floor: GeneratedFloor;
  appearance: MapAppearance;
}) {
  const id = useId().replace(/:/g, '');
  const known = useMemo(() => new Set(floor.map.floors), [floor.map]);
  const drawing = useMemo(() => appearance === 'hand-drawn'
    ? buildInkDrawing(floor.map, known, known, true, false) : undefined,
  [floor.map, known, appearance]);
  const hand = appearance === 'hand-drawn';
  const ink = hand ? '#493e2e' : '#585544';
  const paper = hand ? '#f6efdd' : '#f9f4e5';
  const surface = { shown: floor.map, revealed: known, lit: known, visible: true, exploring: false };
  return <svg className="generator-map" data-map-style={appearance}
    viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img"
    aria-label={`Náhled: ${floor.name}, ${floor.rooms.length} místností`}>
    <defs>
      <pattern id={`preview-grid-${id}`} x={PAD} y={PAD} width={SIZE} height={SIZE} patternUnits="userSpaceOnUse">
        <path d={`M${SIZE} 0H0V${SIZE}`} fill="none"
          stroke={hand ? '#887a5e' : '#8ca5b2'} strokeOpacity={hand ? .075 : .17} strokeWidth="1" />
      </pattern>
    </defs>
    <rect width={WIDTH} height={HEIGHT} fill={paper} />
    <rect width={WIDTH} height={HEIGHT} fill={`url(#preview-grid-${id})`} />
    {drawing ? <HandDrawnSurface {...surface} drawing={drawing} id={id} /> : <ClassicSurface {...surface} />}
    <g pointerEvents="none">
      {floor.rooms.map((room, i) => {
        const label = roomLabelPoint(room, floor.map);
        const x = PAD + (label[0] + .5) * SIZE, y = PAD + (label[1] + .5) * SIZE;
        return <g key={room.id || i} data-preview-room={room.id || i}>
          <title>{`Místnost ${i + 1}${room.role ? ' · ' + roles[room.role] : ''}`}</title>
          {room.cells ? room.cells.map(key => {
            const [x, y] = key.split(',').map(Number);
            return <rect key={key} x={PAD + x * SIZE} y={PAD + y * SIZE}
              width={SIZE} height={SIZE} fill={room.mainPath ? '#90a279' : '#c5b77d'} opacity={hand ? .07 : .16} />;
          }) : <rect x={PAD + room.x * SIZE} y={PAD + room.y * SIZE}
            width={room.width * SIZE} height={room.height * SIZE} fill="#c5b77d" opacity=".12" />}
          <circle cx={x} cy={y} r="14" fill={paper} stroke={room.role === 'goal' ? '#9b7140' : ink}
            strokeWidth={room.role === 'goal' ? 2 : 1} strokeOpacity={room.role === 'goal' ? 1 : .3} />
          <text x={x} y={y + 5.5} textAnchor="middle" fontFamily="Georgia,serif" fontSize="16"
            fill={room.mainPath ? '#3e6343' : ink}>{i + 1}</text>
        </g>;
      })}
      {Object.entries(floor.map.stairMarks || {}).map(([key, direction]) => {
        const [x, y] = key.split(',').map(Number);
        return <g key={key} data-map-stairs={key} data-stair-direction={direction}
          transform={`translate(${PAD + x * SIZE + 4},${PAD + y * SIZE + 4})`}>
          <StairSymbol direction={direction} appearance={appearance} />
        </g>;
      })}
      {Object.entries(floor.map.access || {}).map(([kind, p]) => p &&
        <g key={kind} data-map-access={kind} transform={`translate(${PAD + (p[0] + .5) * SIZE},${PAD + (p[1] + .5) * SIZE})`}>
          <circle r="14" fill={paper} stroke={kind === 'entrance' ? '#52704d' : '#a56e3e'} strokeWidth="2" />
          <text y="5.5" textAnchor="middle" fontFamily="Georgia,serif" fontSize="16" fill={ink}>
            {kind === 'entrance' ? 'V' : 'E'}
          </text>
        </g>)}
    </g>
  </svg>;
});
