import {useCatalog} from '../catalog-provider';
import { findSceneryEntry } from '../../lib/scenery-catalog';
import type { SceneryKind } from '../../lib/scenery';

/** Plain validated SVG paths, never markup, images, scripts or external URLs. */
export default function SceneryGlyph({ kind }: { kind: SceneryKind }) {
  const {scenery}=useCatalog();
  const path = findSceneryEntry(kind,scenery)?.path ?? 'M5 5H27V27H5ZM12 11Q17 6 21 12Q22 16 16 18V21M16 24h.1';
  return <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
    <path d={path} strokeWidth=".5" opacity=".2" transform="translate(.35 .25)" />
  </g>;
}
