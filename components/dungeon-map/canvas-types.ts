import type { RefObject } from 'react';
import type { Dungeon } from '../../lib/dungeon';
import type { ExplorationView, Location } from '../../lib/exploration';
import type { MonsterView } from '../../lib/monsters';
import type { MapNoteView, NoteAnchor } from '../../lib/map-notes';
import type { SurfaceBrush } from '../../lib/surfaces';
import type { ScenerySuggestion } from '../../lib/scenery-fill';
import type { Tool, Marker } from './model';
import type { MapAppearance } from './use-map-appearance';
import type { useMapInput } from './use-map-input';
export type CanvasInput = Pick<
  ReturnType<typeof useMapInput>,
  | 'stroke'
  | 'keyboard'
  | 'keyboardStart'
  | 'setKeyboard'
  | 'begin'
  | 'drag'
  | 'finish'
  | 'cancel'
  | 'lostCapture'
  | 'keyAction'
> & {
  svg: RefObject<SVGSVGElement | null>;
  zoom: number;
  ctrlPan: boolean;
  space: boolean;
  effectiveTool: Tool;
  tool: Tool;
};

export type CanvasProps = {
  appearance: MapAppearance;
  input: CanvasInput;
  map: {
    shown: Dungeon;
    revealed: Set<string>;
    lit: Set<string>;
    party?: Location;
    recapCell?: Location;
    visible: boolean;
  };
  busy: boolean;
  exploration?: ExplorationView;
  members: Marker[];
  monsters: MonsterView[];
  notes: MapNoteView[];
  onOpenNote: (anchor: NoteAnchor, publicView: boolean) => void;
  pj: boolean;
  preview: boolean;
  selected: string;
  selectedMonster: string;
  surfaceBrush?: SurfaceBrush;
  sceneryPreview?: ScenerySuggestion[];
};
