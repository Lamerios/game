import { int, pick, shuffle, type Rng } from '../common/rng';
import { KINDS } from '../note/vocab';

/**
 * Action stages: objects drift across the sea and the child "catches" them by
 * tapping. Each one trains a skill the way the evidence suggests for 5–7-year-olds:
 *
 * - Gulls (reading): build a picture's word letter by letter into boxes, one box
 *   per sound — D. B. Elkonin's sound-analysis boxes with letters (phonemic
 *   awareness + letter–sound mapping, the strongest early-reading predictors).
 * - Barrels (math): load exactly N into a ten-frame hold. Composing a number from
 *   parts and counting on from what is already there (part–whole thinking;
 *   ten-frames make the quantity visible at a glance).
 * - Buoys (algo / logic): continue a repeating or growing pattern. Early
 *   patterning is a predictor of later math and is trainable (Rittle-Johnson et al.).
 *
 * Nothing punishes slowness: a missed object simply drifts by again.
 */

// ---------- gulls: letters ----------

export const GULLS_MAX_LEVEL = 7;

/** Pairs a child of this age confuses by ear: distractors on higher levels. */
const SIMILAR: Record<string, string[]> = {
  Б: ['П'], П: ['Б'], Д: ['Т'], Т: ['Д'], Г: ['К'], К: ['Г'], З: ['С'], С: ['З', 'Ш'], Ш: ['С', 'Ж'], Ж: ['Ш'],
  В: ['Ф'], Ф: ['В'], М: ['Н'], Н: ['М'], Р: ['Л'], Л: ['Р'], А: ['Я'], Я: ['А'], О: ['У'], У: ['О'], Ч: ['Щ'], Е: ['И'], И: ['Ы'], Ь: ['Ъ'],
};
const ALPHABET = [...'АБВГДЕИКЛМНОПРСТУФХЧШЫЯ'];

export interface GullsTask {
  level: number;
  /** Words to build, in order (KINDS ids; the picture is `obj-<id>`). */
  words: { id: string; word: string }[];
  /** Letters already in the boxes at the start (L1: the first one). */
  prefilled: number;
  /** Whether the word is said aloud at the start; from L5 the child names the picture themself. */
  sayWord: boolean;
  /** Letters that are not in the word, flying with the right ones. */
  distractors: string[][];
  /** Seconds a gull takes to cross the screen. */
  crossSec: number;
  itemId: string;
}

const byLen = (min: number, max: number) => KINDS.filter((k) => k.nom.length >= min && k.nom.length <= max && !k.nom.includes('ь'));

export function generateGulls(level: number, rng: Rng): GullsTask {
  const lvl = Math.min(GULLS_MAX_LEVEL, Math.max(1, level));
  const pool =
    lvl <= 2 ? byLen(4, 5) : lvl <= 4 ? byLen(4, 6) : KINDS;
  const count = lvl <= 2 ? 2 : 1;
  const kinds = shuffle(rng, pool).slice(0, count);
  const words = kinds.map((k) => ({ id: k.id, word: k.nom.toUpperCase() }));
  const nDistract = lvl <= 2 ? 2 : lvl <= 4 ? 3 : 4;
  const distractors = words.map(({ word }) => {
    const inWord = new Set(word);
    const similar = lvl >= 4 ? shuffle(rng, [...inWord].flatMap((l) => SIMILAR[l] ?? []).filter((l) => !inWord.has(l))) : [];
    const far = shuffle(rng, ALPHABET.filter((l) => !inWord.has(l) && !similar.includes(l)));
    return [...new Set([...similar.slice(0, 2), ...far])].slice(0, nDistract);
  });
  return {
    level: lvl,
    words,
    prefilled: lvl === 1 ? 1 : 0,
    sayWord: lvl <= 4,
    distractors,
    crossSec: lvl <= 2 ? 11 : lvl <= 5 ? 9 : 7.5,
    itemId: `gulls${lvl}-${words.map((w) => w.id).join('-')}`,
  };
}

/**
 * Letter for the next gull: the needed one about every other gull (always, if
 * none is in the air), else a distractor or another letter of the word.
 */
export function nextGullLetter(rng: Rng, word: string, pos: number, distractors: string[], neededInAir: boolean): string {
  const need = word[pos]!;
  const r = rng();
  if (!neededInAir || r < 0.45) return need;
  const others = [...word].filter((l, i) => i > pos && l !== need);
  if (others.length && r < 0.65) return pick(rng, others);
  return pick(rng, distractors.length ? distractors : ALPHABET.filter((l) => l !== need));
}

// ---------- barrels: exactly N ----------

export const BARRELS_MAX_LEVEL = 7;

export interface BarrelsTask {
  level: number;
  /** Targets, one per round. */
  targets: number[];
  /** Values the barrels can carry. From L5 there are tens (10, 20, 30) for numbers up to 100. */
  values: number[];
  /** Barrels show dots (subitising, counting) instead of digits. */
  dots: boolean;
  /** Hold drawn as a hundred square (10×10) instead of ten-frames. */
  hundred: boolean;
  crossSec: number;
  itemId: string;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/**
 * Up to 20: ten-frames, composing small numbers. From L5 up to 100: tens and
 * ones, so 47 is made as 10 + 10 + 10 + 10 + 7 or 20 + 20 + 7 (place value).
 */
export function generateBarrels(level: number, rng: Rng): BarrelsTask {
  const lvl = Math.min(BARRELS_MAX_LEVEL, Math.max(1, level));
  const spec: [number, number, number[]][] = [
    // target min, target max, barrel values
    [3, 5, [1]],
    [5, 8, [1, 2]],
    [6, 10, [1, 2, 3]],
    [10, 20, range(2, 6)],
    [20, 50, [...range(2, 9), 10]],
    [30, 80, [...range(3, 9), 10, 20]],
    [50, 100, [...range(1, 9), 10, 20, 30]],
  ];
  const [tMin, tMax, values] = spec[lvl - 1]!;
  const targets = [int(rng, tMin, tMax), int(rng, tMin, tMax)];
  return {
    level: lvl,
    targets,
    values,
    dots: lvl <= 3,
    hundred: tMax > 20,
    crossSec: lvl <= 2 ? 10 : lvl <= 4 ? 8.5 : 8,
    itemId: `barrels${lvl}-${targets.join('-')}`,
  };
}

/**
 * Value of the next barrel. Keeps the round solvable: if no barrel in the air
 * fits what is left, the next one does; near the end the exact remainder shows
 * up often; while a lot is left, tens come more often.
 */
export function nextBarrel(rng: Rng, t: BarrelsTask, left: number, inAir: number[]): number {
  const fits = inAir.some((v) => v <= left);
  const ok = t.values.filter((v) => v <= left);
  if (t.values.includes(left) && rng() < 0.4) return left;
  if (!ok.length) return left; // smaller than any regular barrel: a small one comes
  const tens = ok.filter((v) => v >= 10);
  if (tens.length && left >= 20 && rng() < 0.5) return pick(rng, tens);
  if (!fits || rng() < 0.6) return pick(rng, ok);
  return pick(rng, t.values);
}

// ---------- buoys: patterns ----------

export const BUOYS_MAX_LEVEL = 6;
export const BUOY_COLORS = ['red', 'blue', 'yellow', 'green'] as const;
export const BUOY_SHAPES = ['round', 'cone', 'can'] as const;
export type BuoyColor = (typeof BUOY_COLORS)[number];
export type BuoyShape = (typeof BUOY_SHAPES)[number];

export interface Buoy {
  color: BuoyColor;
  shape: BuoyShape;
  /** Dots on the buoy (growing patterns). */
  dots?: number;
}

export interface PatternRound {
  /** The row; `gap` is where the "?" stands. */
  row: Buoy[];
  gap: number;
  /** Length of the repeating unit (0 for growing patterns), for the hint bracket. */
  unit: number;
  options: Buoy[];
  answer: number;
}

export interface BuoysTask {
  level: number;
  rounds: PatternRound[];
  crossSec: number;
  itemId: string;
}

export const sameBuoy = (a: Buoy, b: Buoy) => a.color === b.color && a.shape === b.shape && (a.dots ?? 0) === (b.dots ?? 0);
export const buoyKey = (b: Buoy) => `${b.color}-${b.shape}${b.dots ? `-${b.dots}` : ''}`;

const UNITS: Record<number, string[]> = {
  1: ['AB'],
  2: ['AAB', 'ABB'],
  3: ['ABC', 'AAB', 'ABB'],
  4: ['AABB', 'ABCC', 'AABC', 'ABAC'],
  5: ['ABC', 'AABB', 'ABCC'],
  6: ['ABC', 'AABB', 'ABCC', 'AAB'],
};

function letters(rng: Rng, level: number): Record<string, Buoy> {
  const colors = shuffle(rng, BUOY_COLORS);
  const shapes = shuffle(rng, BUOY_SHAPES);
  // L1–2: colours only; from L3 shape changes together with colour, from L4 shape alone may differ.
  const byShape = level >= 4 && rng() < 0.5;
  const out: Record<string, Buoy> = {};
  ['A', 'B', 'C'].forEach((k, i) => {
    out[k] = byShape
      ? { color: colors[0]!, shape: shapes[i]! }
      : { color: colors[i]!, shape: level >= 3 ? shapes[i]! : 'round' };
  });
  return out;
}

function options(rng: Rng, answer: Buoy, pool: Buoy[]): { options: Buoy[]; answer: number } {
  const opts = [answer];
  for (const b of shuffle(rng, pool)) {
    if (opts.length >= 3) break;
    if (!opts.some((o) => sameBuoy(o, b))) opts.push(b);
  }
  // Pattern with two kinds only: the third option is a new buoy.
  while (opts.length < 3) {
    const extra: Buoy = { color: pick(rng, BUOY_COLORS), shape: pick(rng, BUOY_SHAPES), dots: answer.dots };
    if (!opts.some((o) => sameBuoy(o, extra))) opts.push(extra);
  }
  const sorted = shuffle(rng, opts);
  return { options: sorted, answer: sorted.findIndex((o) => sameBuoy(o, answer)) };
}

function repeatingRound(rng: Rng, level: number): PatternRound {
  const unit = pick(rng, UNITS[level]!);
  const map = letters(rng, level);
  const len = Math.max(6, unit.length * 2 + 1);
  const row = Array.from({ length: len + 1 }, (_, i) => map[unit[i % unit.length]!]!);
  // L6: the gap can be in the middle of the row.
  const gap = level >= 6 && rng() < 0.6 ? int(rng, unit.length, len - 1) : len;
  const used = [...new Set(unit)].map((k) => map[k]!);
  const o = options(rng, row[gap]!, used);
  return { row: row.slice(0, Math.max(gap + 1, len)), gap, unit: unit.length, ...o };
}

function growingRound(rng: Rng): PatternRound {
  const step = pick(rng, [1, 1, 2]);
  const start = step === 1 ? int(rng, 1, 2) : 1;
  const color = pick(rng, BUOY_COLORS);
  const row: Buoy[] = Array.from({ length: 5 }, (_, i) => ({ color, shape: 'round', dots: start + i * step }));
  const answer = row[4]!;
  const pool: Buoy[] = [answer.dots! - step, answer.dots! + 1, answer.dots! + step + 1]
    .filter((d) => d > 0 && d !== answer.dots && d <= 10)
    .map((d) => ({ color, shape: 'round', dots: d }));
  const o = options(rng, answer, pool);
  return { row, gap: 4, unit: 0, ...o };
}

export function generateBuoys(level: number, rng: Rng): BuoysTask {
  const lvl = Math.min(BUOYS_MAX_LEVEL, Math.max(1, level));
  const rounds = Array.from({ length: 3 }, (_, i) => (lvl >= 5 && i === 1 ? growingRound(rng) : repeatingRound(rng, lvl)));
  return {
    level: lvl,
    rounds,
    crossSec: lvl <= 2 ? 11 : 9,
    itemId: `buoys${lvl}-${rounds.map((r) => (r.unit ? `u${r.unit}` : 'grow')).join('-')}`,
  };
}

// ---------- which stage when ----------

export type SeaGame = 'Barrels' | 'Buoys' | 'Gulls';
export const SEA_SKILL = { Barrels: 'math', Buoys: 'algo', Gulls: 'reading' } as const;
const ROTATION: SeaGame[] = ['Barrels', 'Buoys', 'Gulls'];

/**
 * The action stage of an episode, played on the way after the crossing.
 * Rotates through the three, skipping the island's own focus skill (that one
 * has enough tasks already).
 */
export function seaGame(episode: number, focus?: string): SeaGame {
  for (let i = 0; i < ROTATION.length; i++) {
    const g = ROTATION[(episode + i) % ROTATION.length]!;
    if (SEA_SKILL[g] !== focus) return g;
  }
  return ROTATION[0]!;
}
