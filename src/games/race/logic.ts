import { NUMBERS, PICTURES, type Word } from '../snake/logic';
import { int, pick, shuffle, type Rng } from '../common/rng';

/**
 * «Гонка слов»: rules without Phaser, so they can be tested.
 * The voice says an English word, word boards stand across the lanes, one per
 * lane: drive into the right one. A wrong board (or a cone) is a crash; three
 * crashes send the car to the pit stop, where the child does ten squats while
 * the mechanic repairs it.
 */

export const ROWS_PER_RACE = 12;
export const CRASHES_TO_PIT = 3;
export const SQUATS = 10;
/** The pit stop lasts two minutes whatever happens. */
export const PIT_MS = 2 * 60 * 1000;

/** Correct words → stars: 10 and more = 3, 7 = 2, 5 = 1. */
export function starsFor(correct: number): 0 | 1 | 2 | 3 {
  if (correct >= 10) return 3;
  if (correct >= 7) return 2;
  if (correct >= 5) return 1;
  return 0;
}

export type CarId = 'red' | 'blue' | 'yellow' | 'green';
export type CarShape = 'formula' | 'super' | 'rally' | 'buggy';
export interface Car {
  id: CarId;
  name: string;
  shape: CarShape;
  body: string;
  dark: string;
  number: number;
}

export const CARS: readonly Car[] = [
  { id: 'red', name: 'Молния', shape: 'formula', body: '#e63946', dark: '#9d0208', number: 7 },
  { id: 'blue', name: 'Комета', shape: 'super', body: '#3a86ff', dark: '#1d3f8f', number: 3 },
  { id: 'yellow', name: 'Шмель', shape: 'rally', body: '#ffbe0b', dark: '#b07d00', number: 5 },
  { id: 'green', name: 'Ящерка', shape: 'buggy', body: '#38b000', dark: '#1b5e20', number: 9 },
];

export const carLine = (id: CarId) => `car.${id}`;

export type Pool = 'easy' | 'all' | 'mix';
export interface Track {
  name: string;
  /** Sky and light: day, sunset, night. */
  time: 'day' | 'sunset' | 'night';
  lanes: 3 | 4;
  pool: Pool;
  /** Distractors from the same group (fruit among fruit): harder to tell apart. */
  sameGroup: boolean;
  /** Traffic cones between the word rows. */
  cones: boolean;
  /** Speed limits, road units per second; the car starts at min. */
  minSpeed: number;
  maxSpeed: number;
}

export const TRACKS: readonly Track[] = [
  { name: 'Утренний город', time: 'day', lanes: 3, pool: 'easy', sameGroup: false, cones: false, minSpeed: 6, maxSpeed: 16 },
  { name: 'Шоссе на закате', time: 'sunset', lanes: 3, pool: 'all', sameGroup: true, cones: true, minSpeed: 8, maxSpeed: 19 },
  { name: 'Ночные огни', time: 'night', lanes: 4, pool: 'mix', sameGroup: true, cones: true, minSpeed: 9, maxSpeed: 22 },
];

const EASY_IDS = ['apple', 'banana', 'orange', 'cat', 'dog', 'fish', 'bird', 'cow', 'pig', 'duck', 'frog', 'sun', 'star', 'ball', 'car', 'house', 'tree', 'cake', 'egg', 'boat', 'bear', 'lion'];
const SMALL_NUMBERS = NUMBERS.filter((w) => Number(w.id.slice(1)) <= 20);

export function poolOf(pool: Pool): readonly Word[] {
  if (pool === 'easy') return PICTURES.filter((w) => EASY_IDS.includes(w.id));
  if (pool === 'all') return PICTURES;
  return [...PICTURES, ...SMALL_NUMBERS];
}

export interface Row {
  target: string;
  /** One word per lane, left to right; the target is in exactly one of them. */
  lanes: string[];
  /** Lanes with a cone in the gap before this row (never all of them). */
  cones: number[];
}

/**
 * The words of one race: ROWS_PER_RACE targets, words the child knows worse
 * first (misses per word from earlier races), never the same word twice in a row.
 */
export function planRace(track: Track, rng: Rng, misses: Record<string, number> = {}): Row[] {
  const pool = poolOf(track.pool);
  const ranked = shuffle(rng, pool).sort((a, b) => (misses[b.id] ?? 0) - (misses[a.id] ?? 0));
  // Half the race from the weak words, the rest at random.
  const weak = ranked.slice(0, Math.min(4, ranked.length)).filter((w) => (misses[w.id] ?? 0) > 0);
  const targets: Word[] = [];
  for (let tries = 0; targets.length < ROWS_PER_RACE && tries < 1000; tries++) {
    const freshWeak = weak.filter((w) => !targets.includes(w));
    const from = targets.length % 2 === 0 && freshWeak.length ? freshWeak : pool;
    const w = pick(rng, from);
    if (targets.at(-1)?.id === w.id) continue;
    if (targets.includes(w) && pool.length > ROWS_PER_RACE && tries < 500) continue;
    targets.push(w);
  }
  return targets.map((t, i) => {
    const lanes = rowLanes(t, pool, track, rng);
    let cones: number[] = [];
    if (track.cones && i > 0 && rng() < 0.6) {
      const n = int(rng, 1, track.lanes - 2);
      cones = shuffle(rng, Array.from({ length: track.lanes }, (_, k) => k)).slice(0, n).sort();
    }
    return { target: t.id, lanes, cones };
  });
}

function rowLanes(target: Word, pool: readonly Word[], track: Track, rng: Rng): string[] {
  const others = pool.filter((w) => w.id !== target.id);
  const same = others.filter((w) => w.cat === target.cat);
  const near = track.sameGroup && same.length >= track.lanes - 1 ? same : others.filter((w) => w.cat !== target.cat);
  const wrong = shuffle(rng, near.length >= track.lanes - 1 ? near : others).slice(0, track.lanes - 1);
  return shuffle(rng, [target, ...wrong]).map((w) => w.id);
}

/** Saved between visits. */
export interface Progress {
  car: CarId;
  /** Best stars per track. */
  stars: number[];
  /** Times each word was missed (crashed into the wrong board instead). */
  misses: Record<string, number>;
}

export const freshProgress = (): Progress => ({ car: 'red', stars: TRACKS.map(() => 0), misses: {} });

export function parseProgress(raw: unknown): Progress {
  const p = (raw ?? {}) as Partial<Progress>;
  const car = CARS.some((c) => c.id === p.car) ? p.car! : 'red';
  const stars = TRACKS.map((_, i) => {
    const s: unknown = Array.isArray(p.stars) ? p.stars[i] : 0;
    return typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= 3 ? s : 0;
  });
  const misses: Record<string, number> = {};
  if (p.misses && typeof p.misses === 'object') {
    for (const [k, v] of Object.entries(p.misses)) if (Number.isInteger(v) && v > 0) misses[k] = Math.min(v, 20);
  }
  return { car, stars, misses };
}

/** A track opens once the one before it has at least one star. */
export const unlocked = (p: Progress, track: number) => track === 0 || (p.stars[track - 1] ?? 0) > 0;

/** After a race: keep the best stars, count misses, forget words that went well. */
export function recordRace(p: Progress, track: number, correct: number, hits: string[], missed: string[]): Progress {
  const stars = [...p.stars];
  stars[track] = Math.max(stars[track] ?? 0, starsFor(correct));
  const misses = { ...p.misses };
  for (const id of missed) misses[id] = Math.min((misses[id] ?? 0) + 1, 20);
  for (const id of hits) {
    if (misses[id] === undefined) continue;
    if (misses[id]! <= 1) delete misses[id];
    else misses[id]!--;
  }
  return { ...p, stars, misses };
}

/** English lines of this game (besides the words and numbers Snake already has). */
export function englishLines(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of CARS) out[carLine(c.id)] = `The ${c.id} car!`;
  out['race.go'] = 'Go!';
  out['race.great'] = 'Great!';
  out['race.yes'] = 'Yes!';
  out['race.welldone'] = 'Well done!';
  out['race.finish'] = 'Finish!';
  out['race.squat'] = 'Squat!';
  return out;
}

export const PRAISE_LINES = ['race.great', 'race.yes', 'race.welldone', 'goodjob'];
