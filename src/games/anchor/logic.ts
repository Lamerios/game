import { int, type Rng } from '../common/rng';

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
}

export const LEVELS: Record<number, Scale> = {
  1: { max: 10, step: 1 },
  2: { max: 20, step: 1 },
  3: { max: 100, step: 10 },
  4: { max: 100, step: 5 },
};
export const MAX_LEVEL = 4;
export const ROUNDS = 8;

/** Targets of one game: no ends (too easy), no repeats in a row. */
export function planTargets(level: number, rng: Rng, n = ROUNDS): number[] {
  const s = LEVELS[level]!;
  const out: number[] = [];
  while (out.length < n) {
    const k = int(rng, 1, s.max / s.step - 1) * s.step;
    if (k !== out.at(-1)) out.push(k);
  }
  return out;
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
