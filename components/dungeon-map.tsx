'use client';
import { useMapInteraction } from './dungeon-map/use-map-interaction';
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
import { Eye, EyeOff, Map as MapIcon, Hand, Check } from 'lucide-react';
import { TOOLBOX } from './dungeon-map/toolbox';
import { cellKey, playerDungeon, type Dungeon } from '../lib/dungeon';
import { useMapAppearance } from './dungeon-map/use-map-appearance';
import MapCanvas from './dungeon-map/canvas';
import MapToolbar from './dungeon-map/toolbar';
import MapRoomList from './dungeon-map/room-list';
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
  const [showRooms, setShowRooms] = useState(false);
  const {
    mode,
    tool,
    preview,
    inspection,
    setMode,
    setTool,
    setPreview,
    setInspection,
    resetStart,
    cancelStroke,
  } = useMapInteraction({
    levelId: exploration?.levelId,
    generationPick,
    battleId: exploration?.battle?.id,
    monsterPick,
    selected,
    pj,
  });
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
    resetStart,
    cancelStroke,
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
  const partyLevel = party?.levelId,
    partyX = party?.x,
    partyY = party?.y;
  useEffect(() => {
    if (
      pendingCenter.current &&
      partyLevel &&
      partyX !== undefined &&
      partyY !== undefined
    ) {
      pendingCenter.current = false;
      centerOnPoint([partyX, partyY], 'smooth');
    }
  }, [partyLevel, partyX, partyY, centerOnPoint]);
  const fittedGeneration = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (fittedGeneration.current === generationPick) return;
    fittedGeneration.current = generationPick;
    if (!generationPick || !pj) return;
    const frame = requestAnimationFrame(() => fitPaper());
    return () => cancelAnimationFrame(frame);
  }, [generationPick, pj, fitPaper]);
  function centerParty() {
    if (exploration?.location && !party) {
      pendingCenter.current = true;
      onLevel(exploration.location.levelId);
      return;
    }
    if (party) centerOnPoint([party.x, party.y], 'smooth');
  }
  function findRoom(n: MapNoteView) {
    setKeyboard([n.x, n.y]);
    centerOnPoint([n.x, n.y], 'smooth');
    setShowRooms(false);
  }
  return (
    <div className="paper-editor" data-map-style={appearance}>
      <TableAtmosphere
        shown={shown}
        mapSvg={svg}
        viewport={viewport}
        zoom={zoom}
      />
      <div className="paper-overlay" ref={overlay}>
        <MapToolbar
          pj={pj}
          mode={mode}
          preview={preview}
          effectiveTool={effectiveTool}
          locked={busy || !!stroke}
          toolsLocked={preview || busy || !!stroke || !!retry}
          zoomLocked={!!stroke}
          canUndo={canUndo && !busy && !preview && !stroke && !retry}
          canLead={canLead}
          exploration={exploration}
          showRooms={showRooms}
          zoom={zoom}
          appearance={appearance}
          onAppearance={setAppearance}
          onMode={(next) => {
            setPreview(false);
            setMode(next);
            switchTool(next === 'prepare' ? 'wall' : 'reveal');
          }}
          onTogglePreview={() => {
            setPreview(!preview);
            setKeyboardStart(null);
          }}
          onToggleRooms={() => setShowRooms((value) => !value)}
          onGenerate={onGenerate}
          onCenterParty={centerParty}
          onUndo={() => void sendMap({ tool: 'undo' })}
          onZoomOut={() => setZoom((z) => Math.max(0.4, z - 0.1))}
          onZoomIn={() => setZoom((z) => Math.min(1.6, z + 0.1))}
          onFit={() => fitPaper()}
          onTool={(id) => {
            switchTool(id);
            if (id === 'monster' && !selectedCreature) onInspectMonster();
          }}
        />
        {showRooms && (
          <MapRoomList
            notes={notes}
            shown={shown}
            visible={visible}
            pj={pj}
            busy={busy}
            levelName={exploration?.levelName}
            onFindRoom={findRoom}
            onOpenNote={onOpenNote}
          />
        )}
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
            {visible
              ? 'vidíte odhalené části'
              : `${W} × ${H} polí · skrytá kresba je zesvětlená`}
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
