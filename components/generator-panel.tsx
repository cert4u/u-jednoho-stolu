'use client';
import { useCatalog } from './catalog-provider';
import { useRef, useState } from 'react';
import GeneratorSettingsForm from './generator-panel/settings-form';
import GeneratorPreview from './generator-panel/preview';
import { generateDungeon } from '../lib/dungeon-generator';
import { defaultDungeonPreset } from '../lib/dungeon-presets';
import type {
  GeneratedDungeon,
  GeneratorOptions,
} from '../lib/generator-types';
import type { GenerationState } from '../lib/generation';
export default function GeneratorPanel({
  state,
  busy,
  onApply,
}: {
  state: GenerationState;
  busy: boolean;
  onApply: (values: Record<string, unknown>) => Promise<unknown>;
}) {
  const { presets: dungeonPresets } = useCatalog();
  const [catalogPresetId, setCatalogPresetId] = useState('castle');
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
  function selectPreset(id: string) {
    const preset = dungeonPresets.find((item) => item.id === id);
    if (!preset) return;
    setCatalogPresetId(preset.id);
    setOptions({
      ...preset.options,
      levels: Math.min(preset.options.levels, state.available),
    });
    setError('');
  }

  function applyDraft(draft: GeneratedDungeon) {
    const values = {
        options: draft.options,
        expectedState: baseline,
      },
      signature = JSON.stringify(values);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    void onApply({ catalogPresetId, ...values, requestId: pending.current.id });
  }
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
      <GeneratorSettingsForm
        options={options}
        setOptions={setOptions}
        presets={dungeonPresets}
        available={state.available}
        loading={loading}
        locked={locked}
        dirty={!!draft || JSON.stringify(options) !== initial}
        onPreset={selectPreset}
        onPreview={() => void preview()}
        onNewSeed={() => void preview(0, true)}
      />
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
        <GeneratorPreview
          draft={draft}
          state={state}
          level={level}
          setLevel={setLevel}
          locked={locked}
          changed={changed}
          stale={stale}
          showVariants={options.version === 'v2'}
          onVariant={(variant) => void preview(variant)}
          onApply={() => applyDraft(draft)}
        />
      )}
    </>
  );
}
