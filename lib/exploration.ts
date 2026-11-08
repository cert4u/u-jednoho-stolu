// Stable entry point; keep callers independent of the internal module layout.
export type {
  Location,
  Level,
  Stair,
  BattlePositioning,
  Atlas,
  ExplorationView,
} from './exploration/model';
export { ensureAtlas, getLevel } from './exploration/atlas';
export { between, sight } from './exploration/geometry';
export { remember } from './exploration/memory';
export { activeLightSources, refreshSight } from './exploration/visibility';
export { explorationView } from './exploration/view';
export { explorationAction } from './exploration/actions';
