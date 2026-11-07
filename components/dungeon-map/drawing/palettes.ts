export type InkTheme = 'universal' | 'castle' | 'mine' | 'cave';

export const inkPalettes = {
  universal: { ink: '#493e2e', floor: '#fff9ea', shade: '#726046', wobble: 0.85, hatch: 8, spacing: 6 },
  castle: { ink: '#423b31', floor: '#fffaee', shade: '#786951', wobble: 0.42, hatch: 9, spacing: 5.5 },
  mine: { ink: '#493b2a', floor: '#fff7e6', shade: '#806a4c', wobble: 1, hatch: 11, spacing: 6 },
  cave: { ink: '#493f31', floor: '#fff8e9', shade: '#79684d', wobble: 1.45, hatch: 10, spacing: 6.5 },
} as const;
