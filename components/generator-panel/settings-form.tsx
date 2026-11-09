import type { Dispatch, SetStateAction } from 'react';
import type { dungeonPresets } from '../../lib/dungeon-presets';
import {
  generatorLimits,
  maxGeneratorRooms,
} from '../../lib/generator-options';
import type { GeneratorOptions } from '../../lib/generator-types';

const styleDescriptions = {
  castle: 'Pravidelné komnaty oddělené zdmi a dveřmi.',
  mine: 'Protáhlé pracovní prostory a větvené štoly.',
  cave: 'Nepravidelné síně a úzká přírodní propojení.',
} as const;

type Props = {
  options: GeneratorOptions;
  setOptions: Dispatch<SetStateAction<GeneratorOptions>>;
  presets: typeof dungeonPresets;
  available: number;
  loading: boolean;
  locked: boolean;
  dirty: boolean;
  onPreset: (id: string) => void;
  onPreview: () => void;
  onNewSeed: () => void;
};

export default function GeneratorSettingsForm({
  options,
  setOptions,
  presets,
  available,
  loading,
  locked,
  dirty,
  onPreset,
  onPreview,
  onNewSeed,
}: Props) {
  const update = <K extends keyof GeneratorOptions>(
    key: K,
    value: GeneratorOptions[K],
  ) => setOptions((previous) => ({ ...previous, [key]: value }));
  const complexity =
    options.corridors === 'direct' && options.connections === 0
      ? 'simple'
      : options.corridors === 'direct' && options.connections === 1
        ? 'balanced'
        : options.corridors === 'winding' && options.connections === 2
          ? 'complex'
          : 'custom';
  return (
    <form
      data-dirty={dirty}
      onSubmit={(e) => {
        e.preventDefault();
        onPreview();
      }}
    >
      <fieldset className="generator-settings" disabled={locked}>
        <label>
          Použít předlohu jeskyně
          <select
            value=""
            disabled={!available}
            onChange={(event) => onPreset(event.target.value)}
          >
            <option value="">Vyber předlohu pro vyplnění nastavení</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} · {preset.options.name}
                {preset.id.includes(':')
                  ? ' [' + preset.id.split(':')[0] + ']'
                  : ''}
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
              max={Math.max(1, available)}
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
                Velké prostory · max. {generatorLimits.maxLargeRooms} místností
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
                onChange={(e) => update('connections', Number(e.target.value))}
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
          <button className="secondary" disabled={locked || !available}>
            {loading ? 'Připravuji náhled…' : 'Vytvořit náhled'}
          </button>
          <button
            className="secondary"
            type="button"
            disabled={locked || !available}
            onClick={onNewSeed}
          >
            Nové semínko
          </button>
        </div>
      </fieldset>
    </form>
  );
}
