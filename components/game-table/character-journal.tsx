'use client';
import { Check,Dices,Star,Swords } from 'lucide-react';
import { LifeBadge } from '../life-panel';
import ConditionBadges from '../condition-badges';
import CharacterSheetArtwork,{
ProfessionField,
} from '../character-sheet-artwork';
import SafeForm from '../safe-form';
import { Possessions } from '../loot-panel';
import { CombatFields,type RollSetup } from '../mechanics-panel';
import { ABILITIES,abilityValues } from '../../lib/character';
import type { MemberView } from '../../app/api/game/view';
type Props = {
  me: MemberView;
  pj: boolean;
  busy: boolean;
  openLife: () => void;
  openPowers: () => void;
  openRoll: (setup: RollSetup) => void;
  openEquipment: () => void;
  openLoot: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<boolean>;
};

export default function CharacterJournal({
  me,
  pj,
  busy,
  openLife,
  openPowers,
  openRoll,
  openEquipment,
  openLoot,
  onSave,
}: Props) {
  return (
    <CharacterSheetArtwork key={me.id} initialProfession={me.profession || ''}>
      {(updateProfession) => (
        <div className="character-sheet-fields">
          <span className="eyebrow">MŮJ DENÍK</span>
          <h2>Hrdina tvého příběhu</h2>
          <LifeBadge hp={me.hp} life={me.life} />
          {me.life?.note && <p className="life-notice">{me.life.note}</p>}
          {pj && (
            <button className="secondary" onClick={() => openLife()}>
              Vyřazení postav
            </button>
          )}
          <ConditionBadges items={me.conditions} />
          <div className="character-powers">
            <span>
              Magenergie:{' '}
              <strong>
                {me.mana?.current ?? 0} / {me.mana?.max ?? 0}
              </strong>
            </span>
            <button className="secondary" onClick={openPowers}>
              Kouzla a schopnosti
            </button>
          </div>
          <div className="experience-total">
            <span className="experience-star">
              <Star size={22} />
            </span>
            <div>
              <span>ZÍSKANÉ ZKUŠENOSTI</span>
              <strong>
                {(me.experience ?? 0).toLocaleString('cs-CZ')}{' '}
                <small>zk.</small>
              </strong>
            </div>
            <p>Zkušenosti přiděluje Pán jeskyně.</p>
          </div>
          <div className="sheet-rolls">
            <span>HOD Z ULOŽENÉHO DENÍKU</span>
            <div>
              {ABILITIES.map((a) => (
                <button
                  key={a.key}
                  disabled={busy}
                  onClick={() =>
                    openRoll({
                      actor: { type: 'member', id: me.id },
                      ability: a.key,
                      kind: 'ability',
                    })
                  }
                >
                  <Dices size={14} />
                  {a.short}
                </button>
              ))}
              <button
                onClick={() =>
                  openRoll({
                    actor: { type: 'member', id: me.id },
                    kind: 'attack',
                  })
                }
              >
                <Swords size={14} /> Útok / obrana
              </button>
            </div>
          </div>
          <p className="sheet-hint">
            Aktuální životy u stolu:{' '}
            <strong>
              {me.hp}/{me.maxHp}
            </strong>
            . Ukládají se jen pole, která upravíš.
          </p>
          <SafeForm busy={busy} onSave={onSave}>
            <label>
              Jméno
              <input
                name="name"
                required
                defaultValue={me.name}
                maxLength={30}
              />
            </label>
            <div className="identity-fields">
              <label>
                Rasa
                <input
                  name="race"
                  defaultValue={me.race || ''}
                  list="races"
                  maxLength={50}
                  placeholder="Vyber nebo napiš vlastní"
                />
                <datalist id="races">
                  {[
                    'Člověk',
                    'Elf',
                    'Trpaslík',
                    'Hobit',
                    'Kudůk',
                    'Barbar',
                    'Kroll',
                  ].map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </label>
              <ProfessionField
                initialValue={me.profession || ''}
                onValueChange={updateProfession}
              />
              <label>
                Úroveň
                <input
                  name="level"
                  type="number"
                  min="1"
                  max="36"
                  step="1"
                  required
                  defaultValue={me.level ?? 1}
                />
              </label>
            </div>
            <div className="sheet-section-title">
              <span>ZÁKLADNÍ VLASTNOSTI</span>
              <small>Stupeň 1–21</small>
            </div>
            <div className="ability-grid">
              {ABILITIES.map((a) => (
                <label key={a.key}>
                  <span className="ability-short">{a.short}</span>
                  <span>{a.label}</span>
                  <input
                    name={a.key}
                    aria-label={a.label}
                    type="number"
                    required
                    min="1"
                    max="21"
                    step="1"
                    defaultValue={abilityValues(me)[a.key]}
                  />
                </label>
              ))}
            </div>
            <p className="sheet-hint">
              Hodnoty zadej podle svého deníku. Rasa ani povolání je automaticky
              nemění.
            </p>
            <div className="sheet-section-title">
              <span>ŽIVOTY A SCHOPNOSTI</span>
            </div>
            <div className="form-row">
              <label>
                Životy
                <input
                  name="hp"
                  type="number"
                  min="0"
                  max="999"
                  defaultValue={me.hp}
                />
              </label>
              <label>
                Maximum životů
                <input
                  name="maxHp"
                  type="number"
                  min="1"
                  max="999"
                  defaultValue={me.maxHp}
                />
              </label>
            </div>
            <Possessions
              items={me.possessions}
              purse={me.purse}
              onManage={openEquipment}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => openLoot()}
            >
              Kořist družiny
            </button>
            <div className="sheet-section-title">
              <span>BOJOVÉ HODNOTY Z DENÍKU</span>
            </div>
            <CombatFields stats={me.combat} />
            <p className="sheet-hint">
              Zadej hotové ÚČ a OČ podle vybavení. Útočnost se přičítá až ke
              zranění. Automaticky se nemění s vlastnostmi.
            </p>
            <p className="sheet-hint">
              Schopnosti, výbavu a poznámky vidíš ty a PJ. Ostatním hráčům je
              server neposílá.
            </p>
            <label>
              Další schopnosti, kouzla a poznámky
              <textarea name="stats" defaultValue={me.stats} rows={3} />
            </label>
            <label>
              Výbava a poznámky
              <textarea name="inventory" defaultValue={me.inventory} rows={4} />
            </label>
            <button className="primary" disabled={busy}>
              Uložit deník <Check size={17} />
            </button>
          </SafeForm>
        </div>
      )}
    </CharacterSheetArtwork>
  );
}
