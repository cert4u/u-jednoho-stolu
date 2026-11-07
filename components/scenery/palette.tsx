'use client';
import { useState } from 'react';
import { sceneryCatalog, type Scenery, type SceneryKind } from '../../lib/scenery';
import SceneryGlyph from './glyph';
export type SceneryBrush = Pick<Scenery,'kind'|'rotation'|'size'|'hidden'>;
export default function SceneryPalette({ brush, onChange, moving, onCancelMove }: {
  brush: SceneryBrush; onChange: (next: SceneryBrush) => void; moving: boolean; onCancelMove: () => void;
}) {
  const [environment,setEnvironment] = useState('all');
  return <section className="scenery-palette" aria-label="Stafáž mapy">
    <div className="scenery-palette-heading"><strong>Stafáž</strong><label>Prostředí<select value={environment} onChange={event => setEnvironment(event.target.value)}>
      <option value="all">Všechna</option><option value="castle">Hrad</option><option value="mine">Důl</option><option value="cave">Jeskyně</option>
    </select></label></div>
    <div className="scenery-choices" role="group" aria-label="Prvky stafáže">
      {sceneryCatalog.filter(item => environment === 'all' || item.environments.includes(environment)).map(item => <button type="button"
        key={item.kind} aria-pressed={brush.kind === item.kind} aria-label={item.name} title={item.name}
        onClick={() => onChange({ ...brush, kind: item.kind as SceneryKind })}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><SceneryGlyph kind={item.kind} /></svg><span>{item.name}</span>
      </button>)}
    </div>
    <div className="scenery-brush-controls"><label>Velikost<select value={brush.size} onChange={event => onChange({ ...brush, size: event.target.value as Scenery['size'] })}>
      <option value="small">Malá</option><option value="medium">Střední</option><option value="large">Velká</option>
    </select></label><button type="button" onClick={() => onChange({ ...brush, rotation: ((brush.rotation+90)%360) as Scenery['rotation'] })}>Otočit · {brush.rotation}°</button>
    <label className="scenery-hidden"><input type="checkbox" checked={Boolean(brush.hidden)} onChange={event => onChange({ ...brush, hidden: event.target.checked })} />Jen PJ</label></div>
    {moving ? <p role="status">Klikni na nové místo prvku. <button type="button" onClick={onCancelMove}>Zrušit přesun</button></p> :
      <p>Kliknutím do mapy přidáš prvek. Kliknutím na stafáž otevřeš úpravy. Šipky a Enter fungují také.</p>}
  </section>;
}
