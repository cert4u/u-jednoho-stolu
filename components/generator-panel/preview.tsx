import GeneratorPreviewMap from '../generator-preview-map';
import { useMapAppearance } from '../dungeon-map/use-map-appearance';
import MapAppearanceControl from '../dungeon-map/renderers/appearance-control';
import type { GeneratedDungeon } from '../../lib/generator-types';
import type { GenerationState } from '../../lib/generation';

const styleLabels = {
  castle: 'Hradní podzemí',
  mine: 'Opuštěný důl',
  cave: 'Přírodní jeskyně',
} as const;

type Props = {
  draft: GeneratedDungeon;
  state: GenerationState;
  level: number;
  setLevel: (level: number) => void;
  locked: boolean;
  changed: boolean;
  stale: boolean;
  showVariants: boolean;
  onVariant: (variant: number) => void;
  onApply: () => void;
};

export default function GeneratorPreview({
  draft,
  state,
  level,
  setLevel,
  locked,
  changed,
  stale,
  showVariants,
  onVariant,
  onApply,
}: Props) {
  const [appearance, setAppearance] = useMapAppearance();
  const metadata = draft.floors[level].map.generation,
    deadEnds =
      metadata?.rooms.filter((room) => room.role === 'dead-end').length || 0;
  return (
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
      {showVariants && (
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
              onClick={() => onVariant(variant)}
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
        <MapAppearanceControl
          appearance={appearance}
          onChange={setAppearance}
          label="Vzhled náhledu"
        />
      </div>
      <GeneratorPreviewMap
        floor={draft.floors[level]}
        appearance={appearance}
      />
      {metadata && (
        <p className="generator-topology">
          Cílová místnost má výrazný okrový kroužek. Hlavní trasa:{' '}
          {metadata.metrics.mainPathLength} místností · slepé odbočky:{' '}
          {deadEnds} · alternativní propojení: {metadata.metrics.loops}. Zelená
          čísla označují hlavní trasu.
        </p>
      )}
      <p className="sheet-hint">
        Pater: {draft.floors.length} · místností na patro: {draft.options.rooms}{' '}
        · schodišť mezi patry: {draft.stairs.length}. Schody mají šipku směru, V
        označuje vchod a E samostatný východ. Obdélníkové značky v hranách jsou
        dveře. Čísla a trasa slouží jen přípravě PJ.
      </p>
      <p className="generator-placement">
        {state.reuseEmpty
          ? 'Náhled využije prázdné výchozí patro.'
          : 'Náhled se přidá jako nová patra k připravené mapě.'}{' '}
        Družinu pak přivedeš tlačítkem „Umístit družinu u vchodu“. Nová kresba
        je pro hráče skrytá.
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
          locked || changed || stale || draft.floors.length > state.available
        }
        onClick={onApply}
      >
        Vložit tato patra do dobrodružství
      </button>
    </section>
  );
}
