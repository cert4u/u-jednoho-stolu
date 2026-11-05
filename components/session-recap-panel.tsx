'use client';

import {useRef, useState} from 'react';
import {MapPin} from 'lucide-react';
import {RECAP_CLUES_LIMIT, RECAP_SUMMARY_LIMIT, type SessionRecapView} from '../lib/session-recap';
import type {Location} from '../lib/exploration';

type MapPoint = 'keep' | 'current' | 'clear';

export default function SessionRecapPanel({recap, pj, busy, canCapture, canLocate, onLocate, onSave}: {
  recap?: SessionRecapView;
  pj: boolean;
  busy: boolean;
  canCapture: boolean;
  canLocate: boolean;
  onLocate: (location: Location) => void;
  onSave: (values: Record<string, unknown>) => Promise<boolean | undefined>;
}) {
  const [initial] = useState(recap);
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [clues, setClues] = useState(initial?.clues ?? '');
  const [initialMapPoint] = useState<MapPoint>(!initial && canCapture ? 'current' : 'keep');
  const [mapPoint, setMapPoint] = useState(initialMapPoint);
  const pending = useRef<{signature: string; id: string} | null>(null);
  const stale = recap?.revision !== initial?.revision;
  const dirty = summary !== (initial?.summary ?? '') || clues !== (initial?.clues ?? '') ||
    mapPoint !== initialMapPoint;
  const location = recap?.location;

  return <>
    <span className="eyebrow">KRONIKA DRUŽINY</span>
    <h2>Kde jsme skončili</h2>
    {recap && <p className="sheet-hint">Zapsáno {new Date(recap.savedAt).toLocaleString('cs', {dateStyle:'medium', timeStyle:'short'})}</p>}
    {location && <div className="recap-location">
      <span><MapPin size={16} aria-hidden="true"/> {location.levelName} · políčko {location.x + 1}, {location.y + 1}</span>
      {canLocate && <button type="button" onClick={() => onLocate(location)}>Ukázat na mapě</button>}
    </div>}
    {!pj ? recap ? <div className="recap-reading">
      <h3>Minulé sezení</h3><p>{recap.summary}</p>
      {recap.clues && <><h3>Otevřené stopy</h3><p>{recap.clues}</p></>}
    </div> : <p>PJ sem může po sezení zapsat, kde družina skončila.</p> : <>
      <p className="sheet-hint">Shrnutí a stopy uvidí celá družina. Nový zápis nahradí předchozí.</p>
      {stale && <p className="map-note-conflict" role="status">Zápis se mezitím změnil. Pro úpravu poslední verze panel otevři znovu.</p>}
      <form data-dirty={dirty} onSubmit={event => {
        event.preventDefault();
        if (stale || busy) return;
        const values = {summary, clues, mapPoint, expectedRevision:initial?.revision ?? null};
        const signature = JSON.stringify(values);
        if (pending.current?.signature !== signature) pending.current = {signature, id:crypto.randomUUID()};
        void onSave({...values, requestId:pending.current.id});
      }}>
        <label>Minulé sezení<textarea rows={5} required maxLength={RECAP_SUMMARY_LIMIT} value={summary} onChange={event => setSummary(event.target.value)}/></label>
        <label>Otevřené stopy<textarea rows={3} maxLength={RECAP_CLUES_LIMIT} value={clues} onChange={event => setClues(event.target.value)}/></label>
        <label>Místo na mapě<select value={mapPoint} onChange={event => setMapPoint(event.target.value as MapPoint)}>
          <option value="keep">{location ? 'Ponechat uložené místo' : 'Ponechat zápis beze změny místa'}</option>
          <option value="current" disabled={!canCapture}>Uložit aktuální polohu družiny</option>
          <option value="clear">Uložit bez místa na mapě</option>
        </select></label>
        <button className="primary" disabled={busy || stale || !summary.trim() || (mapPoint === 'current' && !canCapture)}>Uložit pro družinu</button>
      </form>
    </>}
  </>;
}
