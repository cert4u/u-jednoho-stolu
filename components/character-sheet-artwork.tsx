'use client';

import {useState, type ReactNode} from 'react';


const illustrations = new Map([
  ['Válečník', {file:'warrior-light.webp', description:'v kroužkové zbroji se štítem'}],
  ['Válečnice', {file:'warrior-woman-light.webp', description:'v kroužkové zbroji se štítem'}],
  ['Hraničář', {file:'ranger.webp', description:'v zeleném plášti s lukem'}],
  ['Hraničářka', {file:'ranger-woman.webp', description:'v zeleném plášti s lukem'}],
  ['Alchymista', {file:'alchemist.webp', description:'s brašnou a lahvičkami'}],
  ['Alchymistka', {file:'alchemist-woman.webp', description:'s brašnou a lahvičkami'}],
  ['Kouzelník', {file:'wizard.webp', description:'v dlouhé róbě s holí'}],
  ['Kouzelnice', {file:'wizard-woman.webp', description:'v dlouhé róbě s holí'}],
  ['Zloděj', {file:'thief.webp', description:'v tmavém plášti s dýkou'}],
  ['Zlodějka', {file:'thief-woman.webp', description:'v tmavém plášti s dýkou'}],
]);

const illustratedProfessions = [...illustrations.keys()];

function normalizeProfession(value: string) {
  return value.trim().toLocaleLowerCase('cs').normalize('NFC');
}

function illustratedTitle(value: string) {
  const key = normalizeProfession(value);
  return illustratedProfessions.find(name => normalizeProfession(name) === key);
}

const customProfession = '__custom';

export function ProfessionField({initialValue, onValueChange}: {
  initialValue: string;
  onValueChange: (value: string) => void;
}) {
  const initialTitle = illustratedTitle(initialValue);
  const [selection, setSelection] = useState(initialTitle ?? (initialValue ? customProfession : ''));
  const [value, setValue] = useState(initialValue);

  function updateValue(nextValue: string) {
    setValue(nextValue);
    onValueChange(nextValue);
  }

  return (
    <div className="profession-field">
      <label>
        Povolání
        <select value={selection} onChange={event => {
          const next = event.target.value;
          setSelection(next);
          updateValue(next === customProfession ? '' : next);
        }}>
          <option value="">Vyber povolání</option>
          {illustratedProfessions.map(name => <option key={name}>{name}</option>)}
          <option value={customProfession}>Vlastní povolání…</option>
        </select>
      </label>
      {selection === customProfession && (
        <input aria-label="Vlastní povolání" value={value} maxLength={50}
          placeholder="Napiš název povolání" onChange={event => updateValue(event.target.value)}/>
      )}
      <input type="hidden" name="profession" value={value}/>
    </div>
  );
}

export default function CharacterSheetArtwork({initialProfession, children}: {
  initialProfession: string;
  children: (updateProfession: (value: string) => void) => ReactNode;
}) {
  const [profession, setProfession] = useState(initialProfession);
  const title = illustratedTitle(profession);
  const artwork = title ? illustrations.get(title) : undefined;

  return (
    <div className={artwork ? 'character-sheet-illustrated' : undefined}>
      {children(setProfession)}
      {artwork && (
        <figure className="character-sheet-artwork">
          <img src={`/characters/${artwork.file}`} alt={`${title} ${artwork.description}`} width={720} height={1080}/>
        </figure>
      )}
    </div>
  );
}
