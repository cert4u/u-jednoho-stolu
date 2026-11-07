'use client';
import { useEffect, useState } from 'react';
import type { AdventureSummary } from '../../lib/adventure-templates';
import {
  ArrowRight,
  Compass,
  Dices,
  Map,
  MessageSquare,
  Swords,
} from 'lucide-react';
import { RestoreForms } from '../campaign-access';
import type { GameAction } from './types';
type Props = {
  name: string;
  code: string;
  joining: boolean;
  busy: boolean;
  error: string;
  setName: (name: string) => void;
  setCode: (code: string) => void;
  setJoining: (joining: boolean) => void;
  setError: (error: string) => void;
  act: GameAction;
};

export default function Lobby({
  name,
  code,
  joining,
  busy,
  error,
  setName,
  setCode,
  setJoining,
  setError,
  act,
}: Props) {
  const [adventures, setAdventures] = useState<AdventureSummary[]>([]);
  const [adventureId, setAdventureId] = useState('');
  const chosen = adventures.find((adventure) => adventure.id === adventureId);

  useEffect(() => {
    if (joining) return;
    const controller = new AbortController();
    void fetch('/api/adventures', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((entries) => {
        if (!controller.signal.aborted && Array.isArray(entries))
          setAdventures(entries);
      })
      .catch(() => {
        // A fresh campaign is available even when the catalog cannot be loaded.
      });
    return () => controller.abort();
  }, [joining]);

  return (
    <main className="lobby">
      <div className="lobby-nav">
        <span className="brand">
          <Swords /> U jednoho stolu
        </span>
        <span>Malá aplikace. Velká dobrodružství.</span>
      </div>
      <div className="lobby-grid">
        <section>
          <span className="eyebrow">PRO VEČERY, KTERÉ STOJÍ ZA VYPRÁVĚNÍ</span>
          <h1>
            Stačí parta.
            <br />
            Kostky.
            <br />
            <em>A dobrý příběh.</em>
          </h1>
          <p>
            Váš společný stůl pro stará dobrá dobrodružství.
            <br />
            Mapa, postavy a špetka náhody. Zbytek je na vás.
          </p>
          <div className="features">
            <span>
              <Map size={17} /> Společná mapa
            </span>
            <span>
              <Dices size={17} /> Poctivé hody
            </span>
            <span>
              <MessageSquare size={17} /> Tajné šeptání
            </span>
          </div>
        </section>
        <section className="join-card">
          <div className="seal">
            <Swords size={30} />
          </div>
          <h2>{joining ? 'Tvoje místo u stolu' : 'Začneme dobrodružství?'}</h2>
          <p>
            {joining
              ? 'Zadej kód od Pána jeskyně a přisedni si.'
              : 'Založ stůl pro svou družinu. Příběh je na tobě.'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(joining ? 'join' : 'create', {
                name,
                room: code.trim().toUpperCase(),
                ...(!joining && chosen ? { adventureId: chosen.id } : {}),
              });
            }}
          >
            <label>
              {joining ? 'Jméno postavy' : 'Jak ti máme říkat?'}
              <input
                required
                maxLength={30}
                placeholder={
                  joining ? 'Třeba Borin Železný' : 'Třeba Pán jeskyně'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {joining && (
              <label>
                Kód místnosti
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Kód od vašeho PJ"
                />
              </label>
            )}
            {!joining && adventures.length > 0 && (
              <label className="adventure-template-field">
                Předloha dobrodružství
                <select
                  value={adventureId}
                  onChange={(event) => setAdventureId(event.target.value)}
                >
                  <option value="">Vlastní dobrodružství</option>
                  {adventures.map((adventure) => (
                    <option key={adventure.id} value={adventure.id}>
                      {adventure.title}
                    </option>
                  ))}
                </select>
                {chosen && <small>{chosen.summary}</small>}
              </label>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? 'Chystáme stůl…'
                : joining
                  ? 'Přisednout ke stolu'
                  : 'Založit nový stůl'}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="divider">nebo</div>
          <button
            className="text-button"
            onClick={() => {
              setJoining(!joining);
              setError('');
            }}
          >
            {joining
              ? 'Založit vlastní dobrodružství'
              : 'Už máš pozvánku? Připojit se'}
          </button>
          <RestoreForms busy={busy} onAction={act} />
          <small>
            Bez složitých pravidel. Hrajte po svém.
            <br />
            Hovor si pusťte ve své oblíbené aplikaci.
          </small>
        </section>
      </div>
      <footer>
        <Compass size={18} /> V jednoduchosti je síla. A někdy taky drak.
      </footer>
    </main>
  );
}
