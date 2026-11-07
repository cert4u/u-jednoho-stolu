import { memo } from 'react';
import { PAD, SIZE, edgeVertices } from '../model';
import { doorAppearance, edgeOpacity, type InkDrawing } from '../drawing/geometry';
import { inkPalettes } from '../drawing/palettes';
import type { SurfaceProps } from './classic';

const InkContours = memo(function InkContours({ drawing, id }: { drawing: InkDrawing; id: string }) {
  const palette = inkPalettes[drawing.theme];
  return (
    <g data-ink-theme={drawing.theme} pointerEvents="none" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={drawing.outside} fillRule="evenodd" clipRule="evenodd" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`} stroke={palette.shade} fill="none" strokeLinecap="round">
        <path d={drawing.grain} strokeWidth="1.2" opacity="0.09" />
        {drawing.hatching.map(({ d, opacity }) => (
          <path key={opacity} d={d} strokeWidth="0.9" opacity={opacity * 0.43} />
        ))}
        {drawing.details.map(({ d, opacity }) => (
          <path key={opacity} d={d} strokeWidth="0.65" opacity={opacity * 0.32} />
        ))}
      </g>
      <g fill="none" stroke={palette.ink} strokeLinecap="round" strokeLinejoin="round">
        {drawing.walls.map(({ d, opacity }) => (
          <g key={opacity} opacity={opacity}>
            <path d={d} strokeWidth="4.6" opacity="0.09" />
            <path d={d} strokeWidth="2.35" />
          </g>
        ))}
        {drawing.accents.map(({ d, opacity, width }) => (
          <path key={`${opacity}:${width}`} d={d} strokeWidth={width} opacity={opacity * 0.65}
            transform="translate(.3 .35)" />
        ))}
      </g>
    </g>
  );
});

export function HandDrawnSurface({
  shown, revealed, lit, visible, exploring, drawing, id,
}: SurfaceProps & { drawing: InkDrawing; id: string }) {
  const palette = inkPalettes[drawing.theme];
  return (
    <g data-map-renderer="hand-drawn" pointerEvents="none">
      {shown.floors.map(key => {
        const [x, y] = key.split(',').map(Number);
        const remembered = visible && exploring && !lit.has(key);
        return (
          <rect key={key} data-map-floor={key} x={PAD + x * SIZE} y={PAD + y * SIZE}
            width={SIZE} height={SIZE}
            fill={remembered ? '#b4b0a3' : palette.floor}
            opacity={remembered ? 0.2 : visible || revealed.has(key) ? 0.73 : 0.32} />
        );
      })}
      <InkContours drawing={drawing} id={`ink-outside-${id}`} />
      {Object.entries(shown.edges).filter(([, kind]) => kind === 'door').map(([key]) => {
        const [a, b] = edgeVertices(key);
        const horizontal = a[1] === b[1];
        const kind = doorAppearance(shown, key);
        const open = kind === 'open' || kind === 'secret-open';
        const secret = kind === 'secret' || kind === 'secret-open';
        return (
          <g key={key} data-map-edge={key} data-edge-kind="door" data-door-appearance={kind}
            opacity={edgeOpacity(key, revealed, lit, visible, exploring)}
            transform={`translate(${PAD + a[0] * SIZE},${PAD + a[1] * SIZE}) rotate(${horizontal ? 0 : 90})`}
            stroke={palette.ink} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M0 0L7 .2M29 -.15L36 0" strokeWidth="2.6" />
            <path d="M7 -4V4M29 -4V4" strokeWidth="1.5" />
            <g transform={open ? 'rotate(-66 8 0)' : undefined}>
              <path d="M8 -3.5L28 -3L28 3.2L8 3.5Z" fill={palette.floor}
                strokeWidth="1.6" strokeDasharray={secret ? '3 2' : undefined} />
              <path d="M11 -.3L25 .3" strokeWidth=".65" opacity=".65" />
            </g>
            {shown.doorSettings?.[key]?.locked && <path d="M16 -1V-5Q18 -9 20 -5V-1M15 -1H21V4H15Z" fill={palette.floor} strokeWidth="1" />}
            {secret && <text x="18" y="-7" fill={palette.ink} stroke="none"
              textAnchor="middle" fontFamily="Georgia,serif" fontSize="9">S</text>}
          </g>
        );
      })}
    </g>
  );
}
