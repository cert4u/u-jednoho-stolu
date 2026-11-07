'use client';
import {useCatalog} from './catalog-provider';
import { useRef, useState } from 'react';
import GeneratorPreviewMap from './generator-preview-map';
import { useMapAppearance } from './dungeon-map/use-map-appearance';
import MapAppearanceControl from './dungeon-map/renderers/appearance-control';
import { generateDungeon } from '../lib/dungeon-generator';
import {
  defaultDungeonPreset,
} from '../lib/dungeon-presets';
import { generatorLimits, maxGeneratorRooms } from '../lib/generator-options';
import type {
  GeneratedDungeon,
  GeneratorOptions,
} from '../lib/generator-types';
import type { GenerationState } from '../lib/generation';
const styleLabels = {
  castle: 'Hradní podzemí',
  mine: 'Opuštěný důl',
  cave: 'Přírodní jeskyně',
} as const;
const styleDescriptions = {
  castle: 'Pravidelné komnaty oddělené zdmi a dveřmi.',
  mine: 'Protáhlé pracovní prostory a větvené štoly.',
  cave: 'Nepravidelné síně a úzká přírodní propojení.',
} as const;
export default function GeneratorPanel({
  state,
  busy,
  onApply,
}: {
  state: GenerationState;
  busy: boolean;
  onApply: (values: Record<string, unknown>) => Promise<unknown>;
}) {
  const {presets:dungeonPresets}=useCatalog();
  const findDungeonPreset=(id:string)=>dungeonPresets.find(p=>p.id===id);
  const [catalogPresetId,setCatalogPresetId]=useState('castle');
  const [appearance, setAppearance] = useMapAppearance();
  const [options, setOptions] = useState<GeneratorOptions>(() => ({
    ...defaultDungeonPreset.options,
    levels: Math.min(defaultDungeonPreset.options.levels, state.available || 1),
  }));
  const [initial] = useState(() => JSON.stringify(options)),
    [draft, setDraft] = useState<GeneratedDungeon | null>(null),
    [baseline, setBaseline] = useState(''),
    [level, setLevel] = useState(0),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const pending = useRef<{ signature: string; id: string } | null>(null),
    generating = useRef(false);
  const update = <K extends keyof GeneratorOptions>(
    key: K,
    value: GeneratorOptions[K],
  ) => setOptions((previous) => ({ ...previous, [key]: value }));
  async function preview(variant = options.variant, freshSeed = false) {
    if (generating.current || busy) return;
    generating.current = true;
    setLoading(true);
    setError('');
    const next = {
        ...options,
        variant: options.version === 'v1' ? 0 : variant,
        ...(freshSeed
          ? { seed: crypto.randomUUID().slice(0, 12), variant: 0 }
          : {}),
      },
      stamp = state.stamp;
    try {
      // Let the browser paint the preparation state before the bounded synchronous core runs.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (next.levels > state.available)
        throw new Error(`Zbývá místo pro ${state.available} pater.`);
      const generated = generateDungeon(next);
      setOptions(generated.options);
      setDraft(generated);
      setBaseline(stamp);
      setLevel(0);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Náhled se nepodařilo vytvořit.',
      );
    } finally {
      generating.current = false;
      setLoading(false);
    }
  }
  const changed =
      !!draft && JSON.stringify(options) !== JSON.stringify(draft.options),
    stale = !!draft && baseline !== state.stamp,
    locked = busy || loading;
  const complexity =
    options.corridors === 'direct' && options.connections === 0
      ? 'simple'
      : options.corridors === 'direct' && options.connections === 1
        ? 'balanced'
        : options.corridors === 'winding' && options.connections === 2
          ? 'complex'
          : 'custom';
  const metadata = draft?.floors[level].map.generation,
    deadEnds =
      metadata?.rooms.filter((room) => room.role === 'dead-end').length || 0;
  return (
    <>
      <span className="eyebrow">ČTVEREČKOVANÝ PAPÍR · PŘÍPRAVA PJ</span>
      <h2>Generátor jeskyně</h2>
      <p className="sheet-hint">
        Vyber podobu podzemí, prohlédni náhled a vlož jej do dobrodružství.
        Volná kapacita: {state.available} pater po 28 × 20 polích.
      </p>
      {state.available === 0 && (
        <p className="life-notice">
          Dobrodružství už dosáhlo limitu 8 pater. Pro další jeskyni založ nové
          dobrodružství.
        </p>
      )}
      <form
        data-dirty={!!draft || JSON.stringify(options) !== initial}
        onSubmit={(e) => {
          e.preventDefault();
          void preview();
        }}
      >
        <fieldset className="generator-settings" disabled={locked}>
          <label>
            Použít předlohu jeskyně
            <select
              value=""
              disabled={!state.available}
              onChange={(event) => {
                const preset = findDungeonPreset(event.target.value);
                if (preset) {
                  setCatalogPresetId(preset.id);
                  setOptions({
                    ...preset.options,
                    levels: Math.min(preset.options.levels, state.available),
                  });
                  setError('');
                }
              }}
            >
              <option value="">Vyber předlohu pro vyplnění nastavení</option>
              {dungeonPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label} · {preset.options.name}{preset.id.includes(':')?' ['+preset.id.split(':')[0]+']':''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Název jeskyně
            <input
              value={options.name}
              maxLength={generatorLimits.maxNameLength}
              required
              onChange={(e) => update('name', e.target.value)}
            />
          </label>
          <div className="generator-fields">
            <label>
              Styl podzemí
              <select
                value={options.style}
                disabled={options.version === 'v1'}
                onChange={(e) =>
                  update('style', e.target.value as GeneratorOptions['style'])
                }
              >
                <option value="castle">Hradní podzemí</option>
                <option value="mine">Opuštěný důl</option>
                <option value="cave">Přírodní jeskyně</option>
              </select>
            </label>
            <label>
              Složitost
              <select
                value={complexity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'custom') return;
                  setOptions((o) => ({
                    ...o,
                    corridors: value === 'complex' ? 'winding' : 'direct',
                    connections:
                      value === 'simple' ? 0 : value === 'balanced' ? 1 : 2,
                  }));
                }}
              >
                <option value="simple">Jednoduchá · přehledné odbočky</option>
                <option value="balanced">Vyvážená · možné alternativy</option>
                <option value="complex">Členitá · více propojení</option>
                {complexity === 'custom' && (
                  <option value="custom">Vlastní pokročilé nastavení</option>
                )}
              </select>
            </label>
            <label>
              Počet pater
              <input
                type="number"
                min={1}
                max={Math.max(1, state.available)}
                required
                value={options.levels}
                onChange={(e) => update('levels', Number(e.target.value))}
              />
            </label>
            <label>
              Místností na patro
              <input
                type="number"
                min={generatorLimits.minRooms}
                max={maxGeneratorRooms(options.size)}
                required
                value={options.rooms}
                onChange={(e) => update('rooms', Number(e.target.value))}
              />
            </label>
            <label>
              Velikost místností
              <select
                value={options.size}
                onChange={(e) => {
                  const size = e.target.value as GeneratorOptions['size'];
                  setOptions((o) => ({
                    ...o,
                    size,
                    rooms: Math.min(o.rooms, maxGeneratorRooms(size)),
                  }));
                }}
              >
                <option value="small">Malé prostory</option>
                <option value="medium">Střední prostory</option>
                <option value="large">
                  Velké prostory · max. {generatorLimits.maxLargeRooms}{' '}
                  místností
                </option>
              </select>
            </label>
          </div>
          <p className="sheet-hint">
            {options.version === 'v1'
              ? 'Původní V1 zachovává dřívější výstupy semínek a používá původní obdélníkové místnosti.'
              : styleDescriptions[options.style]}
          </p>
          <details className="generator-advanced">
            <summary>Pokročilé nastavení a semínko</summary>
            <div className="generator-fields">
              <label>
                Verze generátoru
                <select
                  value={options.version}
                  onChange={(e) =>
                    setOptions((o) => ({
                      ...o,
                      version: e.target.value as GeneratorOptions['version'],
                      ...(e.target.value === 'v1'
                        ? { style: 'castle', variant: 0 }
                        : {}),
                    }))
                  }
                >
                  <option value="v2">V2 · strukturované podzemí</option>
                  <option value="v1">V1 · původní seedy</option>
                </select>
              </label>
              <label>
                Semínko varianty
                <input
                  required
                  value={options.seed}
                  maxLength={generatorLimits.maxSeedLength}
                  onChange={(e) => update('seed', e.target.value)}
                />
              </label>
              <label>
                Chodby
                <select
                  value={options.corridors}
                  onChange={(e) =>
                    update(
                      'corridors',
                      e.target.value as GeneratorOptions['corridors'],
                    )
                  }
                >
                  <option value="direct">Jednoduché</option>
                  <option value="winding">Členitější</option>
                </select>
              </label>
              <label>
                Další propojení na patro (nejvýše)
                <input
                  type="number"
                  min={0}
                  max={generatorLimits.maxConnections}
                  required
                  value={options.connections}
                  onChange={(e) =>
                    update('connections', Number(e.target.value))
                  }
                />
              </label>
            </div>
            <label className="generator-exit">
              <input
                type="checkbox"
                checked={options.separateExit}
                onChange={(e) => update('separateExit', e.target.checked)}
              />{' '}
              Samostatný východ na přízemí
            </label>
            <p className="sheet-hint">
              Pro stejný výsledek zachovej verzi, semínko, číslo varianty i
              nastavení. Generátor funguje bez AI a připojení k internetu.
            </p>
          </details>
          <div className="generator-actions">
            <button className="secondary" disabled={locked || !state.available}>
              {loading ? 'Připravuji náhled…' : 'Vytvořit náhled'}
            </button>
            <button
              className="secondary"
              type="button"
              disabled={locked || !state.available}
              onClick={() => void preview(0, true)}
            >
              Nové semínko
            </button>
          </div>
        </fieldset>
      </form>
      {loading && (
        <p className="sheet-hint" role="status">
          Hledám a kontroluji vhodnou podobu podzemí…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {draft && (
        <section className="generator-preview">
          <div className="generator-preview-title">
            <h3>Náhled jeskyně</h3>
            <span>
              {draft.options.version.toUpperCase()}
              {draft.options.version === 'v2'
                ? ` · ${styleLabels[draft.options.style]} · varianta ${draft.options.variant + 1}`
                : ''}
            </span>
          </div>
          {options.version === 'v2' && (
            <div
              className="generator-variants"
              role="group"
              aria-label="Opakovatelné varianty jeskyně"
            >
              {[0, 1, 2].map((variant) => (
                <button
                  className="secondary"
                  type="button"
                  key={variant}
                  aria-pressed={!changed && draft.options.variant === variant}
                  disabled={locked || !state.available}
                  onClick={() => void preview(variant)}
                >
                  Varianta {variant + 1}
                </button>
              ))}
            </div>
          )}
          <div className="generator-preview-controls">
            <label>
              Prohlédnout patro
              <select
                value={level}
                disabled={locked}
                onChange={(e) => setLevel(Number(e.target.value))}
              >
                {draft.floors.map((floor, i) => (
                  <option value={i} key={i}>
                    {floor.name}
                  </option>
                ))}
              </select>
            </label>
            <MapAppearanceControl appearance={appearance} onChange={setAppearance} label="Vzhled náhledu" />
          </div>
          <GeneratorPreviewMap floor={draft.floors[level]} appearance={appearance} />
          {metadata && (
            <p className="generator-topology">
              Cílová místnost má výrazný okrový kroužek. Hlavní trasa:{' '}
              {metadata.metrics.mainPathLength} místností · slepé odbočky:{' '}
              {deadEnds} · alternativní propojení: {metadata.metrics.loops}.
              Zelená čísla označují hlavní trasu.
            </p>
          )}
          <p className="sheet-hint">
            Pater: {draft.floors.length} · místností na patro:{' '}
            {draft.options.rooms} · schodišť mezi patry: {draft.stairs.length}.
            Schody mají šipku směru, V označuje vchod a E samostatný východ.
            Obdélníkové značky v hranách jsou dveře. Čísla a trasa slouží jen přípravě PJ.
          </p>
          <p className="generator-placement">
            {state.reuseEmpty
              ? 'Náhled využije prázdné výchozí patro.'
              : 'Náhled se přidá jako nová patra k připravené mapě.'}{' '}
            Družinu pak přivedeš tlačítkem „Umístit družinu u vchodu“. Nová
            kresba je pro hráče skrytá.
          </p>
          {(changed || stale) && (
            <p className="life-notice">
              {stale
                ? 'Patra se mezitím změnila.'
                : 'Nastavení se liší od náhledu.'}{' '}
              Před vložením vytvoř nový náhled.
            </p>
          )}
          <button
            className="primary"
            disabled={
              locked ||
              changed ||
              stale ||
              draft.floors.length > state.available
            }
            onClick={() => {
              const values = {
                  options: draft.options,
                  expectedState: baseline,
                },
                signature = JSON.stringify(values);
              if (pending.current?.signature !== signature)
                pending.current = { signature, id: crypto.randomUUID() };
              void onApply({catalogPresetId, ...values, requestId: pending.current.id });
            }}
          >
            Vložit tato patra do dobrodružství
          </button>
        </section>
      )}
    </>
  );
}
