export const bestiaryEnvironments = {
  caves: 'Jeskyně a doly',
  castles: 'Hrady a ruiny',
  crypts: 'Hrobky a krypty',
  woods: 'Lesy a cesty',
  waters: 'Voda, bažiny a stoky',
  wilds: 'Skály a pustiny',
} as const;

export type BestiaryEnvironment = keyof typeof bestiaryEnvironments;
