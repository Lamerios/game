import { int, shuffle, type Rng } from '../common/rng';

export const HOLD_MAX_LEVEL = 6;

/**
 * Levels (SDD 3.2):
 * 1 — make N ≤ 10 from two cargo pieces
 * 2 — make N ≤ 10 from three pieces
 * 3 — make N ≤ 20, crossing ten
 * 4 — unload: hold has S, leave T
 * 5 — missing addend: was A, became B, how many loaded? (pick a number)
 * 6 — same as 5, numbers only, no grid
 */
export type HoldTask =
  | { kind: 'load'; level: number; target: number; capacity: number; cargo: number[]; showCounter: boolean; itemId: string }
  | { kind: 'unload'; level: number; start: number[]; leave: number; capacity: number; showCounter: boolean; itemId: string }
  | { kind: 'missing'; level: number; was: number; became: number; options: number[]; answer: number; showGrid: boolean; itemId: string };

/** Cargo set that contains at least one exact solution of `parts` pieces summing to `target`. */
function cargoFor(rng: Rng, target: number, parts: number, maxPiece: number, decoys: number): number[] {
  const solution: number[] = [];
  let left = target;
  for (let i = parts; i > 1; i--) {
    const hi = Math.min(maxPiece, left - (i - 1));
    const v = int(rng, 1, Math.max(1, hi));
    solution.push(v);
    left -= v;
  }
  solution.push(left);
  const extra = Array.from({ length: decoys }, () => int(rng, 1, maxPiece));
  return shuffle(rng, [...solution, ...extra]);
}

export function generateHold(level: number, rng: Rng): HoldTask {
  const lvl = Math.min(HOLD_MAX_LEVEL, Math.max(1, level));
  switch (lvl) {
    case 1: {
      const target = int(rng, 4, 10);
      const cargo = cargoFor(rng, target, 2, Math.min(9, target - 1), 2);
      return { kind: 'load', level: 1, target, capacity: 10, cargo, showCounter: true, itemId: `hold1-${target}` };
    }
    case 2: {
      const target = int(rng, 6, 10);
      const cargo = cargoFor(rng, target, 3, 6, 2);
      return { kind: 'load', level: 2, target, capacity: 10, cargo, showCounter: true, itemId: `hold2-${target}` };
    }
    case 3: {
      // Crossing ten: two pieces whose sum is 11..18, each ≤ 9.
      const a = int(rng, 3, 9);
      const b = int(rng, Math.max(2, 11 - a), 9);
      const target = a + b;
      const cargo = shuffle(rng, [a, b, int(rng, 1, 9), int(rng, 1, 9)]);
      return { kind: 'load', level: 3, target, capacity: 20, cargo, showCounter: false, itemId: `hold3-${a}+${b}` };
    }
    case 4: {
      const start = cargoFor(rng, int(rng, 9, 18), 3, 8, 0);
      const total = start.reduce((s, v) => s + v, 0);
      // Leave the sum of a non-empty proper subset, so unloading pieces can reach it.
      const keep = start.slice(0, int(rng, 1, start.length - 1));
      const leave = keep.reduce((s, v) => s + v, 0);
      return { kind: 'unload', level: 4, start, leave, capacity: 20, showCounter: false, itemId: `hold4-${total}-${leave}` };
    }
    default: {
      const was = int(rng, 3, 12);
      const answer = int(rng, 2, 20 - was);
      const became = was + answer;
      const options = shuffle(rng, [...new Set([answer, Math.max(1, answer - 1), answer + 1, became])].slice(0, 3));
      return { kind: 'missing', level: lvl, was, became, options, answer, showGrid: lvl === 5, itemId: `hold${lvl}-${was}-${became}` };
    }
  }
}

/** Every subset sum check used by the scene and by tests. */
export function canMake(pieces: readonly number[], target: number): boolean {
  let sums = new Set([0]);
  for (const p of pieces) sums = new Set([...sums, ...[...sums].map((s) => s + p)]);
  return sums.has(target);
}

/** Indices of one subset of `pieces` summing to `target`, or undefined. Used for hints. */
export function solve(pieces: readonly number[], target: number): number[] | undefined {
  const go = (i: number, left: number): number[] | undefined => {
    if (left === 0) return [];
    if (i >= pieces.length || left < 0) return undefined;
    const withIt = go(i + 1, left - pieces[i]!);
    if (withIt) return [i, ...withIt];
    return go(i + 1, left);
  };
  return go(0, target);
}
