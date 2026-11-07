import type { MapAppearance } from '../use-map-appearance';

export default function MapAppearanceControl({ appearance, onChange, label = 'Vzhled mapy' }: {
  appearance: MapAppearance;
  onChange: (value: MapAppearance) => void;
  label?: string;
}) {
  return <label className="map-appearance">
    <span>Kresba</span>
    <select aria-label={label} value={appearance}
      onChange={event => onChange(event.target.value as MapAppearance)}>
      <option value="classic">Klasický</option>
      <option value="hand-drawn">Ručně kreslený</option>
    </select>
  </label>;
}
