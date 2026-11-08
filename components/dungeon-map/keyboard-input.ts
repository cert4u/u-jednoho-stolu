import type {
  KeyboardEvent as ReactKeyboardEvent,
  Dispatch,
  SetStateAction,
  RefObject,
} from 'react';
import { cellKey, type Point } from '../../lib/dungeon';
import { W, H } from './model';
import type { MapInput } from './input-types';
import type { createMapCommands } from './input-commands';
type MapKeyboardContext = Pick<
  MapInput,
  | 'onCancelScenery'
  | 'effectiveTool'
  | 'busy'
  | 'preview'
  | 'pj'
  | 'surfaceBrush'
  | 'onScenery'
  | 'map'
  | 'setInspection'
  | 'exploration'
  | 'onOpenNote'
  | 'selectedCreature'
  | 'onAction'
  | 'onInspectMonster'
  | 'selected'
  | 'me'
  | 'canLead'
> &
  Pick<
    ReturnType<typeof createMapCommands>,
    'sendMap' | 'sendExplore' | 'moveBattle'
  > & {
    cancel: () => void;
    setKeyboard: Dispatch<SetStateAction<Point>>;
    keyboard: Point;
    keyboardStart: Point | null;
    setKeyboardStart: Dispatch<SetStateAction<Point | null>>;
    lock: RefObject<boolean>;
    retry: Record<string, unknown> | null;
  };
export function handleMapKey(
  e: ReactKeyboardEvent<SVGSVGElement>,
  {
    onCancelScenery,
    cancel,
    setKeyboard,
    effectiveTool,
    busy,
    preview,
    lock,
    retry,
    pj,
    surfaceBrush,
    sendMap,
    onScenery,
    map,
    setInspection,
    keyboard,
    exploration,
    onOpenNote,
    selectedCreature,
    onAction,
    onInspectMonster,
    sendExplore,
    moveBattle,
    selected,
    me,
    canLead,
    keyboardStart,
    setKeyboardStart,
  }: MapKeyboardContext,
) {
  if (e.key === 'Escape') {
    onCancelScenery();
    cancel();
    return;
  }
  const delta: Record<string, Point> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (delta[e.key]) {
    e.preventDefault();
    setKeyboard(([x, y]) => [
      Math.max(0, Math.min(W - 1, x + delta[e.key][0])),
      Math.max(0, Math.min(H - 1, y + delta[e.key][1])),
    ]);
    return;
  }
  if (effectiveTool === 'hand') return;
  if (e.key !== 'Enter' || busy || preview || lock.current || retry) return;
  e.preventDefault();
  if (effectiveTool === 'scenery' && pj) {
    if (surfaceBrush) {
      void sendMap({ tool: 'surface', ...surfaceBrush, points: [keyboard] });
      return;
    }
    onScenery(
      keyboard,
      map.scenery?.find(
        (item) => item.x === keyboard[0] && item.y === keyboard[1],
      )?.id,
    );
  } else if (effectiveTool === 'inspect' && pj) {
    setInspection({ point: keyboard });
  } else if (effectiveTool === 'note') {
    if (map.floors.includes(cellKey(...keyboard)))
      onOpenNote(
        {
          levelId: exploration?.levelId || 'ground',
          x: keyboard[0],
          y: keyboard[1],
        },
        false,
      );
  } else if (effectiveTool === 'monster') {
    if (selectedCreature)
      void onAction('monster', {
        op: 'move',
        monsterId: selectedCreature.id,
        x: keyboard[0],
        y: keyboard[1],
        requestId: crypto.randomUUID(),
      });
    else onInspectMonster();
  } else if (effectiveTool === 'place') {
    void sendExplore('place', { x: keyboard[0], y: keyboard[1] });
  } else if (effectiveTool === 'openDoor') {
    void sendExplore('door', { edge: `h:${keyboard[0]}:${keyboard[1]}` });
  } else if (exploration?.enabled && effectiveTool === 'move') {
    if (exploration.battle)
      void moveBattle(selected || (!pj ? me : ''), keyboard);
    else if (canLead)
      void sendExplore('move', { x: keyboard[0], y: keyboard[1] });
  } else if (effectiveTool === 'move') {
    const id = selected || (!pj ? me : '');
    if (id) void onAction('move', { id, x: keyboard[0], y: keyboard[1] });
  } else if (['room', 'reveal', 'hide', 'wall'].includes(effectiveTool)) {
    if (!keyboardStart) setKeyboardStart(keyboard);
    else {
      void sendMap({
        tool: effectiveTool,
        ...(effectiveTool === 'wall'
          ? { points: [keyboardStart, keyboard] }
          : { from: keyboardStart, to: keyboard }),
      });
      setKeyboardStart(null);
    }
  } else if (
    [
      'entrance',
      'exit',
      'stairsUp',
      'stairsDown',
      'stairsBoth',
      'floor',
      'subtract',
    ].includes(effectiveTool)
  )
    void sendMap({ tool: effectiveTool, points: [keyboard] });
  else if (effectiveTool === 'door')
    void sendMap({
      tool: 'door',
      edges: [`h:${keyboard[0]}:${keyboard[1]}`],
    });
  else
    void sendMap({
      tool: 'erase',
      cells: [keyboard],
      edges: [`h:${keyboard[0]}:${keyboard[1]}`],
    });
}
