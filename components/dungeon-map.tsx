'use client';
import {findSceneryEntry} from '../lib/scenery-catalog';
import {proposeScenery,sceneryFillStamp,type SceneryFillOptions,type ScenerySuggestion} from '../lib/scenery-fill';
import SceneryPalette, {type SceneryBrush} from './scenery/palette';
import SceneryEditor from './scenery/editor';
import type {Scenery} from '../lib/scenery';
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
  MousePointer2,
  PenTool,
  Square,
  DoorOpen,
  Eraser,
  Eye,
  EyeOff,
  Undo2,
  Plus,
  Minus,
  Maximize2,
  Map as MapIcon,
  Hand,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Skull,
  StickyNote,
  LogIn,
  LogOut,
  Info,
  Package,
} from 'lucide-react';
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
const TOOLBOX = [
  {id:'scenery',icon:Package,name:'Stafáž',hint:'Vyber prvek a klikni do mapy. Existující stafáž lze upravit, přesunout nebo skrýt.'},
  {
    id: 'inspect',
    icon: Info,
    name: 'Prozkoumat',
    hint: 'Jen PJ: klikni na značku pro podrobnosti, nebo do místnosti pro přehled jejího obsahu.',
  },
  {
    id: 'entrance',
    icon: LogIn,
    name: 'Vchod',
    hint: 'Klikni na podlahu pro výchozí bod dobrodružství. Nové umístění přesune původní vchod.',
  },
  {
    id: 'exit',
    icon: LogOut,
    name: 'Východ',
    hint: 'Klikni na podlahu pro samostatný východ z podzemí.',
  },
  {
    id: 'note',
    icon: StickyNote,
    name: 'Označit místo',
    hint: 'Klikni na podlahu pro číslo, název a přípravu místnosti. Tajné poznámky vidí jen PJ; popis můžeš zvlášť sdílet.',
  },
  {
    id: 'monster',
    icon: Skull,
    name: 'Příšera',
    hint: 'Vyber příšeru v seznamu a klikni na podlahu. Značku lze i přetáhnout; kliknutí otevře údaje.',
  },
  {
    id: 'stairsUp',
    icon: ArrowUp,
    name: 'Schody nahoru',
    hint: 'Klikni na podlahu pro značku schodiště nahoru. Propojení pater nastavíš zvlášť.',
  },
  {
    id: 'stairsDown',
    icon: ArrowDown,
    name: 'Schody dolů',
    hint: 'Klikni na podlahu pro značku schodiště dolů.',
  },
  {
    id: 'stairsBoth',
    icon: ArrowUpDown,
    name: 'Schody oba směry',
    hint: 'Klikni na podlahu pro schodiště nahoru i dolů.',
  },
  {
    id: 'hand',
    icon: Hand,
    name: 'Ruka',
    hint: 'Táhni papír myší pro posun mapy.',
  },
  {
    id: 'place',
    icon: MapIcon,
    name: 'Umístit družinu',
    hint: 'PJ kliknutím určí počáteční políčko družiny.',
  },
  {
    id: 'openDoor',
    icon: DoorOpen,
    name: 'Otevřít / zavřít',
    hint: 'Vedoucí klikne na dveře vedle družiny. Zavřené dveře zastavují pohyb i výhled.',
  },
  {
    id: 'move',
    icon: MousePointer2,
    name: 'Postavy',
    hint: 'Vyber značku postavy a klikni na cílové políčko. Značku můžeš i přetáhnout.',
  },
  {
    id: 'wall',
    icon: PenTool,
    name: 'Příčka',
    hint: 'Ručně přidaná příčka zůstává i při spojování místností. Táhni tužkou mezi průsečíky mřížky. Kliknutí nakreslí jednu hranu.',
  },
  {
    id: 'room',
    icon: Square,
    name: 'Místnost',
    hint: 'Táhni od rohu k rohu. Překrývající se místnosti se spojí a obvod se přizpůsobí.',
  },
  {
    id: 'floor',
    icon: PenTool,
    name: 'Chodba',
    hint: 'Táhni přes políčka. Chodba spojí prostory a obvodové zdi se upraví.',
  },
  {
    id: 'door',
    icon: DoorOpen,
    name: 'Dveře',
    hint: 'Klikni na hranu čtverečku. Pokud tu není zeď, vznikne příčka s dveřmi.',
  },
  {
    id: 'subtract',
    icon: Minus,
    name: 'Ubrat prostor',
    hint: 'Táhni přes políčka, která chceš odebrat. Obvodové zdi se přizpůsobí.',
  },
  {
    id: 'erase',
    icon: Eraser,
    name: 'Guma',
    hint: 'Maže ruční příčky, dveře a značky schodů, vchodu a východu. Značku smažeš kliknutím doprostřed políčka. Pro změnu půdorysu použij Ubrat prostor.',
  },
  {
    id: 'reveal',
    icon: Eye,
    name: 'Odhalit',
    hint: 'Táhni obdélník přes oblast, kterou má družina vidět.',
  },
  {
    id: 'hide',
    icon: EyeOff,
    name: 'Skrýt',
    hint: 'Táhni obdélník přes oblast, kterou chceš znovu skrýt.',
  },
] as const;
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
    [preview, setPreview] = useState(false),
    [zoom, setZoomValue] = useState(0.8),
    [space, setSpace] = useState(false),
    [ctrlPan, setCtrlPan] = useState(false);
  const overlay = useRef<HTMLDivElement>(null),
    zoomValue = useRef(0.8),
    viewport = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null),
    pendingCenter = useRef(false);
  const [sceneryBrush,setSceneryBrush] = useState<SceneryBrush>({kind:'crate',rotation:0,size:'medium',hidden:false});
  const [surfaceOp,setSurfaceOp]=useState<'add'|'remove'>('add');
  const [sceneryEdit,setSceneryEdit] = useState<{item:Scenery;levelId:string}>();
  const [movingScenery,setMovingScenery] = useState<{item:Scenery;levelId:string}>();
  const surfaceBrush=findSceneryEntry(sceneryBrush.kind)?.surface&&!movingScenery?{kind:sceneryBrush.kind,op:surfaceOp,hidden:Boolean(sceneryBrush.hidden)}:undefined;
  const [floorProposal,setFloorProposal]=useState<{levelId:string;stamp:string;options:SceneryFillOptions;items:ScenerySuggestion[];requestId:string}>();
  const fillBlocked=[...new Set([...(exploration?.stairs??[]).map(item=>`${item.x},${item.y}`),...notes.map(item=>`${item.x},${item.y}`),...monsters.filter(item=>!item.archived&&item.x!==null&&item.y!==null).map(item=>`${item.x},${item.y}`),
    ...members.filter(item=>item.role==='player'&&(!exploration?.location||exploration.location.levelId===exploration.levelId)).map(item=>`${item.x},${item.y}`),
    ...(exploration?.location?.levelId===exploration?.levelId&&exploration?.location?[`${exploration.location.x},${exploration.location.y}`]:[])])];
  const fillStamp=sceneryFillStamp(map,fillBlocked);
  const proposalStale=Boolean(floorProposal&&(floorProposal.levelId!==(exploration?.levelId||'ground')||floorProposal.stamp!==fillStamp));
  function sceneryClick(point:Point,id?:string) {
    const levelId=exploration?.levelId || 'ground';
    if(movingScenery) {
      if(movingScenery.levelId !== levelId){setMovingScenery(undefined);return;}
      void sendMap({tool:'scenery',op:'save',...movingScenery.item,sceneryId:movingScenery.item.id,
        expectedRevision:movingScenery.item.revision ?? 0,x:point[0],y:point[1]});
      setMovingScenery(undefined);
    } else if(id) {
      const item=map.scenery?.find(item=>item.id===id);
      if(item)setSceneryEdit({item:structuredClone(item),levelId});
    } else void sendMap({tool:'scenery',op:'save',...sceneryBrush,note:'',expectedRevision:null,x:point[0],y:point[1]});
  }
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
    onScenery: sceneryClick,
    surfaceBrush,
    onCancelScenery: () => setMovingScenery(undefined),
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
    if(next !== 'scenery') setMovingScenery(undefined);
    inputSwitchTool(next);
  }
  useEffect(() => {
    if (!recapCell) return;
    const frame = requestAnimationFrame(() => {
      const el = viewport.current;
      if (!el) return;
      const scale = zoomValue.current;
      el.scrollTo({
        left:
          (PAPER_MARGIN + PAD + (recapCell.x + 0.5) * SIZE) * scale -
          el.clientWidth / 2,
        top:
          (PAPER_MARGIN + PAD + (recapCell.y + 0.5) * SIZE) * scale -
          el.clientHeight / 2,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [recapCell]);
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
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => fitPaper());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) =>
        Math.min(
          1.6,
          Math.max(
            0.4,
            Math.round((z + (e.deltaY < 0 ? 0.1 : -0.1)) * 100) / 100,
          ),
        ),
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlPan(true);
      if (
        e.code === 'Space' &&
        !(e.target as HTMLElement)?.closest(
          'input,textarea,select,button,[role="dialog"]',
        )
      ) {
        setSpace(true);
        if (e.target === svg.current) e.preventDefault();
      }
    };
    const up = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.code === 'Space') setSpace(false);
        setCtrlPan(e.ctrlKey);
      } else {
        setSpace(false);
        setCtrlPan(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', up);
    };
  }, []);
  function setZoom(next: number | ((previous: number) => number)) {
    const previous = zoomValue.current;
    const value = Math.min(
      1.6,
      Math.max(0.4, typeof next === 'function' ? next(previous) : next),
    );
    const el = viewport.current;
    const cx = el ? (el.scrollLeft + el.clientWidth / 2) / previous : 0,
      cy = el ? (el.scrollTop + el.clientHeight / 2) / previous : 0;
    zoomValue.current = value;
    setZoomValue(value);
    if (el)
      requestAnimationFrame(() => {
        if (viewport.current === el)
          el.scrollTo({
            left: cx * value - el.clientWidth / 2,
            top: cy * value - el.clientHeight / 2,
          });
      });
  }
  function fitPaper(limit = 1.2) {
    const el = viewport.current;
    if (!el) return;
    const top = Math.max(
      80,
      (overlay.current?.getBoundingClientRect().bottom || 0) -
        el.getBoundingClientRect().top +
        24,
    );
    const available = Math.max(200, el.clientHeight - top - 65);
    const value = Math.max(
      0.4,
      Math.min(limit, (el.clientWidth - 90) / WIDTH, available / HEIGHT),
    );
    setZoom(value);
    requestAnimationFrame(() => {
      if (viewport.current === el)
        el.scrollTo({
          left: (PAPER_MARGIN + WIDTH / 2) * value - el.clientWidth / 2,
          top: (PAPER_MARGIN + HEIGHT / 2) * value - (top + available / 2),
        });
    });
  }
  function centerParty() {
    if (exploration?.location && !party) {
      pendingCenter.current = true;
      onLevel(exploration.location.levelId);
      return;
    }
    if (!party || !viewport.current) return;
    viewport.current.scrollTo({
      left:
        (PAPER_MARGIN + PAD + (party.x + 0.5) * SIZE) * zoom -
        viewport.current.clientWidth / 2,
      top:
        (PAPER_MARGIN + PAD + (party.y + 0.5) * SIZE) * zoom -
        viewport.current.clientHeight / 2,
      behavior: 'smooth',
    });
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
    const el = viewport.current;
    if (el)
      el.scrollTo({
        left:
          (PAPER_MARGIN + PAD + (n.x + 0.5) * SIZE) * zoom - el.clientWidth / 2,
        top:
          (PAPER_MARGIN + PAD + (n.y + 0.5) * SIZE) * zoom -
          el.clientHeight / 2,
        behavior: 'smooth',
      });
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
              <MapAppearanceControl appearance={appearance} onChange={setAppearance} />
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
              ).sort((a, b) => {
                const order = ['inspect', 'hand', 'move', 'note', 'monster', 'scenery', 'room', 'floor', 'wall', 'door', 'stairsUp', 'stairsDown', 'stairsBoth', 'entrance', 'exit', 'subtract', 'erase', 'place', 'openDoor', 'reveal', 'hide'];
                return order.indexOf(a.id) - order.indexOf(b.id);
              }).map(({ id, icon: Icon, name, hint }) => (
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
        {pj && !preview && effectiveTool === 'scenery' && <SceneryPalette surfaceOp={surfaceOp} onSurfaceOp={setSurfaceOp} brush={sceneryBrush} onChange={next=>{setSceneryBrush(next);if(findSceneryEntry(next.kind)?.surface)setFloorProposal(undefined);}}
          moving={Boolean(movingScenery && movingScenery.levelId === (exploration?.levelId || 'ground'))} onCancelMove={()=>setMovingScenery(undefined)}
          fill={{busy:busy||Boolean(movingScenery),hidden:Boolean(sceneryBrush.hidden),
            proposal:floorProposal?{options:floorProposal.options,count:floorProposal.items.length,stale:proposalStale}:undefined,
            onDiscard:()=>setFloorProposal(undefined),
            onPreview:options=>setFloorProposal({levelId:exploration?.levelId||'ground',stamp:fillStamp,options,items:proposeScenery(map,fillBlocked,options),requestId:crypto.randomUUID()}),
            onApply:async()=>{if(!floorProposal||proposalStale)return;const ok=await onAction('map',{tool:'scenery-fill',levelId:floorProposal.levelId,options:floorProposal.options,expectedStamp:floorProposal.stamp,requestId:floorProposal.requestId});if(ok)setFloorProposal(undefined);return ok;},
          }} />}
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
              surfaceBrush={surfaceBrush}
              sceneryPreview={!proposalStale && tool==='scenery' ? floorProposal?.items : undefined}
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
      {pj && !visible && sceneryEdit && sceneryEdit.levelId === (exploration?.levelId || 'ground') && createPortal(
        <GuardedDialog label="Stafáž mapy" className="modal scenery-modal" onClose={()=>setSceneryEdit(undefined)}>
          <SceneryEditor key={sceneryEdit.item.id} item={sceneryEdit.item}
            current={map.scenery?.find(item=>item.id===sceneryEdit.item.id)} busy={busy}
            onSave={async values=>{const ok=await onAction('map',{...values,tool:'scenery',op:'save',levelId:sceneryEdit.levelId});if(ok)setSceneryEdit(undefined);return ok;}}
            onRemove={async values=>{const ok=await onAction('map',{...values,tool:'scenery',op:'remove',levelId:sceneryEdit.levelId});if(ok)setSceneryEdit(undefined);return ok;}}
            onMove={()=>{setMovingScenery(sceneryEdit);setSceneryEdit(undefined);switchTool('scenery');}} />
        </GuardedDialog>,document.body)}
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
