import type { Game } from '../game';
import type { Dungeon } from '../dungeon';
import { sceneryCatalog, type SceneryDefinition } from '../scenery-catalog';
import { CatalogResolver } from './resolver';

// Pure catalog projection: no database bindings, filesystem or runtime loading.
export function resolvedScenery(library?: CatalogResolver): SceneryDefinition[] {
  return library
    ? library.list('scenery').map(row => ({ ...row.data, kind: row.ref }))
    : sceneryCatalog;
}

/** Read only pinned visual data in normal polling; never ship the private library. */
export function campaignVisuals(game: Game, map: Dungeon) {
  const used = new Set([
    ...(map.scenery ?? []).map(item => item.kind),
    ...(map.surfaces ?? []).map(item => item.kind),
  ]);
  if (!game.contentLibrary) return [];
  return resolvedScenery(new CatalogResolver([], game.contentLibrary))
    .filter(entry => used.has(entry.id));
}
