import {
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  cellKey,
  type Dungeon,
  type Point,
  type MapCommand,
} from '../../lib/dungeon';
import type { ExplorationView } from '../../lib/exploration';
import type { MapNoteView, NoteAnchor } from '../../lib/map-notes';
import type { MonsterView } from '../../lib/monsters';
import {
  W,
  H,
  WIDTH,
  HEIGHT,
  SIZE,
  PAD,
  edgeVertices,
  type Tool,
  type Stroke,
  type Marker,
} from './model';

type MapInput = {
  map: Dungeon;
  members: Marker[];
  me: string;
  pj: boolean;
  busy: boolean;
  selected: string;
  exploration?: ExplorationView;
  notes: MapNoteView[];
  onSelect: (id: string) => void;
  onAction: (
    action: string,
    values: Record<string, unknown>,
  ) => Promise<boolean | undefined>;
  onOpenNote: (anchor: NoteAnchor, publicView: boolean) => void;
  onInspectMonster: (id?: string) => void;
  effectiveTool: Tool;
  canDraw: boolean;
  canLead: boolean;
  selectedCreature?: MonsterView;
  preview: boolean;
  visible: boolean;
  space: boolean;
  viewport: RefObject<HTMLDivElement | null>;
  setTool: Dispatch<SetStateAction<Tool>>;
  setInspection: Dispatch<
    SetStateAction<{ point: Point; edge?: string } | null>
  >;
};

function geometry(e: ReactPointerEvent<SVGSVGElement>) {
  const box = e.currentTarget.getBoundingClientRect();
  const x = Math.max(
      0,
      Math.min(
        W,
        ((e.clientX - box.left) * WIDTH) / box.width / SIZE - PAD / SIZE,
      ),
    ),
    y = Math.max(
      0,
      Math.min(
        H,
        ((e.clientY - box.top) * HEIGHT) / box.height / SIZE - PAD / SIZE,
      ),
    );
  const cell: Point = [
      Math.min(W - 1, Math.floor(x)),
      Math.min(H - 1, Math.floor(y)),
    ],
    vertex: Point = [Math.round(x), Math.round(y)];
  const horizontal = Math.abs(y - Math.round(y)) <= Math.abs(x - Math.round(x));
  const edge = horizontal
    ? `h:${Math.min(W - 1, Math.floor(x))}:${Math.round(y)}`
    : `v:${Math.round(x)}:${Math.min(H - 1, Math.floor(y))}`;
  return {
    cell,
    vertex,
    edge,
    nearEdge:
      Math.min(Math.abs(y - Math.round(y)), Math.abs(x - Math.round(x))) < 0.24,
  };
}

export function useMapInput({
  map,
  members,
  me,
  pj,
  busy,
  selected,
  exploration,
  notes,
  onSelect,
  onAction,
  onOpenNote,
  onInspectMonster,
  effectiveTool,
  canDraw,
  canLead,
  selectedCreature,
  preview,
  visible,
  space,
  viewport,
  setTool,
  setInspection,
}: MapInput) {
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const [keyboard, setKeyboard] = useState<Point>([0, 0]);
  const [keyboardStart, setKeyboardStart] = useState<Point | null>(null);
  const [retry, setRetry] = useState<Record<string, unknown> | null>(null);
  const active = useRef<Stroke | null>(null);
  const lock = useRef(false);
  function beginPaper(e: ReactPointerEvent<HTMLDivElement>) {
    if (
      e.target !== e.currentTarget ||
      e.button !== 0 ||
      active.current ||
      !(e.ctrlKey || space || effectiveTool === 'hand')
    )
      return;
    const box = viewport.current!;
    const s: Stroke = {
      pointer: e.pointerId,
      start: [0, 0],
      end: [0, 0],
      points: [],
      edges: [],
      cells: [],
      edge: '',
      pan: {
        x: e.clientX,
        y: e.clientY,
        left: box.scrollLeft,
        top: box.scrollTop,
      },
    };
    active.current = s;
    setStroke(s);
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function switchTool(next: Tool) {
    if (active.current) return;
    setTool(next);
    setKeyboardStart(null);
  }
  async function sendMap(command: MapCommand | Record<string, unknown>) {
    const payload = {
      levelId: exploration?.levelId,
      ...command,
      requestId: crypto.randomUUID(),
    };
    lock.current = true;
    setRetry(null);
    try {
      if (!(await onAction('map', payload))) setRetry(payload);
    } finally {
      lock.current = false;
    }
  }
  function begin(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0 || active.current) return;
    const p = geometry(e);
    setKeyboard(p.cell);
    e.currentTarget.focus({ preventScroll: true });
    if (e.ctrlKey || space || effectiveTool === 'hand') {
      const box = viewport.current!;
      const s: Stroke = {
        pointer: e.pointerId,
        start: p.cell,
        end: p.cell,
        points: [],
        edges: [],
        cells: [],
        edge: p.edge,
        pan: {
          x: e.clientX,
          y: e.clientY,
          left: box.scrollLeft,
          top: box.scrollTop,
        },
      };
      active.current = s;
      setStroke(s);
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (busy || lock.current || retry || preview) return;
    if (effectiveTool === 'inspect' && pj) {
      e.preventDefault();
      const target = e.target as Element,
        monster = target
          .closest('[data-monster]')
          ?.getAttribute('data-monster'),
        note = target.closest('[data-map-note]')?.getAttribute('data-map-note');
      if (monster) onInspectMonster(monster);
      else if (note) {
        const n = notes.find((n) => n.id === note);
        if (n) onOpenNote({ levelId: n.levelId, x: n.x, y: n.y }, false);
      } else
        setInspection({
          point: p.cell,
          ...(p.nearEdge && map.edges[p.edge] ? { edge: p.edge } : {}),
        });
      return;
    }
    const note =
      (e.target as Element)
        .closest('[data-map-note]')
        ?.getAttribute('data-map-note') || undefined;
    if (note && pj && !visible && ['note', 'move'].includes(effectiveTool)) {
      const item = notes.find((n) => n.id === note);
      if (!item) return;
      const start: Point = [item.x, item.y];
      const s: Stroke = {
        pointer: e.pointerId,
        start,
        end: start,
        points: [],
        edges: [],
        cells: [],
        edge: p.edge,
        note,
      };
      active.current = s;
      setStroke(s);
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (effectiveTool === 'note') {
      if (map.floors.includes(cellKey(...p.cell)))
        onOpenNote(
          {
            levelId: exploration?.levelId || 'ground',
            x: p.cell[0],
            y: p.cell[1],
          },
          false,
        );
      return;
    }
    const monster =
      (e.target as Element)
        .closest('[data-monster]')
        ?.getAttribute('data-monster') || undefined;
    if (monster && !pj) return;
    const token =
      (e.target as Element)
        .closest('[data-token]')
        ?.getAttribute('data-token') || undefined;
    if (token) {
      const m = members.find((m) => m.id === token);
      if (!m || (!pj && token !== me)) return;
      onSelect(token);
      if (effectiveTool !== 'move') return;
    } else if (!canDraw && effectiveTool !== 'move') return;
    const point = effectiveTool === 'wall' ? p.vertex : p.cell;
    const s: Stroke = {
      pointer: e.pointerId,
      start: point,
      end: point,
      points: [point],
      edges: effectiveTool === 'erase' && p.nearEdge ? [p.edge] : [],
      cells: effectiveTool === 'erase' && !p.nearEdge ? [p.cell] : [],
      edge: p.edge,
      token,
      monster,
    };
    active.current = s;
    setStroke(s);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function drag(e: ReactPointerEvent<SVGSVGElement | HTMLDivElement>) {
    const s = active.current;
    if (!s || s.pointer !== e.pointerId) return;
    if (s.pan) {
      viewport.current!.scrollLeft = s.pan.left - (e.clientX - s.pan.x);
      viewport.current!.scrollTop = s.pan.top - (e.clientY - s.pan.y);
      return;
    }
    const p = geometry(e as ReactPointerEvent<SVGSVGElement>);
    const point = effectiveTool === 'wall' ? p.vertex : p.cell;
    const next = {
      ...s,
      end: point,
      points:
        s.points.at(-1)?.join() === point.join()
          ? s.points
          : [...s.points, point],
    };
    if (effectiveTool === 'erase') {
      if (p.nearEdge) {
        if (!next.edges.includes(p.edge)) next.edges = [...next.edges, p.edge];
      } else if (!next.cells.some((c) => c.join() === p.cell.join()))
        next.cells = [...next.cells, p.cell];
    }
    active.current = next;
    setStroke(next);
  }
  function finish(e: ReactPointerEvent<SVGSVGElement | HTMLDivElement>) {
    const s = active.current;
    if (!s || s.pointer !== e.pointerId) return;
    active.current = null;
    setStroke(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (s.pan) return;
    if (s.note) {
      const note = notes.find((n) => n.id === s.note);
      if (note) {
        if (s.start.join() === s.end.join())
          onOpenNote({ levelId: note.levelId, x: note.x, y: note.y }, false);
        else
          void onAction('map-note', {
            op: 'move',
            levelId: note.levelId,
            x: note.x,
            y: note.y,
            toX: s.end[0],
            toY: s.end[1],
            noteId: note.id,
            expectedRevision: note.revision,
            requestId: crypto.randomUUID(),
          });
      }
      return;
    }
    if (s.monster) {
      if (s.start.join() === s.end.join()) onInspectMonster(s.monster);
      else
        void onAction('monster', {
          op: 'move',
          monsterId: s.monster,
          x: s.end[0],
          y: s.end[1],
          requestId: crypto.randomUUID(),
        });
      return;
    }
    if (effectiveTool === 'monster') {
      if (selectedCreature)
        void onAction('monster', {
          op: 'move',
          monsterId: selectedCreature.id,
          x: s.end[0],
          y: s.end[1],
          requestId: crypto.randomUUID(),
        });
      else onInspectMonster();
      return;
    }
    if (effectiveTool === 'place') {
      void sendExplore('place', { x: s.end[0], y: s.end[1] });
      return;
    }
    if (effectiveTool === 'openDoor') {
      void sendExplore('door', { edge: s.edge });
      return;
    }
    if (exploration?.enabled && effectiveTool === 'move') {
      if (exploration.battle)
        void moveBattle(s.token || selected || (!pj ? me : ''), s.end);
      else if (canLead) void sendExplore('move', { x: s.end[0], y: s.end[1] });
      return;
    }
    if (s.token || effectiveTool === 'move') {
      const id = s.token || selected || (!pj ? me : '');
      if (id && !preview)
        void onAction('move', { id, x: s.end[0], y: s.end[1] });
      return;
    }
    if (!canDraw) return;
    let command: MapCommand = { tool: effectiveTool };
    if (['room', 'reveal', 'hide'].includes(effectiveTool))
      command = { ...command, from: s.start, to: s.end };
    else if (effectiveTool === 'door') command.edges = [s.edge];
    else if (effectiveTool === 'erase') {
      if (s.edges.length) command.edges = s.edges;
      if (s.cells.length) command.cells = s.cells;
    } else
      command.points =
        effectiveTool === 'wall' && s.points.length === 1
          ? edgeVertices(s.edge)
          : s.points;
    void sendMap(command);
  }
  async function moveBattle(id: string, to: Point) {
    const who = members.find((m) => m.id === id);
    if (!who || (!pj && id !== me)) return;
    return sendExplore('battle-move', {
      battleId: exploration?.battle?.id,
      memberId: id,
      x: to[0],
      y: to[1],
      expected: { x: who.x, y: who.y },
    });
  }
  async function sendExplore(op: string, values: Record<string, unknown> = {}) {
    if (lock.current) return false;
    lock.current = true;
    try {
      return await onAction('explore', {
        op,
        ...values,
        requestId: crypto.randomUUID(),
      });
    } finally {
      lock.current = false;
    }
  }
  function cancel() {
    active.current = null;
    setStroke(null);
    setKeyboardStart(null);
  }
  function keyAction(e: ReactKeyboardEvent<SVGSVGElement>) {
    if (e.key === 'Escape') {
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
    if (effectiveTool === 'inspect' && pj) {
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

  function lostCapture() {
    if (active.current) cancel();
  }

  async function retryMap() {
    if (!retry) return;
    lock.current = true;
    try {
      if (await onAction('map', retry)) setRetry(null);
    } finally {
      lock.current = false;
    }
  }

  return {
    stroke,
    keyboard,
    setKeyboard,
    keyboardStart,
    setKeyboardStart,
    retry,
    clearRetry: () => setRetry(null),
    retryMap,
    switchTool,
    sendMap,
    sendExplore,
    beginPaper,
    begin,
    drag,
    finish,
    cancel,
    lostCapture,
    keyAction,
  };
}
