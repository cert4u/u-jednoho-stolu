'use client';

import { useRef, useState } from 'react';
import { emptyStoryBeat, storyPhases, type StoryBeat, type StoryPhase } from '../lib/story-phases';
import type { StoryOutlineView } from '../lib/story-outline';

export default function StoryOutlinePanel({ outline, busy, onSave, onOpenPlace }: {
  outline: StoryOutlineView;
  busy: boolean;
  onSave: (values: Record<string, unknown>) => Promise<boolean | undefined>;
  onOpenPlace: (id: string) => void;
}) {
  const [initial] = useState(() => ({ revision: outline.revision,
    phases: Object.fromEntries(storyPhases.map(({ id }) => [id, structuredClone(outline.phases[id] ?? emptyStoryBeat())])) as Record<StoryPhase, StoryBeat> }));
  const [phases, setPhases] = useState(initial.phases);
  const pending = useRef<{ signature: string; id: string } | null>(null);
  const stale = outline.revision !== initial.revision;
  const dirty = JSON.stringify(phases) !== JSON.stringify(initial.phases);
  function update(id: StoryPhase, values: Partial<StoryBeat>) {
    setPhases(current => ({ ...current, [id]: { ...current[id], ...values } }));
  }
  return <>
    <span className="eyebrow">SOUKROMÁ PŘÍPRAVA PJ</span>
    <h2>Příběhová osnova</h2>
    <p className="sheet-hint">Vyplň jen to, co potřebuješ. Fáze jsou pomůcka pro přípravu, nikoli povinné pořadí návštěv. Jedno místo může patřit k více fázím.</p>
    {stale && <p className="map-note-conflict" role="status">Osnova nebo její vazby se mezitím změnily. Rozepsané texty zůstávají tady; pro poslední verzi panel otevři znovu.</p>}
    <form data-dirty={dirty} onSubmit={event => {
      event.preventDefault();
      if (busy || stale) return;
      const values = { phases, expectedRevision: initial.revision };
      const signature = JSON.stringify(values);
      if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
      void onSave({ ...values, requestId: pending.current.id });
    }}>
      {storyPhases.map(({ id, title, hint }, index) => {
        const beat = phases[id];
        return <details key={id} className="story-phase">
          <summary><span>{index + 1}. {title}</span><small>{beat.played ? 'Odehráno' : beat.title || `${beat.noteIds.length} míst`}</small></summary>
          <p className="sheet-hint">{hint}</p>
          <fieldset disabled={busy}>
            <label>Nadpis – {title}<input maxLength={100} value={beat.title} onChange={event => update(id, { title: event.target.value })} /></label>
            <label>Poznámka PJ – {title}<textarea rows={4} maxLength={3000} value={beat.notes} onChange={event => update(id, { notes: event.target.value })} /></label>
            <label className="story-check"><input type="checkbox" checked={beat.played} onChange={event => update(id, { played: event.target.checked })} /> Odehráno – {title}</label>
            <details className="story-link-picker"><summary>Přiřadit místa ({beat.noteIds.length})</summary>
              {!outline.places.length ? <p className="sheet-hint">Nejdřív přidej poznámku přes Označit místo v mapě nebo vygeneruj jeskyni.</p> :
                <div className="story-place-options" role="group" aria-label={`Místa – ${title}`}>
                  {outline.places.map(place => <label key={place.id} className="story-check">
                    <input type="checkbox" checked={beat.noteIds.includes(place.id)} onChange={event => update(id, {
                      noteIds: event.target.checked ? [...beat.noteIds, place.id] : beat.noteIds.filter(noteId => noteId !== place.id),
                    })} />
                    <span>{place.levelName} · {place.roomNumber ? `${place.roomNumber}. ` : ''}{place.title}</span>
                  </label>)}
                </div>}
            </details>
          </fieldset>
          <div className="story-place-links">
            {beat.noteIds.map(noteId => {
              const place = outline.places.find(item => item.id === noteId);
              return place && <button type="button" className="secondary" key={noteId} disabled={busy}
                onClick={() => onOpenPlace(noteId)}>
                Otevřít přípravu: {place.levelName} · {place.roomNumber ? `${place.roomNumber}. ` : ''}{place.title}
              </button>;
            })}
          </div>
        </details>;
      })}
      <button className="primary" disabled={busy || stale}>Uložit osnovu</button>
    </form>
  </>;
}
