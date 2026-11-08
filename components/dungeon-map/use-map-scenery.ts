'use client';

import { useState } from 'react';
import { useCatalog } from '../catalog-provider';
import type { SceneryBrush } from '../scenery/palette';
import { findSceneryEntry } from '../../lib/scenery-catalog';
import {
  proposeScenery,
  sceneryFillStamp,
  type SceneryFillOptions,
  type ScenerySuggestion,
} from '../../lib/scenery-fill';
import type { Scenery } from '../../lib/scenery';
import type { Dungeon, Point } from '../../lib/dungeon';
import type { ExplorationView } from '../../lib/exploration';
import type { MapNoteView } from '../../lib/map-notes';
import type { MonsterView } from '../../lib/monsters';
import type { Marker } from './model';

type MapAction = (
  action: string,
  values: Record<string, unknown>,
) => Promise<boolean | undefined>;
type SendMap = (values: Record<string, unknown>) => Promise<void>;
type Selection = { item: Scenery; levelId: string };
type Proposal = {
  levelId: string;
  stamp: string;
  options: SceneryFillOptions;
  items: ScenerySuggestion[];
  requestId: string;
};
type Options = {
  map: Dungeon;
  members: Marker[];
  exploration?: ExplorationView;
  notes: MapNoteView[];
  monsters: MonsterView[];
  onAction: MapAction;
};

export function useMapScenery({
  map,
  members,
  exploration,
  notes,
  monsters,
  onAction,
}: Options) {
  const { scenery: catalogScenery } = useCatalog();
  const levelId = exploration?.levelId || 'ground';
  const [brush, setBrush] = useState<SceneryBrush>({
    kind: 'crate',
    rotation: 0,
    size: 'medium',
    hidden: false,
  });
  const [surfaceOp, setSurfaceOp] = useState<'add' | 'remove'>('add');
  const [editing, setEditing] = useState<Selection>();
  const [moving, setMoving] = useState<Selection>();
  const [proposal, setProposal] = useState<Proposal>();
  const surfaceBrush =
    findSceneryEntry(brush.kind, catalogScenery)?.surface && !moving
      ? { kind: brush.kind, op: surfaceOp, hidden: Boolean(brush.hidden) }
      : undefined;
  const blocked = [
    ...new Set([
      ...(exploration?.stairs ?? []).map((item) => `${item.x},${item.y}`),
      ...notes.map((item) => `${item.x},${item.y}`),
      ...monsters
        .filter((item) => !item.archived && item.x !== null && item.y !== null)
        .map((item) => `${item.x},${item.y}`),
      ...members
        .filter(
          (item) =>
            item.role === 'player' &&
            (!exploration?.location ||
              exploration.location.levelId === exploration.levelId),
        )
        .map((item) => `${item.x},${item.y}`),
      ...(exploration?.location?.levelId === exploration?.levelId &&
      exploration?.location
        ? [`${exploration.location.x},${exploration.location.y}`]
        : []),
    ]),
  ];
  const stamp = sceneryFillStamp(map, blocked, catalogScenery);
  const proposalStale = Boolean(
    proposal && (proposal.levelId !== levelId || proposal.stamp !== stamp),
  );

  function click(point: Point, id: string | undefined, sendMap: SendMap) {
    if (moving) {
      if (moving.levelId !== levelId) {
        setMoving(undefined);
        return;
      }
      void sendMap({
        tool: 'scenery',
        op: 'save',
        ...moving.item,
        sceneryId: moving.item.id,
        expectedRevision: moving.item.revision ?? 0,
        x: point[0],
        y: point[1],
      });
      setMoving(undefined);
    } else if (id) {
      const item = map.scenery?.find((item) => item.id === id);
      if (item) setEditing({ item: structuredClone(item), levelId });
    } else {
      void sendMap({
        tool: 'scenery',
        op: 'save',
        ...brush,
        note: '',
        expectedRevision: null,
        x: point[0],
        y: point[1],
      });
    }
  }

  function changeBrush(next: SceneryBrush) {
    setBrush(next);
    if (findSceneryEntry(next.kind, catalogScenery)?.surface)
      setProposal(undefined);
  }

  function previewFill(options: SceneryFillOptions) {
    setProposal({
      levelId,
      stamp,
      options,
      items: proposeScenery(map, blocked, options, catalogScenery),
      requestId: crypto.randomUUID(),
    });
  }

  async function applyFill() {
    if (!proposal || proposalStale) return;
    const ok = await onAction('map', {
      tool: 'scenery-fill',
      levelId: proposal.levelId,
      options: proposal.options,
      expectedStamp: proposal.stamp,
      requestId: proposal.requestId,
    });
    if (ok) setProposal(undefined);
    return ok;
  }

  async function save(values: Record<string, unknown>, op: 'save' | 'remove') {
    if (!editing) return;
    const ok = await onAction('map', {
      ...values,
      tool: 'scenery',
      op,
      levelId: editing.levelId,
    });
    if (ok) setEditing(undefined);
    return ok;
  }

  return {
    brush,
    changeBrush,
    surfaceOp,
    setSurfaceOp,
    surfaceBrush,
    editing,
    levelId,
    moving: Boolean(moving && moving.levelId === levelId),
    fillBusy: Boolean(moving),
    proposal,
    proposalStale,
    previewFill,
    applyFill,
    click,
    discardFill: () => setProposal(undefined),
    cancelMove: () => setMoving(undefined),
    closeEditor: () => setEditing(undefined),
    beginMove: () => {
      setMoving(editing);
      setEditing(undefined);
    },
    save: (values: Record<string, unknown>) => save(values, 'save'),
    remove: (values: Record<string, unknown>) => save(values, 'remove'),
  };
}

export type MapSceneryController = ReturnType<typeof useMapScenery>;
