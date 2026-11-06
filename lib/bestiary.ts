import type {CombatStats} from './mechanics';

type BestiaryEntry = {
  name: string;
  description: string;
  portrait?: string;
  maxHp: number;
  combat: CombatStats;
};

const bestiary = {
  orc: {
    name: 'Skřet',
    description: 'Ozbrojený hlídač, který raději zaútočí ze zálohy.',
    maxHp: 9,
    combat: {attack: 4, defense: 3, damage: 1},
  },
  goblin: {
    name: 'Goblin',
    description: 'Drobný protivník s prakem, který se rychle ztratí v úzkých chodbách.',
    maxHp: 5,
    combat: {attack: 3, defense: 2, damage: 0},
  },
  troll: {
    name: 'Jeskynní troll',
    description: 'Těžkopádný obr s kyjem. Hodí se jako strážce průchodu.',
    maxHp: 24,
    combat: {attack: 7, defense: 4, damage: 3},
  },
  wolf: {
    name: 'Vlk',
    description: 'Ostražitý lovec, který zkouší oddělit nejslabšího člena družiny.',
    maxHp: 8,
    combat: {attack: 4, defense: 3, damage: 0},
  },
  spider: {
    name: 'Obří pavouk',
    description: 'Číhá nad cestou a spouští se na kořist z pavučiny.',
    maxHp: 11,
    combat: {attack: 5, defense: 3, damage: 1},
  },
  skeleton: {
    name: 'Kostlivec',
    description: 'Nemrtvý strážce s kopím a otlučeným štítem.',
    maxHp: 8,
    combat: {attack: 4, defense: 4, damage: 0},
  },
  bandit: {
    portrait: 'bandit-neutral',
    name: 'Lupič',
    description: 'Vybírá mýtné zpoza padlého stromu. Když mu družina vezme výhodu, radši smlouvá.',
    maxHp: 10,
    combat: {attack: 5, defense: 3, damage: 1},
  },
  ghost: {
    portrait: 'ghost-neutral',
    name: 'Duch',
    description: 'V potrhaném rubáši bloudí kolem místa své smrti. Vyslov jeho jméno a na okamžik ztichne.',
    maxHp: 12,
    combat: {attack: 4, defense: 5, damage: 1},
  },
  ghoul: {
    portrait: 'ghoul-neutral',
    name: 'Ghůl',
    description: 'Číhá mezi hroby. Jakmile ucítí zraněnou postavu, vyrazí po ní po čtyřech.',
    maxHp: 15,
    combat: {attack: 6, defense: 3, damage: 2},
  },
  slime: {
    name: 'Sliz',
    description: 'Vypadá jako mokrá skvrna na podlaze. Uvnitř se leskne klíč, který by šel vytáhnout háčkem.',
    maxHp: 8,
    combat: {attack: 3, defense: 1, damage: 1},
  },
  gargoyle: {
    name: 'Chrlič',
    description: 'Kamenná socha nad vchodem mění polohu, když se nikdo nedívá. V prachu po ní zůstávají otisky.',
    maxHp: 16,
    combat: {attack: 5, defense: 6, damage: 1},
  },
  vodnik: {
    name: 'Vodník',
    description: 'Zná zatopenou cestu do dalšího patra. Za převoz chce laskavost, třeba vrátit zvonek ukradený z jeho tůně.',
    maxHp: 12,
    combat: {attack: 4, defense: 4, damage: 0},
  },
} satisfies Record<string, BestiaryEntry>;

export type BestiaryId = keyof typeof bestiary;

export function findBestiaryEntry(id: unknown): (BestiaryEntry & {id: BestiaryId}) | undefined {
  if (typeof id !== 'string' || !Object.hasOwn(bestiary, id)) return undefined;
  const key = id as BestiaryId;
  return {id: key, ...bestiary[key]};
}

export const bestiaryEntries = Object.entries(bestiary).map(([id, entry]) => ({id, ...entry}));
