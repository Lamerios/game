import { int, shuffle, type Rng } from '../common/rng';

/**
 * «Якорь»: number-line estimation. The captain names a depth in English
 * ("Drop the anchor at seven!") and the child taps where it is on a line that
 * only has its ends marked. The accuracy of such estimates predicts later math
 * and improves with practice and feedback (Siegler & Booth, 2004).
 */
export interface Scale {
  max: number;
  /** Targets are multiples of this (tens on the 0–100 line). */
  step: number;
  /** Marked points on the line besides the ends (a midpoint helps at first — Siegler & Opfer). */
  landmarks: number[];
  /** Rounds turned around: the anchor is down, which number is it? (position → number). */
  reverse: number;
}

/**
 * The ladder: a longer line first comes with landmark ticks, then without them,
 * then with "which number is here?" rounds mixed in. 0–20 → 0–30 → 0–40 → 0–100.
 */
export const LEVELS: Record<number, Scale> = {
  1: { max: 10, step: 1, landmarks: [], reverse: 0 },
  2: { max: 20, step: 1, landmarks: [10], reverse: 0 },
  3: { max: 20, step: 1, landmarks: [], reverse: 2 },
  4: { max: 30, step: 1, landmarks: [10, 20], reverse: 0 },
  5: { max: 30, step: 1, landmarks: [], reverse: 2 },
  6: { max: 40, step: 1, landmarks: [20], reverse: 0 },
  7: { max: 40, step: 1, landmarks: [], reverse: 2 },
  8: { max: 100, step: 10, landmarks: [50], reverse: 0 },
  9: { max: 100, step: 5, landmarks: [], reverse: 2 },
};
export const MAX_LEVEL = 9;
export const ROUNDS = 8;

/** Levels saved before the 20/30/40 ladder (v1: 1 = 0–10, 2 = 0–20, 3 = 0–100 by 10, 4 = by 5). */
export function migrateLevel(saved: { level?: unknown; v?: unknown }): number {
  const l = Number(saved.level);
  if (!(l >= 1)) return 1;
  if (saved.v === 2) return Math.min(MAX_LEVEL, Math.floor(l));
  return ({ 1: 1, 2: 3, 3: 8, 4: 9 } as Record<number, number>)[l] ?? 1;
}

export interface Round {
  target: number;
  kind: 'place' | 'name';
  /** For 'name' rounds: three numbers to choose from, the target among them. */
  options?: number[];
}

/** Targets of one game: no ends or landmarks (nothing to estimate), no repeats in a row. */
export function planTargets(level: number, rng: Rng, n = ROUNDS): number[] {
  const s = LEVELS[level]!;
  const out: number[] = [];
  while (out.length < n) {
    const k = int(rng, 1, s.max / s.step - 1) * s.step;
    if (k !== out.at(-1) && !s.landmarks.includes(k)) out.push(k);
  }
  return out;
}

/** Three numbers for a "which number?" round: the target and two others at least a sixth of the line away. */
export function nameOptions(target: number, s: Scale, rng: Rng): number[] {
  const gap = s.max / 6;
  const pool: number[] = [];
  for (let k = s.step; k < s.max; k += s.step) if (Math.abs(k - target) >= gap) pool.push(k);
  const picked: number[] = [];
  for (const k of shuffle(rng, pool)) {
    if (picked.every((p) => Math.abs(p - k) >= gap)) picked.push(k);
    if (picked.length === 2) break;
  }
  return shuffle(rng, [target, ...picked]);
}

/** One game: placing rounds, with the reverse rounds at the 4th and 7th places. */
export function planRounds(level: number, rng: Rng, n = ROUNDS): Round[] {
  const s = LEVELS[level]!;
  const at = [3, 6].slice(0, s.reverse);
  return planTargets(level, rng, n).map((target, i) =>
    at.includes(i) ? { target, kind: 'name', options: nameOptions(target, s, rng) } : { target, kind: 'place' },
  );
}

/** Percent absolute error, the standard number-line measure. */
export const pae = (target: number, guess: number, max: number) => (Math.abs(target - guess) / max) * 100;

export type Verdict = 'exact' | 'close' | 'far';
export function verdict(p: number): Verdict {
  return p <= 5 ? 'exact' : p <= 12 ? 'close' : 'far';
}

/** Mean error under 7 % → next level; over 18 % → back one. */
export function nextLevel(level: number, meanPae: number): number {
  if (meanPae < 7) return Math.min(MAX_LEVEL, level + 1);
  if (meanPae > 18) return Math.max(1, level - 1);
  return level;
}

export const numberWord = (n: number) => `n${n}`;
