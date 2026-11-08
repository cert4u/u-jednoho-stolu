import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { SurfaceBrush } from '../../lib/surfaces';
import type { Dungeon, Point } from '../../lib/dungeon';
import type { ExplorationView } from '../../lib/exploration';
import type { MapNoteView, NoteAnchor } from '../../lib/map-notes';
import type { MonsterView } from '../../lib/monsters';
import type { Tool, Marker } from './model';
export type MapInput = {
  resetStart: number;
  cancelStroke: number;
  surfaceBrush?: SurfaceBrush;
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
  onCancelScenery: () => void;
  onScenery: (point: Point, id?: string) => void;
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
