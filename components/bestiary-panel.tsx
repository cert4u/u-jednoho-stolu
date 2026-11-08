'use client';
import Image from 'next/image';

import {useEffect,useMemo,useState} from 'react';
import {Plus} from 'lucide-react';
import {bestiaryEnvironments, type BestiaryEnvironment} from '../lib/bestiary-environments';
import type {BestiaryEntry} from '../lib/bestiary';
import {requestBestiary} from './game-table/game-client';
import type {Session} from './game-table/types';

function searchableName(value: string) {
  return value.trim().toLocaleLowerCase('cs').normalize('NFD').replace(/\p{M}/gu, '');
}

export function BestiaryPortrait({portrait, name}: {portrait?: string; name: string}) {
  if (!portrait) return <span className="sheet-hint">Bez dostupné ilustrace</span>;
  return (
    <Image unoptimized className="bestiary-portrait" src={portrait.startsWith('data:image/webp;base64,')||/^\/catalog-assets\/[a-f0-9]{64}\.webp$/.test(portrait)?portrait:`/monsters/${portrait}.webp`}
      alt={`Ilustrace: ${name}`} width={400} height={480} loading="lazy"/>
  );
}

type Props = {
  busy: boolean;
  onAdd: (templateId: string) => Promise<boolean | undefined>;
  session: Session;
};
export default function BestiaryPanel(props: Props) {
  return <ScopedBestiaryPanel key={props.session.room+':'+props.session.token} {...props}/>;
}
function ScopedBestiaryPanel({busy,onAdd,session}:Props) {
  const [entries, setEntries] = useState<BestiaryEntry[]>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void requestBestiary(session, controller.signal).then(
      data => { if (!controller.signal.aborted) setEntries(data); },
      () => { if (!controller.signal.aborted) setError(true); },
    );
    return () => controller.abort();
  }, [session, attempt]);

  const sortedEntries = useMemo(
    () => [...(entries ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    [entries],
  );
  const [added, setAdded] = useState<{name: string; count: number}>();

  const [environment, setEnvironment] = useState<BestiaryEnvironment | ''>('');
  const [query, setQuery] = useState('');
  const needle = searchableName(query);
  const visibleEntries = sortedEntries.filter(entry =>
    (!environment || entry.environments.includes(environment)) &&
    searchableName(entry.name).includes(needle)
  );

  if (error) return <div role="alert">
    <p>Bestiář se nepodařilo načíst.</p>
    <button type="button" className="secondary" onClick={() => {setEntries(undefined);setError(false);setAttempt(value => value + 1);}}>Zkusit znovu</button>
  </div>;
  if (!entries) return <p role="status">Načítám bestiář…</p>;

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
            <BestiaryPortrait portrait={entry.portrait} name={entry.name}/>
            <h4>{entry.name}</h4>{entry.catalogSource&&entry.catalogSource.id!=='builtin'&&<small>{entry.catalogSource.name??entry.catalogSource.id} · {entry.catalogSource.version}</small>}
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
