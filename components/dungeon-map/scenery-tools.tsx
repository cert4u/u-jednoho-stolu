'use client';

import { createPortal } from 'react-dom';
import type { Dungeon } from '../../lib/dungeon';
import SceneryPalette from '../scenery/palette';
import SceneryEditor from '../scenery/editor';
import GuardedDialog from '../guarded-dialog';
import type { MapSceneryController } from './use-map-scenery';

type Props = { scenery: MapSceneryController; busy: boolean };

export function MapSceneryPalette({ scenery, busy }: Props) {
  return (
    <SceneryPalette
      surfaceOp={scenery.surfaceOp}
      onSurfaceOp={scenery.setSurfaceOp}
      brush={scenery.brush}
      onChange={scenery.changeBrush}
      moving={scenery.moving}
      onCancelMove={scenery.cancelMove}
      fill={{
        busy: busy || scenery.fillBusy,
        hidden: Boolean(scenery.brush.hidden),
        proposal: scenery.proposal
          ? {
              options: scenery.proposal.options,
              count: scenery.proposal.items.length,
              stale: scenery.proposalStale,
            }
          : undefined,
        onDiscard: scenery.discardFill,
        onPreview: scenery.previewFill,
        onApply: scenery.applyFill,
      }}
    />
  );
}

export function MapSceneryDialog({
  scenery,
  busy,
  map,
  onMove,
}: Props & { map: Dungeon; onMove: () => void }) {
  const selection = scenery.editing;
  if (!selection || selection.levelId !== scenery.levelId) return null;
  return createPortal(
    <GuardedDialog
      label="Stafáž mapy"
      className="modal scenery-modal"
      onClose={scenery.closeEditor}
    >
      <SceneryEditor
        key={selection.item.id}
        item={selection.item}
        current={map.scenery?.find((item) => item.id === selection.item.id)}
        busy={busy}
        onSave={scenery.save}
        onRemove={scenery.remove}
        onMove={() => {
          scenery.beginMove();
          onMove();
        }}
      />
    </GuardedDialog>,
    document.body,
  );
}
