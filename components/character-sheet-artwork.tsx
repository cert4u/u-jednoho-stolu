'use client';
import Image from 'next/image';

import {useState, type ReactNode} from 'react';


import { illustratedProfessions, illustratedTitle, professionArtwork } from '../lib/character-artwork';

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
  const artwork = professionArtwork(profession);

  return (
    <div className={artwork ? 'character-sheet-illustrated' : undefined}>
      {children(setProfession)}
      {artwork && (
        <figure className="character-sheet-artwork">
          <Image unoptimized loading="eager" src={`/characters/${artwork.file}`} alt={`${artwork.title} ${artwork.description}`} width={720} height={1080}/>
        </figure>
      )}
    </div>
  );
}
