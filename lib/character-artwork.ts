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

export const illustratedProfessions = [...illustrations.keys()];

function normalizeProfession(value: string) {
  return value.trim().toLocaleLowerCase('cs').normalize('NFC');
}

export function illustratedTitle(value: string) {
  const key = normalizeProfession(value);
  return illustratedProfessions.find(name => normalizeProfession(name) === key);
}


export function professionArtwork(profession: string) {
  const title = illustratedTitle(profession);
  const artwork = title ? illustrations.get(title) : undefined;
  return artwork && title ? { ...artwork, title } : undefined;
}
