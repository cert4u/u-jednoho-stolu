import {
  useRef,
  useLayoutEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { cellKey, type Point, type MapCommand } from '../../lib/dungeon';
import { edgeVertices, type Tool, type Stroke } from './model';
import type { MapInput } from './input-types';
import { mapPointerGeometry } from './pointer-geometry';
import { createMapCommands } from './input-commands';
import { handleMapKey } from './keyboard-input';
function geometry(e: ReactPointerEvent<SVGSVGElement>) {
  return mapPointerGeometry(e, e.currentTarget.getBoundingClientRect());
}
export function useMapInput({
  surfaceBrush,
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
  onScenery,
  onCancelScenery,
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
  resetStart,
  cancelStroke,
}: MapInput) {
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const [keyboard, setKeyboard] = useState<Point>([0, 0]);
  const [keyboardStart, setKeyboardStart] = useState<Point | null>(null);
  const [retry, setRetry] = useState<Record<string, unknown> | null>(null);
  const active = useRef<Stroke | null>(null);
  const lock = useRef(false);
  // Build command closures only from event handlers, never inspect refs in render.
  function commands() {
    return createMapCommands({
      onAction,
      exploration,
      members,
      pj,
      me,
      selected,
      canLead,
      busy,
      lock,
      retry,
      setRetry,
    });
  }
  function sendMap(command: MapCommand | Record<string, unknown>) {
    return commands().sendMap(command);
  }
  function sendExplore(op: string, values: Record<string, unknown> = {}) {
    return commands().sendExplore(op, values);
  }
  function retryMap() {
    return commands().retryMap();
  }
  const [observed, setObserved] = useState({ resetStart, cancelStroke });
  if (
    observed.resetStart !== resetStart ||
    observed.cancelStroke !== cancelStroke
  ) {
    setObserved({ resetStart, cancelStroke });
    setKeyboardStart(null);
    if (observed.cancelStroke !== cancelStroke) setStroke(null);
  }
  useLayoutEffect(() => {
    active.current = null;
  }, [cancelStroke]);
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
    if (effectiveTool === 'scenery' && pj) {
      e.preventDefault();
      if (surfaceBrush) {
        const s: Stroke = {
          surface: { ...surfaceBrush },
          pointer: e.pointerId,
          start: p.cell,
          end: p.cell,
          points: [p.cell],
          edges: [],
          cells: [],
          edge: p.edge,
        };
        active.current = s;
        setStroke(s);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      onScenery(
        p.cell,
        (e.target as Element)
          .closest('[data-scenery]')
          ?.getAttribute('data-scenery') ?? undefined,
      );
      return;
    }
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
      viewport.current!.scrollTo({
        left: s.pan.left - (e.clientX - s.pan.x),
        top: s.pan.top - (e.clientY - s.pan.y),
        behavior: 'instant',
      });
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
    if (s.pan || busy || lock.current || retry || preview) return;
    const actions = commands();
    if (s.surface) {
      void sendMap({ tool: 'surface', ...s.surface, points: s.points });
      return;
    }
    if (s.note) {
      const note = notes.find((n) => n.id === s.note);
      if (note) {
        if (s.start.join() === s.end.join())
          onOpenNote({ levelId: note.levelId, x: note.x, y: note.y }, false);
        else
          void actions.moveNote({
            levelId: note.levelId,
            x: note.x,
            y: note.y,
            toX: s.end[0],
            toY: s.end[1],
            noteId: note.id,
            expectedRevision: note.revision,
          });
      }
      return;
    }
    if (s.monster) {
      if (s.start.join() === s.end.join()) onInspectMonster(s.monster);
      else void actions.moveMonster(s.monster, s.end);
      return;
    }
    if (effectiveTool === 'monster') {
      if (selectedCreature)
        void actions.moveMonster(selectedCreature.id, s.end);
      else onInspectMonster();
      return;
    }
    if (effectiveTool === 'place') {
      void actions.placeParty(s.end);
      return;
    }
    if (effectiveTool === 'openDoor') {
      void actions.toggleDoor(s.edge);
      return;
    }
    if (s.token || effectiveTool === 'move') {
      void actions.moveCharacter(s.end, s.token);
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
  function cancel() {
    active.current = null;
    setStroke(null);
    setKeyboardStart(null);
  }
  function keyAction(e: ReactKeyboardEvent<SVGSVGElement>) {
    handleMapKey(e, {
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
      onScenery,
      map,
      setInspection,
      keyboard,
      exploration,
      onOpenNote,
      selectedCreature,
      onInspectMonster,
      ...commands(),
      keyboardStart,
      setKeyboardStart,
    });
  }

  function lostCapture() {
    if (active.current) cancel();
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
