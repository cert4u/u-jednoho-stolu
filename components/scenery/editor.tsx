'use client';
import { useRef, useState } from 'react';
import { sceneryName, type Scenery } from '../../lib/scenery';
export default function SceneryEditor({ item, current, busy, onSave, onRemove, onMove }: {
  item: Scenery; current?: Scenery; busy: boolean;
  onSave: (values: Record<string,unknown>) => Promise<unknown>;
  onRemove: (values: Record<string,unknown>) => Promise<unknown>; onMove: () => void;
}) {
  const [values,setValues] = useState(() => ({ rotation:item.rotation,size:item.size,note:item.note ?? '',hidden:Boolean(item.hidden) }));
  const pending = useRef<{ signature:string; id:string } | null>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify({ rotation:item.rotation,size:item.size,note:item.note ?? '',hidden:Boolean(item.hidden) });
  const stale = !current || (current.revision ?? 0) !== (item.revision ?? 0);
  const base = { sceneryId:item.id, expectedRevision:item.revision ?? 0 };
  return <><h2>{sceneryName(item.kind)}</h2><p className="sheet-hint">Políčko {item.x+1}, {item.y+1} · Pouze vizuální prvek, neblokuje pohyb.</p>
    {stale && <p role="status" className="map-note-conflict">Prvek se mezitím změnil nebo zmizel. Rozepsané údaje zůstávají; otevři jej znovu.</p>}
    <form data-dirty={dirty} onSubmit={event => {
      event.preventDefault(); if (busy || stale) return;
      const data = { ...base, ...values, kind:item.kind,x:item.x,y:item.y };
      const signature=JSON.stringify(data);
      if(pending.current?.signature !== signature) pending.current={ signature,id:crypto.randomUUID() };
      void onSave({ ...data,requestId:pending.current.id });
    }}>
      <label>Velikost<select value={values.size} onChange={event => setValues({ ...values,size:event.target.value as Scenery['size'] })}><option value="small">Malá</option><option value="medium">Střední</option><option value="large">Velká</option></select></label>
      <label>Otočení<select value={values.rotation} onChange={event => setValues({ ...values,rotation:Number(event.target.value) as Scenery['rotation'] })}>{[0,90,180,270].map(angle => <option key={angle} value={angle}>{angle}°</option>)}</select></label>
      <label className="scenery-hidden"><input type="checkbox" checked={values.hidden} onChange={event => setValues({ ...values,hidden:event.target.checked })} /> Skrýt před hráči</label>
      <label>Poznámka PJ<textarea rows={3} maxLength={1000} value={values.note} onChange={event => setValues({ ...values,note:event.target.value })} /></label>
      <button className="primary" disabled={busy || stale}>Uložit stafáž</button>
    </form>
    <button className="secondary" disabled={busy || stale || dirty} onClick={onMove}>Přesunout v mapě</button>
    {dirty && <p className="sheet-hint">Před přesunem nejdřív ulož změny.</p>}
    <button className="secondary" disabled={busy || stale || dirty} onClick={() => void onRemove({ ...base,requestId:crypto.randomUUID() })}>Odstranit stafáž</button>
  </>;
}
