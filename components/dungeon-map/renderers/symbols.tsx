import type { MapAppearance } from '../use-map-appearance';

/** Positioned within a 36 px cell by the caller, for both play and preview. */
export function StairSymbol({ direction, appearance }: { direction: string; appearance: MapAppearance }) {
  const ink = appearance === 'hand-drawn' ? '#493e2e' : '#877a56';
  return <>
    <path d="M1 25H7V19H13V13H19V7H25" fill="none" stroke={ink} strokeWidth="1.8" />
    <text x="22" y="24" fontSize="15" fill={ink}>
      {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '↕'}
    </text>
  </>;
}
