import { int, pick, shuffle, type Rng } from '../common/rng';

/**
 * «Порванная карта»: put a torn treasure map back together (pieces have to be
 * turned at higher levels), then sail it by English compass words.
 * Puzzles and mental rotation train spatial skills, which do transfer and go
 * with later math (Uttal et al., 2013; Levine et al., 2012); spatial words in
 * talk support spatial thinking (Pruden, Levine & Huttenlocher, 2011).
 */

export interface PuzzleSpec {
  cols: number;
  rows: number;
  rotate: boolean;
  /** Steps of the compass route after the map is whole. */
  steps: number;
}

export const LEVELS: Record<number, PuzzleSpec> = {
  1: { cols: 2, rows: 2, rotate: false, steps: 3 },
  2: { cols: 2, rows: 2, rotate: true, steps: 4 },
  3: { cols: 3, rows: 2, rotate: true, steps: 5 },
  4: { cols: 3, rows: 3, rotate: true, steps: 6 },
};
export const MAX_LEVEL = 4;

export interface Piece {
  /** Index in the grid, row-major. */
  index: number;
  /** Starting turn, in quarter turns clockwise (0 = upright). */
  turns: number;
}

export function planPieces(level: number, rng: Rng): Piece[] {
  const s = LEVELS[level]!;
  const n = s.cols * s.rows;
  const pieces = shuffle(rng, Array.from({ length: n }, (_, index) => ({ index, turns: s.rotate ? int(rng, 0, 3) : 0 })));
  // With rotation on, at least half the pieces start turned.
  if (s.rotate) {
    const upright = pieces.filter((p) => p.turns === 0);
    for (const p of upright.slice(0, Math.max(0, upright.length - Math.floor(n / 2)))) p.turns = int(rng, 1, 3);
  }
  return pieces;
}

export type Compass = 'north' | 'south' | 'east' | 'west';
export const COMPASS: readonly Compass[] = ['north', 'east', 'south', 'west'];
export const STEP: Record<Compass, { x: number; y: number }> = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };
export const dirLine = (d: Compass) => `dir.${d}`;

export interface Route {
  start: { x: number; y: number };
  steps: Compass[];
}

/** A route of `n` steps on a size×size grid that never leaves it or crosses itself. */
export function planRoute(rng: Rng, n: number, size = 6): Route {
  for (;;) {
    const start = { x: int(rng, 0, size - 1), y: int(rng, 0, size - 1) };
    const seen = new Set([`${start.x},${start.y}`]);
    let { x, y } = start;
    const steps: Compass[] = [];
    for (let i = 0; i < n; i++) {
      const ok = COMPASS.filter((d) => {
        const nx = x + STEP[d].x;
        const ny = y + STEP[d].y;
        return nx >= 0 && ny >= 0 && nx < size && ny < size && !seen.has(`${nx},${ny}`);
      });
      if (!ok.length) break;
      const d = pick(rng, ok);
      x += STEP[d].x;
      y += STEP[d].y;
      seen.add(`${x},${y}`);
      steps.push(d);
    }
    if (steps.length === n) return { start, steps };
  }
}

export function endOf(r: Route) {
  return r.steps.reduce((p, d) => ({ x: p.x + STEP[d].x, y: p.y + STEP[d].y }), r.start);
}
