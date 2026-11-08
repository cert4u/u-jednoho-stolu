import type { Point } from '../../lib/dungeon';
import type { Tool } from './model';

export type MapSignals = {
  levelId?: string;
  generationPick: number;
  battleId?: string;
  monsterPick: number;
  selected: string;
  pj: boolean;
};
export type InteractionState = {
  signals: MapSignals;
  mode: 'prepare' | 'play';
  tool: Tool;
  preview: boolean;
  inspection: { point: Point; edge?: string } | null;
  resetStart: number;
  cancelStroke: number;
};

export function sameMapSignals(previous: MapSignals, next: MapSignals) {
  return (
    previous.levelId === next.levelId &&
    previous.generationPick === next.generationPick &&
    previous.battleId === next.battleId &&
    previous.monsterPick === next.monsterPick &&
    previous.selected === next.selected &&
    previous.pj === next.pj
  );
}

// Preserve the former effect ordering: generation, battle, monster, then hero selection.
export function transitionMap(
  state: InteractionState,
  next: MapSignals,
  mounting = false,
): InteractionState {
  const previous = state.signals;
  const result = { ...state, signals: next };
  if (mounting || previous.levelId !== next.levelId) {
    result.inspection = null;
    result.cancelStroke++;
    result.resetStart++;
  }
  if (
    (mounting || previous.generationPick !== next.generationPick) &&
    next.generationPick &&
    next.pj
  ) {
    result.mode = 'prepare';
    result.preview = false;
    result.tool = 'hand';
    result.resetStart++;
  }
  if ((mounting || previous.battleId !== next.battleId) && next.battleId) {
    result.tool = 'move';
    result.preview = false;
    result.resetStart++;
  }
  if (
    (mounting || previous.monsterPick !== next.monsterPick) &&
    next.monsterPick &&
    next.pj
  ) {
    result.tool = 'monster';
    result.preview = false;
    result.resetStart++;
  }
  if ((mounting || previous.selected !== next.selected) && next.selected) {
    result.tool = 'move';
    result.resetStart++;
  }
  return result;
}

export function initialInteraction(signals: MapSignals): InteractionState {
  return transitionMap(
    {
      signals,
      mode: 'prepare',
      tool: signals.pj ? 'wall' : 'move',
      preview: false,
      inspection: null,
      resetStart: 0,
      cancelStroke: 0,
    },
    signals,
    true,
  );
}
