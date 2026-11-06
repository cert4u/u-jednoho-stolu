'use client';

import {useState} from 'react';
import {Plus} from 'lucide-react';
import {bestiaryEntries, bestiaryEnvironments, findBestiaryEntry, type BestiaryEnvironment} from '../lib/bestiary';

function searchableName(value: string) {
  return value.trim().toLocaleLowerCase('cs').normalize('NFD').replace(/\p{M}/gu, '');
}

const sortedEntries = [...bestiaryEntries].sort((a, b) => a.name.localeCompare(b.name, 'cs'));

export function BestiaryPortrait({templateId}: {templateId?: string}) {
  const entry = findBestiaryEntry(templateId);
  if (!entry) return null;

  return (
    <img className="bestiary-portrait" src={`/monsters/${entry.portrait ?? entry.id}.webp`}
      alt={`Ilustrace: ${entry.name}`} width={400} height={480} loading="lazy"/>
  );
}

export default function BestiaryPanel({busy, onAdd}: {
  busy: boolean;
  onAdd: (templateId: string) => Promise<boolean | undefined>;
}) {
  const [added, setAdded] = useState<{name: string; count: number}>();

  const [environment, setEnvironment] = useState<BestiaryEnvironment | ''>('');
  const [query, setQuery] = useState('');
  const needle = searchableName(query);
  const visibleEntries = sortedEntries.filter(entry =>
    (!environment || entry.environments.includes(environment)) &&
    searchableName(entry.name).includes(needle)
  );

  return (
    <section aria-labelledby="bestiary-title">
      <h3 id="bestiary-title">Bestiář</h3>
      <p className="sheet-hint">Vyber předlohu pro aktuální patro. Životy a bojové hodnoty jsou návrh, který můžeš po přidání upravit.</p>
      <div className="bestiary-filters">
        <label>Prostředí
          <select value={environment} onChange={event => setEnvironment(event.target.value as BestiaryEnvironment | '')}>
            <option value="">Všechna prostředí</option>
            {Object.entries(bestiaryEnvironments).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label>Hledat podle názvu
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Např. bludička"/>
        </label>
      </div>
      <p className="sheet-hint" role="status">
        {visibleEntries.length ? `Předlohy: ${visibleEntries.length} z ${sortedEntries.length}` : 'Žádná předloha neodpovídá. Zkus jiné prostředí nebo název.'}
      </p>
      {added && (
        <p className="bestiary-status" role="status">
          {added.name} · přidáno {added.count}×. Příšeru najdeš v seznamu.
        </p>
      )}
      <ul className="bestiary-grid">
        {visibleEntries.map(entry => (
          <li key={entry.id} className="bestiary-card">
            <BestiaryPortrait templateId={entry.id}/>
            <h4>{entry.name}</h4>
            <p>{entry.description}</p>
            <p className="bestiary-gm-hint"><strong>Jak ji hrát</strong> {entry.gmHint}</p>
            <small>{entry.maxHp} ž. · ÚČ {entry.combat.attack} · OČ {entry.combat.defense} · útočnost {entry.combat.damage}</small>
            <button type="button" className="secondary" disabled={busy} aria-label={`Přidat příšeru: ${entry.name}`}
              onClick={async () => {
                if (await onAdd(entry.id)) {
                  setAdded(previous => ({name:entry.name, count:previous?.name === entry.name ? previous.count + 1 : 1}));
                }
              }}>
              <Plus size={14}/> Přidat
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
