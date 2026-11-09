import { cellKey } from './dungeon';
import type {
  GeneratedDungeon,
  GeneratedFloor,
  GeneratorOptions,
} from './generator-types';
import { validateGeneratedFloor } from './generator-validation';
import { buildCandidateFloor } from './generator-v2/floor';
import { point } from './generator-v2/primitives';

export { seededRandom } from './generator-v2/primitives';
export { QUALITY_WEIGHTS } from './generator-v2/quality';

// Changing the PRNG, candidate count or weights changes V2 output: version them together.
export const V2_CANDIDATES = 6;

export function generateDungeonV2(options: GeneratorOptions): GeneratedDungeon {
  const floors: GeneratedFloor[] = [];
  for (let level = 0; level < options.levels; level++) {
    let best: GeneratedFloor | undefined;
    for (let candidate = 0; candidate < V2_CANDIDATES; candidate++) {
      try {
        const next = buildCandidateFloor(options, level, candidate);
        if (
          !best ||
          next.map.generation!.metrics.score >
            best.map.generation!.metrics.score
        )
          best = next;
      } catch {
        /* Deterministic bounded rejection; no invalid candidate is returned. */
      }
    }
    if (!best)
      throw Error(
        'Tuto konfiguraci nelze bezpečně vytvořit. Zkus méně místností, menší velikost nebo jinou variantu.',
      );
    floors.push(best);
  }
  const stairs: GeneratedDungeon['stairs'] = [];
  for (let i = 0; i < floors.length - 1; i++) {
    const from = floors[i].map.generation!,
      to = floors[i + 1].map.generation!,
      a = from.rooms.find((r) => r.id === from.goalRoomId)!.center,
      b = to.rooms[0].center;
    floors[i].map.stairMarks![cellKey(...a)] = 'down';
    floors[i + 1].map.stairMarks![cellKey(...b)] = 'up';
    stairs.push({ from: i, to: i + 1, a: [...a], b: [...b] });
  }
  const entry = floors[0].map.generation!.rooms[0].center;
  floors[0].map.access = { entrance: [...entry] };
  if (options.separateExit) {
    const meta = floors[0].map.generation!,
      goal = meta.rooms.find((r) => r.id === meta.goalRoomId)!,
      choices = goal.cells.filter(
        (key) => !floors[0].map.stairMarks?.[key] && key !== cellKey(...entry),
      );
    choices.sort((a, b) => {
      const p = point(a),
        q = point(b);
      return (
        Math.abs(q[0] - entry[0]) +
        Math.abs(q[1] - entry[1]) -
        (Math.abs(p[0] - entry[0]) + Math.abs(p[1] - entry[1]))
      );
    });
    floors[0].map.access.exit = point(choices[0]);
  }
  for (const floor of floors)
    validateGeneratedFloor(floor.map, floor.map.generation!);
  return { options, floors, stairs, entry: [...entry] };
}
