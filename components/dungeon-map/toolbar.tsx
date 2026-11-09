import {
  Eye,
  Map as MapIcon,
  Maximize2,
  Minus,
  PenTool,
  Plus,
  StickyNote,
  Undo2,
} from 'lucide-react';
import type { ExplorationView } from '../../lib/exploration';
import type { Tool } from './model';
import type { MapAppearance } from './use-map-appearance';
import MapAppearanceControl from './renderers/appearance-control';
import { TOOLBOX } from './toolbox';

type ToolbarTool = (typeof TOOLBOX)[number]['id'];

const preparationTools: ToolbarTool[] = [
  'inspect',
  'hand',
  'move',
  'note',
  'monster',
  'scenery',
  'room',
  'floor',
  'wall',
  'door',
  'stairsUp',
  'stairsDown',
  'stairsBoth',
  'entrance',
  'exit',
  'subtract',
  'erase',
];
const discoveryTools: ToolbarTool[] = [
  'inspect',
  'hand',
  'move',
  'note',
  'monster',
  'scenery',
];

type Mode = 'prepare' | 'play';
type Props = {
  pj: boolean;
  mode: Mode;
  preview: boolean;
  effectiveTool: Tool;
  locked: boolean;
  toolsLocked: boolean;
  zoomLocked: boolean;
  canUndo: boolean;
  canLead: boolean;
  exploration?: ExplorationView;
  showRooms: boolean;
  zoom: number;
  appearance: MapAppearance;
  onAppearance: (value: MapAppearance) => void;
  onMode: (mode: Mode) => void;
  onTogglePreview: () => void;
  onToggleRooms: () => void;
  onGenerate: () => void;
  onCenterParty: () => void;
  onUndo: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  onTool: (tool: Tool) => void;
};

export default function MapToolbar({
  pj,
  mode,
  preview,
  effectiveTool,
  locked,
  toolsLocked,
  zoomLocked,
  canUndo,
  canLead,
  exploration,
  showRooms,
  zoom,
  appearance,
  onAppearance,
  onMode,
  onTogglePreview,
  onToggleRooms,
  onGenerate,
  onCenterParty,
  onUndo,
  onZoomOut,
  onZoomIn,
  onFit,
  onTool,
}: Props) {
  const tools: ToolbarTool[] = !pj
    ? [
        'hand',
        'move',
        ...(exploration?.enabled && canLead ? ['openDoor' as const] : []),
      ]
    : mode === 'prepare'
      ? preparationTools
      : [
          ...discoveryTools,
          ...(exploration ? (['place', 'openDoor'] as const) : []),
          'reveal',
          'hide',
        ];

  return (
    <div className="paper-controls">
      {pj && (
        <button className="generator-open" onClick={onGenerate}>
          Generátor
        </button>
      )}
      {pj ? (
        <>
          <div className="paper-modes">
            <button
              className={mode === 'prepare' && !preview ? 'active' : ''}
              onClick={() => onMode('prepare')}
              disabled={locked}
            >
              <PenTool size={14} /> Příprava mapy
            </button>
            <button
              className={mode === 'play' && !preview ? 'active' : ''}
              onClick={() => onMode('play')}
              disabled={locked}
            >
              <Eye size={14} /> Odkrývání
            </button>
          </div>
          <button
            className={'player-view ' + (preview ? 'active' : '')}
            aria-pressed={preview}
            onClick={onTogglePreview}
            disabled={locked}
          >
            <Eye size={14} /> Pohled družiny
          </button>
        </>
      ) : (
        <span className="paper-player-label">
          <MapIcon size={15} /> Vaše společná mapa
        </span>
      )}
      <div className="paper-utility">
        <MapAppearanceControl appearance={appearance} onChange={onAppearance} />
        <button
          aria-label="Seznam místností"
          aria-expanded={showRooms}
          onClick={onToggleRooms}
        >
          <StickyNote size={16} />
          <span>Místa</span>
        </button>
        {exploration?.location && (
          <button
            title="Najít družinu"
            aria-label="Najít družinu"
            onClick={onCenterParty}
          >
            <MapIcon size={16} />
          </button>
        )}
        {pj && (
          <button
            title="Vrátit poslední tah nebo odhalení"
            aria-label="Vrátit poslední akci mapy"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 size={17} />
          </button>
        )}
        <button
          aria-label="Oddálit mapu"
          disabled={zoomLocked}
          onClick={onZoomOut}
        >
          <Minus size={14} />
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          aria-label="Přiblížit mapu"
          disabled={zoomLocked}
          onClick={onZoomIn}
        >
          <Plus size={14} />
        </button>
        <button
          aria-label="Přizpůsobit mapu oknu"
          disabled={zoomLocked}
          onClick={onFit}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <div className="paper-toolbar">
        <div className="paper-tools">
          {tools
            .map((tool) => TOOLBOX.find(({ id }) => id === tool)!)
            .map(({ id, icon: Icon, name, hint }) => (
              <button
                key={id}
                data-tool={id}
                title={hint}
                aria-label={name}
                aria-pressed={effectiveTool === id && !preview}
                className={effectiveTool === id && !preview ? 'active' : ''}
                disabled={toolsLocked}
                onClick={() => onTool(id)}
              >
                <Icon size={17} />
                <span>
                  {id === 'move' && exploration?.enabled && !exploration.battle
                    ? 'Družina'
                    : name}
                </span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
