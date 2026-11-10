import type { GameView } from '../app/api/game/view';

export const sharedPortraitHeader = 'X-Stul-Portraits';
export const sharedPortraitFormat = 'shared';

type WireMonster = Omit<GameView['monsters'][number], 'portrait'> & {
  portrait?: string | number;
};

export type WireGameView = Omit<GameView, 'monsters'> & {
  monsters: WireMonster[];
  sharedPortraits?: string[];
};

export function packGameView(view: GameView, shared: boolean): WireGameView {
  if (!shared) return view;
  const sharedPortraits: string[] = [];
  const indices = new Map<string, number>();
  const monsters = view.monsters.map((monster) => {
    const { portrait } = monster;
    if (!portrait?.startsWith('data:image/webp;base64,')) return monster;
    let index = indices.get(portrait);
    if (index === undefined) {
      index = sharedPortraits.length;
      sharedPortraits.push(portrait);
      indices.set(portrait, index);
    }
    return { ...monster, portrait: index };
  });
  return sharedPortraits.length ? { ...view, monsters, sharedPortraits } : view;
}

export function expandGamePortraits(view: WireGameView | GameView): GameView {
  if (!('sharedPortraits' in view) || !view.sharedPortraits)
    return view as GameView;
  const { sharedPortraits, monsters, ...rest } = view;
  return {
    ...rest,
    monsters: monsters.map(({ portrait, ...monster }) => ({
      ...monster,
      ...(portrait === undefined
        ? {}
        : {
            portrait:
              typeof portrait === 'number'
                ? sharedPortraits[portrait]
                : portrait,
          }),
    })),
  };
}
