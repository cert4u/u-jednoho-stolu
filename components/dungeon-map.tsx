'use client';
import { useMapViewport } from './dungeon-map/use-map-viewport';
import { useMapScenery } from './dungeon-map/use-map-scenery';
import {
  MapSceneryPalette,
  MapSceneryDialog,
} from './dungeon-map/scenery-tools';
import type { MapNoteView, NoteAnchor } from '../lib/map-notes';
import { createPortal } from 'react-dom';
import GuardedDialog from './guarded-dialog';
import MapInspector from './map-inspector';
import type { LootView } from '../lib/loot';
import type { ChallengeView } from '../lib/challenges';
import TableAtmosphere from './table-atmosphere';
import ExplorationControls from './exploration-controls';
import type { MonsterView } from '../lib/monsters';
import type { ExplorationView, Location } from '../lib/exploration';
import { useEffect, useRef, useState } from 'react';
import {
  PenTool,
  Eye,
  EyeOff,
  Undo2,
  Plus,
  Minus,
  Maximize2,
  Map as MapIcon,
  Hand,
  Check,
  StickyNote,
} from 'lucide-react';
import { TOOLBOX } from './dungeon-map/toolbox';
import {
  cellKey,
  playerDungeon,
  type Dungeon,
  type Point,
} from '../lib/dungeon';
import { useMapAppearance } from './dungeon-map/use-map-appearance';
import MapCanvas from './dungeon-map/canvas';
import MapAppearanceControl from './dungeon-map/renderers/appearance-control';
import { useMapInput } from './dungeon-map/use-map-input';
import {
  W,
  H,
  WIDTH,
  HEIGHT,
  SIZE,
  PAD,
  PAPER_MARGIN,
  type Tool,
  type Marker,
} from './dungeon-map/model';
type Props = {
  recapFocus?: Location;
  loot: LootView[];
  challenges: ChallengeView[];
  onOpenLoot: (id: string) => void;
  onOpenChallenge: (id: string) => void;
  generationPick: number;
  onGenerate: () => void;
  notes: MapNoteView[];
  onOpenNote: (anchor: NoteAnchor, publicView: boolean) => void;
  monsters: MonsterView[];
  selectedMonster: string;
  monsterPick: number;
  onInspectMonster: (id?: string) => void;
  map: Dungeon;
  members: Marker[];
  me: string;
  pj: boolean;
  busy: boolean;
  canUndo: boolean;
  selected: string;
  exploration?: ExplorationView;
  onLevel: (id: string) => void;
  onSelect: (id: string) => void;
  onAction: (
    action: string,
    values: Record<string, unknown>,
  ) => Promise<boolean | undefined>;
};
export default function DungeonMap({
  recapFocus,
  loot,
  challenges,
  onOpenLoot,
  onOpenChallenge,
  generationPick,
  onGenerate,
  map,
  members,
  me,
  pj,
  busy,
  canUndo,
  selected,
  onSelect,
  onAction,
  exploration,
  onLevel,
  monsters,
  selectedMonster,
  monsterPick,
  onInspectMonster,
  notes,
  onOpenNote,
}: Props) {
  const [appearance, setAppearance] = useMapAppearance();
  const [inspection, setInspection] = useState<{
    point: Point;
    edge?: string;
  } | null>(null);
  const [showRooms, setShowRooms] = useState(false),
    [mode, setMode] = useState<'prepare' | 'play'>('prepare'),
    [tool, setTool] = useState<Tool>(pj ? 'wall' : 'move'),
    [preview, setPreview] = useState(false);
  const {
    overlay,
    viewport,
    svg,
    zoom,
    space,
    ctrlPan,
    setZoom,
    fitPaper,
    centerOnPoint,
  } = useMapViewport();
  const pendingCenter = useRef(false);
  const scenery = useMapScenery({
    map,
    members,
    exploration,
    notes,
    monsters,
    onAction,
  });
  const visible = preview || !pj;
  const shown = visible ? exploration?.playerMap || playerDungeon(map) : map;
  const revealed = new Set(map.revealed);
  const effectiveTool = preview ? 'move' : tool;
  const canDraw = pj && !preview;
  const current = TOOLBOX.find((t) => t.id === effectiveTool)!;
  const lit = new Set(exploration?.visible || []);
  const party =
    exploration?.location?.levelId === exploration?.levelId
      ? exploration?.location
      : undefined;
  const canLead = pj || exploration?.leaderId === me;
  const selectedCreature = monsters.find(
    (m) => m.id === selectedMonster && !m.archived,
  );
  const recapCell =
    recapFocus?.levelId === exploration?.levelId &&
    recapFocus &&
    shown.floors.includes(cellKey(recapFocus.x, recapFocus.y))
      ? recapFocus
      : undefined;
  const {
    stroke,
    keyboard,
    setKeyboard,
    keyboardStart,
    setKeyboardStart,
    retry,
    clearRetry,
    retryMap,
    switchTool: inputSwitchTool,
    sendMap,
    sendExplore,
    beginPaper,
    begin,
    drag,
    finish,
    cancel,
    lostCapture,
    keyAction,
  } = useMapInput({
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
    onScenery: (point, id) => scenery.click(point, id, sendMap),
    surfaceBrush: scenery.surfaceBrush,
    onCancelScenery: scenery.cancelMove,
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
  });
  function switchTool(next: Tool) {
    if (next !== 'scenery') scenery.cancelMove();
    inputSwitchTool(next);
  }
  useEffect(() => {
    if (!recapCell) return;
    const frame = requestAnimationFrame(() => {
      centerOnPoint([recapCell.x, recapCell.y]);
    });
    return () => cancelAnimationFrame(frame);
  }, [recapCell, centerOnPoint]);
  useEffect(() => {
    setInspection(null);
    cancel();
    if (pendingCenter.current && party) {
      pendingCenter.current = false;
      centerParty();
    }
  }, [exploration?.levelId]);
  useEffect(() => {
    if (!generationPick || !pj) return;
    setMode('prepare');
    setPreview(false);
    setTool('hand');
    setKeyboardStart(null);
    const frame = requestAnimationFrame(() => fitPaper());
    return () => cancelAnimationFrame(frame);
  }, [generationPick]);
  useEffect(() => {
    if (exploration?.battle) {
      setTool('move');
      setPreview(false);
      setKeyboardStart(null);
    }
  }, [exploration?.battle?.id]);
  useEffect(() => {
    if (monsterPick && pj) {
      setTool('monster');
      setPreview(false);
      setKeyboardStart(null);
    }
  }, [monsterPick]);
  useEffect(() => {
    if (selected) {
      setTool('move');
      setKeyboardStart(null);
    }
  }, [selected]);
  function centerParty() {
    if (exploration?.location && !party) {
      pendingCenter.current = true;
      onLevel(exploration.location.levelId);
      return;
    }
    if (party) centerOnPoint([party.x, party.y], 'smooth');
  }
  const roomNotes = notes
    .filter(
      (n) =>
        (!visible || n.shared) &&
        n.roomNumber &&
        (!visible ||
          (shown.floors.includes(cellKey(n.x, n.y)) &&
            shown.revealed.includes(cellKey(n.x, n.y)))),
    )
    .map((n) =>
      visible && pj
        ? {
            ...n,
            roomNumber: n.published?.roomNumber,
            title: n.published?.title || n.title,
          }
        : n,
    )
    .filter((n) => n.roomNumber)
    .sort((a, b) => a.roomNumber! - b.roomNumber!);
  function findRoom(n: MapNoteView) {
    setKeyboard([n.x, n.y]);
    centerOnPoint([n.x, n.y], 'smooth');
    setShowRooms(false);
  }
  return (
    <div className="paper-editor" data-map-style={appearance}>
      <TableAtmosphere />
      <div className="paper-overlay" ref={overlay}>
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
                  onClick={() => {
                    setPreview(false);
                    setMode('prepare');
                    switchTool('wall');
                  }}
                  disabled={busy || !!stroke}
                >
                  <PenTool size={14} /> Příprava mapy
                </button>
                <button
                  className={mode === 'play' && !preview ? 'active' : ''}
                  onClick={() => {
                    setPreview(false);
                    setMode('play');
                    switchTool('reveal');
                  }}
                  disabled={busy || !!stroke}
                >
                  <Eye size={14} /> Odkrývání
                </button>
              </div>
              <button
                className={'player-view ' + (preview ? 'active' : '')}
                aria-pressed={preview}
                onClick={() => {
                  setPreview(!preview);
                  setKeyboardStart(null);
                }}
                disabled={busy || !!stroke}
              >
                <UsersIcon /> Pohled družiny
              </button>
            </>
          ) : (
            <span className="paper-player-label">
              <MapIcon size={15} /> Vaše společná mapa
            </span>
          )}
          <div className="paper-utility">
            <MapAppearanceControl
              appearance={appearance}
              onChange={setAppearance}
            />
            <button
              aria-label="Seznam místností"
              aria-expanded={showRooms}
              onClick={() => setShowRooms((v) => !v)}
            >
              <StickyNote size={16} />
              <span>Místa</span>
            </button>
            {exploration?.location && (
              <button
                title="Najít družinu"
                aria-label="Najít družinu"
                onClick={centerParty}
              >
                <MapIcon size={16} />
              </button>
            )}
            {pj && (
              <button
                title="Vrátit poslední tah nebo odhalení"
                aria-label="Vrátit poslední akci mapy"
                disabled={!canUndo || busy || preview || !!stroke || !!retry}
                onClick={() => void sendMap({ tool: 'undo' })}
              >
                <Undo2 size={17} />
              </button>
            )}
            <button
              aria-label="Oddálit mapu"
              disabled={!!stroke}
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            >
              <Minus size={14} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Přiblížit mapu"
              disabled={!!stroke}
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
            >
              <Plus size={14} />
            </button>
            <button
              aria-label="Přizpůsobit mapu oknu"
              disabled={!!stroke}
              onClick={() => fitPaper()}
            >
              <Maximize2 size={14} />
            </button>
          </div>
          <div className="paper-toolbar">
            <div className="paper-tools">
              {TOOLBOX.filter((t) =>
                !pj
                  ? [
                      'hand',
                      'move',
                      ...(exploration?.enabled && canLead ? ['openDoor'] : []),
                    ].includes(t.id)
                  : mode === 'prepare'
                    ? [
                        'inspect',
                        'scenery',
                        'entrance',
                        'exit',
                        'note',
                        'hand',
                        'monster',
                        'wall',
                        'room',
                        'floor',
                        'door',
                        'stairsUp',
                        'stairsDown',
                        'stairsBoth',
                        'subtract',
                        'erase',
                        'move',
                      ].includes(t.id)
                    : [
                        'inspect',
                        'scenery',
                        'note',
                        'hand',
                        'monster',
                        'reveal',
                        'hide',
                        'move',
                        ...(exploration ? ['place', 'openDoor'] : []),
                      ].includes(t.id),
              )
                .sort((a, b) => {
                  const order = [
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
                    'place',
                    'openDoor',
                    'reveal',
                    'hide',
                  ];
                  return order.indexOf(a.id) - order.indexOf(b.id);
                })
                .map(({ id, icon: Icon, name, hint }) => (
                  <button
                    key={id}
                    data-tool={id}
                    title={hint}
                    aria-label={name}
                    aria-pressed={effectiveTool === id && !preview}
                    className={effectiveTool === id && !preview ? 'active' : ''}
                    disabled={preview || busy || !!stroke || !!retry}
                    onClick={() => {
                      switchTool(id);
                      if (id === 'monster' && !selectedCreature)
                        onInspectMonster();
                    }}
                  >
                    <Icon size={17} />
                    <span>
                      {id === 'move' &&
                      exploration?.enabled &&
                      !exploration.battle
                        ? 'Družina'
                        : name}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
        <>
          {showRooms && (
            <section className="map-room-list" aria-label="Místnosti na patře">
              <strong>Místnosti · {exploration?.levelName || 'Přízemí'}</strong>
              {roomNotes.length ? (
                roomNotes.map((n) => (
                  <div key={n.id}>
                    <button
                      disabled={busy}
                      onClick={() => findRoom(n)}
                      title="Najít v mapě"
                    >
                      {n.roomNumber} · {n.title}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        onOpenNote(
                          { levelId: n.levelId, x: n.x, y: n.y },
                          visible,
                        )
                      }
                      aria-label={`Otevřít místo ${n.roomNumber}`}
                    >
                      {visible ? 'Popis' : 'Příprava'}
                    </button>
                  </div>
                ))
              ) : (
                <p>
                  {pj && !visible
                    ? 'Nástrojem Označit místo klikni do místnosti a zadej její číslo a název.'
                    : 'Zatím neznáte žádné označené místnosti.'}
                </p>
              )}
            </section>
          )}
        </>
        <ExplorationControls
          data={exploration}
          members={members}
          me={me}
          pj={pj}
          busy={busy || !!retry || !!stroke}
          onAction={sendExplore}
          onLevel={onLevel}
          picked={keyboard}
          entrance={map.access?.entrance}
        />
        {pj && !preview && effectiveTool === 'scenery' && (
          <MapSceneryPalette scenery={scenery} busy={busy} />
        )}
        {pj && preview && (
          <div className="preview-notice">
            <Eye size={14} /> Takto mapu vidí hráči. Pro úpravy se vrať do
            přípravy nebo odkrývání.
          </div>
        )}
      </div>
      <div className="paper-frame">
        <div className="paper-caption">
          <span>
            <MapIcon size={13} />
            {preview ? 'POHLED DRUŽINY' : 'ČTVEREČKOVANÝ PAPÍR'}
          </span>
          <small>
            {W} × {H} polí ·{' '}
            {pj && !preview
              ? 'skrytá kresba je zesvětlená'
              : 'vidíte odhalené části'}
          </small>
        </div>
        <div
          className={'paper-viewport ' + (space ? 'panning' : '')}
          tabIndex={0}
          role="region"
          aria-label="Mapa dobrodružství – posun šipkami"
          ref={viewport}
        >
          <div
            className="paper-world"
            style={{
              width: (WIDTH + PAPER_MARGIN * 2) * zoom,
              height: (HEIGHT + PAPER_MARGIN * 2) * zoom,
              backgroundSize: `${SIZE * zoom}px ${SIZE * zoom}px`,
              backgroundPosition: `${(PAPER_MARGIN + PAD) * zoom}px ${(PAPER_MARGIN + PAD) * zoom}px`,
              cursor: stroke?.pan
                ? 'grabbing'
                : ctrlPan || space || effectiveTool === 'hand'
                  ? 'grab'
                  : 'default',
            }}
            onPointerDown={beginPaper}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) drag(e);
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) finish(e);
            }}
            onPointerCancel={cancel}
          >
            <MapCanvas
              appearance={appearance}
              surfaceBrush={scenery.surfaceBrush}
              sceneryPreview={
                !scenery.proposalStale && tool === 'scenery'
                  ? scenery.proposal?.items
                  : undefined
              }
              map={{ shown, revealed, lit, party, recapCell, visible }}
              input={{
                zoom,
                ctrlPan,
                space,
                effectiveTool,
                tool,
                svg,
                stroke,
                keyboard,
                keyboardStart,
                setKeyboard,
                begin,
                drag,
                finish,
                cancel,
                lostCapture,
                keyAction,
              }}
              busy={busy}
              exploration={exploration}
              members={members}
              monsters={monsters}
              notes={notes}
              onOpenNote={onOpenNote}
              pj={pj}
              preview={preview}
              selected={selected}
              selectedMonster={selectedMonster}
            />
          </div>
        </div>
      </div>
      {pj &&
        !visible &&
        inspection &&
        createPortal(
          <GuardedDialog
            label="Co je na mapě"
            className="modal map-inspector-modal"
            onClose={() => setInspection(null)}
          >
            <MapInspector
              busy={busy}
              onDoor={async (values) => {
                const ok = await onAction('map', {
                  ...values,
                  levelId: exploration?.levelId,
                  requestId: crypto.randomUUID(),
                });
                if (ok) setInspection(null);
                return ok;
              }}
              {...inspection}
              map={map}
              notes={notes}
              monsters={monsters}
              members={members}
              exploration={exploration}
              loot={loot}
              challenges={challenges}
              onNote={(anchor) => {
                setInspection(null);
                onOpenNote(anchor, false);
              }}
              onMonster={(id) => {
                setInspection(null);
                onInspectMonster(id);
              }}
              onLoot={(id) => {
                setInspection(null);
                onOpenLoot(id);
              }}
              onChallenge={(id) => {
                setInspection(null);
                onOpenChallenge(id);
              }}
            />
          </GuardedDialog>,
          document.body,
        )}
      {pj && !visible && (
        <MapSceneryDialog
          scenery={scenery}
          map={map}
          busy={busy}
          onMove={() => switchTool('scenery')}
        />
      )}
      {retry && (
        <div className="map-retry" role="alert">
          <span>Tah není potvrzený. Zkus jej znovu odeslat.</span>
          <button disabled={busy} onClick={retryMap}>
            Znovu uložit tah
          </button>
          <button disabled={busy} onClick={clearRetry}>
            Zavřít
          </button>
        </div>
      )}
      <div className="paper-help">
        <span>
          {preview
            ? 'Pohled družiny · kreslení je vypnuté'
            : effectiveTool === 'monster'
              ? `Umístění: ${selectedCreature?.name || 'vyber příšeru v seznamu'}. Klikni na podlahu; Ctrl + tažení posouvá papír.`
              : exploration?.enabled && effectiveTool === 'move'
                ? exploration.battle
                  ? 'Bojové rozestavení: vyber hrdinu a klikni na známou průchozí podlahu. Hráč ovládá jen svou postavu.'
                  : canLead
                    ? 'Klikni na známé průchozí políčko. Družina půjde společně.'
                    : 'Pohyb družiny ovládá vedoucí nebo PJ.'
                : keyboardStart
                  ? 'Vyber druhý roh šipkami a potvrď Enterem.'
                  : current.hint}
        </span>
        <span>
          <Hand size={12} /> Ctrl + levé tažení · Mezerník + tažení · Ctrl +
          kolečko
        </span>
      </div>
      <div className="under-map">
        <span>
          <EyeOff size={13} />
          {pj
            ? 'Skryté části zůstávají pouze u PJ.'
            : 'Odhalená mapa zůstává viditelná i po odchodu postav.'}
        </span>
        <span>
          {busy
            ? 'Ukládání…'
            : retry
              ? 'Tah čeká na potvrzení'
              : 'Změny se ukládají automaticky'}{' '}
          {!busy && !retry && <Check size={12} />}
        </span>
      </div>
    </div>
  );
}
function UsersIcon() {
  return <Eye size={14} />;
}
