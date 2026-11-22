import { COLORS, NUMBERS, PICTURES, type Word } from '../snake/logic';
import { int, pick, shuffle, type Rng } from '../common/rng';

/**
 * «Гонка слов»: rules without Phaser, so they can be tested.
 * The voice says an English word, word boards stand across the lanes, one per
 * lane: drive into the right one. A wrong board (or a cone) is a crash; three
 * crashes send the car to the pit stop: ten squats, ten push-ups and a maze
 * while the mechanic repairs it. The plane tracks add a second height.
 */

export const ROWS_PER_RACE = 12;
export const CRASHES_TO_PIT = 3;
export const SQUATS = 10;

/** Correct words → stars: 10 and more = 3, 7 = 2, 5 = 1. */
export function starsFor(correct: number): 0 | 1 | 2 | 3 {
  if (correct >= 10) return 3;
  if (correct >= 7) return 2;
  if (correct >= 5) return 1;
  return 0;
}

export type CarId = string;
export type CarShape = 'formula' | 'super' | 'rally' | 'buggy';
export type Deco = 'none' | 'siren' | 'checker' | 'flames' | 'stars';
export interface Car {
  id: CarId;
  name: string;
  shape: CarShape;
  body: string;
  dark: string;
  number: number;
  deco?: Deco;
  /** What the English voice calls it. */
  en: string;
}

/** The first four are in the garage from the start; the rest come one by one for races without a mistake. */
export const CARS: readonly Car[] = [
  { id: 'red', name: 'Молния', shape: 'formula', body: '#e63946', dark: '#9d0208', number: 7, en: 'The red car!' },
  { id: 'blue', name: 'Комета', shape: 'super', body: '#3a86ff', dark: '#1d3f8f', number: 3, en: 'The blue car!' },
  { id: 'yellow', name: 'Шмель', shape: 'rally', body: '#ffbe0b', dark: '#b07d00', number: 5, en: 'The yellow car!' },
  { id: 'green', name: 'Ящерка', shape: 'buggy', body: '#38b000', dark: '#1b5e20', number: 9, en: 'The green car!' },
  { id: 'police', name: 'Патруль', shape: 'super', body: '#f8f9fa', dark: '#1d3557', number: 1, deco: 'siren', en: 'The police car!' },
  { id: 'taxi', name: 'Такси', shape: 'rally', body: '#ffd60a', dark: '#3d3d3d', number: 8, deco: 'checker', en: 'The taxi!' },
  { id: 'orange', name: 'Апельсин', shape: 'formula', body: '#fb8500', dark: '#9c4a00', number: 4, deco: 'flames', en: 'The orange car!' },
  { id: 'purple', name: 'Монстр', shape: 'buggy', body: '#7b2cbf', dark: '#3c096c', number: 6, deco: 'flames', en: 'The purple car!' },
  { id: 'pink', name: 'Фламинго', shape: 'super', body: '#ff8fab', dark: '#c9184a', number: 2, deco: 'stars', en: 'The pink car!' },
  { id: 'black', name: 'Ночь', shape: 'rally', body: '#343a40', dark: '#111111', number: 13, deco: 'flames', en: 'The black car!' },
  { id: 'silver', name: 'Ракета', shape: 'super', body: '#ced4da', dark: '#6c757d', number: 10, deco: 'stars', en: 'The silver car!' },
  { id: 'gold', name: 'Золото', shape: 'formula', body: '#ffc300', dark: '#b8860b', number: 1, deco: 'stars', en: 'The gold car!' },
];
export const STARTER_CARS: readonly CarId[] = CARS.slice(0, 4).map((c) => c.id);
export const carById = (id: CarId) => CARS.find((c) => c.id === id) ?? CARS[0]!;

export const carLine = (id: CarId) => `car.${id}`;

/** Planes: their own collection, won by flights without a mistake. Drawn by planeSvg from the same colours. */
export const PLANES: readonly Car[] = [
  { id: 'p-red', name: 'Ласточка', shape: 'super', body: '#e63946', dark: '#9d0208', number: 7, en: 'The red plane!' },
  { id: 'p-blue', name: 'Стриж', shape: 'super', body: '#3a86ff', dark: '#1d3f8f', number: 3, en: 'The blue plane!' },
  { id: 'p-white', name: 'Чайка', shape: 'super', body: '#f8f9fa', dark: '#1d3557', number: 1, en: 'The white plane!' },
  { id: 'p-green', name: 'Колибри', shape: 'super', body: '#38b000', dark: '#1b5e20', number: 9, en: 'The green plane!' },
  { id: 'p-orange', name: 'Пеликан', shape: 'super', body: '#fb8500', dark: '#9c4a00', number: 4, en: 'The orange plane!' },
  { id: 'p-purple', name: 'Сова', shape: 'super', body: '#7b2cbf', dark: '#3c096c', number: 6, en: 'The purple plane!' },
  { id: 'p-black', name: 'Ворон', shape: 'super', body: '#343a40', dark: '#111111', number: 13, en: 'The black plane!' },
  { id: 'p-gold', name: 'Орёл', shape: 'super', body: '#ffc300', dark: '#b8860b', number: 1, en: 'The gold plane!' },
];
export const STARTER_PLANES: readonly CarId[] = ['p-red'];
export const planeById = (id: CarId) => PLANES.find((c) => c.id === id) ?? PLANES[0]!;
export const planeLine = (id: CarId) => `plane.${id}`;

export type Pool = 'easy' | 'all' | 'mix' | 'sky';
export type Vehicle = 'car' | 'plane';
export interface Track {
  name: string;
  vehicle: Vehicle;
  /** Sky and light: day, sunset, night. */
  time: 'day' | 'sunset' | 'night';
  lanes: 3 | 4;
  /** Plane only: how many heights the cards hang at. */
  heights: 1 | 2;
  pool: Pool;
  /** Distractors from the same group (fruit among fruit): harder to tell apart. */
  sameGroup: boolean;
  /** Traffic cones (storm clouds for the plane) between the word rows. */
  cones: boolean;
  /** Speed limits, road units per second; the car starts at min. */
  minSpeed: number;
  maxSpeed: number;
  /** How hard the booster sums are, 0–3. */
  boost: 0 | 1 | 2 | 3;
}

export const TRACKS: readonly Track[] = [
  { name: 'Утренний город', vehicle: 'car', time: 'day', lanes: 3, heights: 1, pool: 'easy', sameGroup: false, cones: false, minSpeed: 6, maxSpeed: 16, boost: 0 },
  { name: 'Шоссе на закате', vehicle: 'car', time: 'sunset', lanes: 3, heights: 1, pool: 'all', sameGroup: true, cones: true, minSpeed: 8, maxSpeed: 19, boost: 1 },
  { name: 'Ночные огни', vehicle: 'car', time: 'night', lanes: 4, heights: 1, pool: 'mix', sameGroup: true, cones: true, minSpeed: 9, maxSpeed: 22, boost: 2 },
  { name: 'Над морем', vehicle: 'plane', time: 'day', lanes: 3, heights: 2, pool: 'sky', sameGroup: false, cones: false, minSpeed: 9, maxSpeed: 9, boost: 2 },
  { name: 'Над облаками', vehicle: 'plane', time: 'sunset', lanes: 3, heights: 2, pool: 'mix', sameGroup: true, cones: true, minSpeed: 11, maxSpeed: 11, boost: 3 },
];

const EASY_IDS = [
  'apple', 'banana', 'orange', 'pear', 'strawberry', 'watermelon', 'cat', 'dog', 'fish', 'bird', 'cow', 'pig', 'horse', 'duck', 'frog', 'rabbit',
  'bear', 'lion', 'monkey', 'elephant', 'panda', 'dinosaur', 'unicorn', 'sun', 'moon', 'star', 'ball', 'car', 'bus', 'train', 'plane', 'boat',
  'house', 'tree', 'flower', 'cake', 'egg', 'icecream', 'pizza', 'burger', 'donut', 'robot', 'teddy', 'balloon', 'gift', 'taxi', 'tractor', 'book',
];
/** Over the sea: things of the sky, the sea and travel, then everything else. */
const SKY_CATS = new Set(['transport', 'nature', 'animal', 'toy', 'fruit']);
const SMALL_NUMBERS = NUMBERS.filter((w) => Number(w.id.slice(1)) <= 20);

export function poolOf(pool: Pool): readonly Word[] {
  if (pool === 'easy') return PICTURES.filter((w) => EASY_IDS.includes(w.id));
  if (pool === 'all') return PICTURES;
  if (pool === 'sky') return [...PICTURES.filter((w) => SKY_CATS.has(w.cat)), ...COLORS];
  return [...PICTURES, ...COLORS, ...SMALL_NUMBERS];
}

/** A card in the air or a board on the road: lane left to right, height from the bottom (always 0 on the road). */
export interface Card {
  lane: number;
  h: number;
  word: string;
}
export interface Spot {
  lane: number;
  h: number;
}

export interface Row {
  target: string;
  /** One card per lane on the road; for the plane as many cards as lanes, spread over the heights. */
  cards: Card[];
  /** Cones (storm clouds) in the gap before this row; never on every spot. */
  cones: Spot[];
}

/** New words brought into one race at most (never seen before in the race). */
export const NEW_PER_RACE = 3;

/**
 * The words of one race: ROWS_PER_RACE targets. Words the child missed before
 * come back, a few never-seen words come in, the rest at random; never the
 * same word twice in a row.
 */
export function planRace(track: Track, rng: Rng, misses: Record<string, number> = {}, seen: Record<string, number> = {}): Row[] {
  const pool = poolOf(track.pool);
  const ranked = shuffle(rng, pool).sort((a, b) => (misses[b.id] ?? 0) - (misses[a.id] ?? 0));
  const weak = ranked.slice(0, Math.min(4, ranked.length)).filter((w) => (misses[w.id] ?? 0) > 0);
  const fresh = shuffle(rng, pool.filter((w) => !seen[w.id])).slice(0, NEW_PER_RACE);
  const targets: Word[] = [];
  for (const w of [...weak, ...fresh]) if (!targets.includes(w)) targets.push(w);
  // the rest from words met before, unless too few are known yet
  const known = pool.filter((w) => seen[w.id]);
  const base = known.length + fresh.length >= ROWS_PER_RACE ? known : pool;
  for (let tries = 0; targets.length < ROWS_PER_RACE && tries < 1000; tries++) {
    const w = pick(rng, base);
    if (targets.includes(w) && base.length > ROWS_PER_RACE && tries < 500) continue;
    targets.push(w);
  }
  const order = shuffle(rng, targets.slice(0, ROWS_PER_RACE));
  // no word twice in a row
  for (let i = 1; i < order.length; i++) {
    if (order[i]!.id !== order[i - 1]!.id) continue;
    const j = order.findIndex((w, k) => k > i && w.id !== order[i]!.id && order[k - 1]!.id !== w.id);
    if (j > 0) [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const spots: Spot[] = [];
  for (let h = 0; h < track.heights; h++) for (let l = 0; l < track.lanes; l++) spots.push({ lane: l, h });
  return order.map((t, i) => {
    const words = rowWords(t, pool, track, rng);
    // On the road every lane has a board; in the air the cards take some of the spots.
    const places = track.heights === 1 ? spots : shuffle(rng, spots).slice(0, words.length);
    const cards = words.map((word, k) => ({ word, lane: places[k]!.lane, h: places[k]!.h }));
    let cones: Spot[] = [];
    if (track.cones && i > 0 && rng() < 0.6) {
      const n = int(rng, 1, Math.max(1, spots.length - (track.heights === 1 ? 2 : 3)));
      cones = shuffle(rng, spots).slice(0, Math.min(n, spots.length - 1));
    }
    return { target: t.id, cards, cones };
  });
}

function rowWords(target: Word, pool: readonly Word[], track: Track, rng: Rng): string[] {
  const n = track.lanes;
  const others = pool.filter((w) => w.id !== target.id);
  const same = others.filter((w) => w.cat === target.cat);
  const near = track.sameGroup && same.length >= n - 1 ? same : others.filter((w) => w.cat !== target.cat);
  const wrong = shuffle(rng, near.length >= n - 1 ? near : others).slice(0, n - 1);
  return shuffle(rng, [target, ...wrong]).map((w) => w.id);
}

/** Saved between visits. */
export interface Progress {
  car: CarId;
  /** Cars in the garage. */
  cars: CarId[];
  /** The chosen plane and the planes in the hangar. */
  plane: CarId;
  planes: CarId[];
  /** Best stars per track. */
  stars: number[];
  /** Times each word was missed (crashed into the wrong board instead). */
  misses: Record<string, number>;
  /** Times each word was asked in a race: never-seen words come in a few at a time. */
  seen: Record<string, number>;
  /** One coin per right word, five more for a race without a mistake. */
  coins: number;
  /** Nitro bottles bought in the garage (at most MAX_NITRO). */
  nitro: number;
  /** Races without a single mistake. */
  flawless: number;
  /**
   * The child's own track (0-based), raised and lowered by the smart level
   * after each race. New cars and full coins come only here and above;
   * easier tracks are practice.
   */
  level: number;
}

export const MAX_NITRO = 3;
export const FLAWLESS_BONUS = 5;

export const freshProgress = (): Progress => ({
  car: 'red', cars: [...STARTER_CARS], plane: 'p-red', planes: [...STARTER_PLANES], stars: TRACKS.map(() => 0), misses: {}, seen: {}, coins: 0, nitro: 0, flawless: 0, level: 0,
});

/** For saves made before the level existed: the track after the last one with three stars. */
function guessLevel(stars: number[]): number {
  let lvl = 0;
  stars.forEach((s, i) => {
    if (s >= 3) lvl = Math.max(lvl, Math.min(i + 1, TRACKS.length - 1));
  });
  return lvl;
}

const nat = (v: unknown, max = 1e6) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? Math.min(v, max) : 0);
function counts(v: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') for (const [k, n] of Object.entries(v)) if (Number.isInteger(n) && (n as number) > 0) out[k] = Math.min(n as number, max);
  return out;
}

export function parseProgress(raw: unknown): Progress {
  const p = (raw ?? {}) as Partial<Progress>;
  const known = new Set(CARS.map((c) => c.id));
  const cars = [...STARTER_CARS, ...(Array.isArray(p.cars) ? p.cars.filter((c) => known.has(c) && !STARTER_CARS.includes(c)) : [])];
  const car = typeof p.car === 'string' && cars.includes(p.car) ? p.car : 'red';
  const knownP = new Set(PLANES.map((c) => c.id));
  const planes = [...new Set([...STARTER_PLANES, ...(Array.isArray(p.planes) ? p.planes.filter((c) => knownP.has(c)) : [])])];
  const plane = typeof p.plane === 'string' && planes.includes(p.plane) ? p.plane : STARTER_PLANES[0]!;
  const stars = TRACKS.map((_, i) => {
    const s: unknown = Array.isArray(p.stars) ? p.stars[i] : 0;
    return typeof s === 'number' && Number.isInteger(s) && s >= 0 && s <= 3 ? s : 0;
  });
  return {
    car, cars: [...new Set(cars)], plane, planes, stars, misses: counts(p.misses, 20), seen: counts(p.seen, 999),
    coins: nat(p.coins), nitro: nat(p.nitro, MAX_NITRO), flawless: nat(p.flawless),
    level: typeof p.level === 'number' ? Math.min(nat(p.level), TRACKS.length - 1) : guessLevel(stars),
  };
}

/** A track opens once the one before it has at least one star, or once the child's level reaches it. */
export const unlocked = (p: Progress, track: number) => track === 0 || track <= p.level || (p.stars[track - 1] ?? 0) > 0;

/** A track below the child's level: practice, half the coins and no new car. */
export const isPractice = (p: Progress, track: number) => track < p.level;

/** Half the coins on a practice track. */
export const practiceCoins = (correct: number) => Math.ceil(correct / 2);

/** The next car a race without mistakes brings, if any are left. */
export const nextCar = (p: Progress): Car | undefined => CARS.find((c) => !p.cars.includes(c.id));
/** The next plane a flight without mistakes brings. */
export const nextPlane = (p: Progress): Car | undefined => PLANES.find((c) => !p.planes.includes(c.id));

/** What a race without mistakes brings: a car on the road, a plane in the air. */
export interface Prize {
  kind: Vehicle;
  item: Car;
}

export interface RaceOutcome {
  correct: number;
  hits: string[];
  missed: string[];
  asked: string[];
  /** Cones and storm clouds hit. */
  bumps: number;
  /** Wrong booster answers (a bigger booster missed, a wrong landing place). */
  boostMisses?: number;
  rows: number;
}

export const isFlawless = (o: RaceOutcome) => o.correct === o.rows && o.missed.length === 0 && o.bumps === 0 && !o.boostMisses;

/**
 * After a race: best stars, coins, a new car for a race without mistakes, word
 * counts. On a practice track (below the child's level) the coins are halved
 * and a race without mistakes brings no car: cars are won on the child's own
 * track and above, so an easy track can't be farmed.
 */
export function recordRace(p: Progress, track: number, o: RaceOutcome): { progress: Progress; prize?: Prize; coins: number; practice: boolean } {
  const stars = [...p.stars];
  stars[track] = Math.max(stars[track] ?? 0, starsFor(o.correct));
  const misses = { ...p.misses };
  for (const id of o.missed) misses[id] = Math.min((misses[id] ?? 0) + 1, 20);
  for (const id of o.hits) {
    if (misses[id] === undefined) continue;
    if (misses[id]! <= 1) delete misses[id];
    else misses[id]!--;
  }
  const seen = { ...p.seen };
  for (const id of o.asked) seen[id] = Math.min((seen[id] ?? 0) + 1, 999);
  const flawless = isFlawless(o);
  const practice = isPractice(p, track);
  const coins = practice ? practiceCoins(o.correct) : o.correct + (flawless ? FLAWLESS_BONUS : 0);
  const air = TRACKS[track]?.vehicle === 'plane';
  const won = flawless && !practice ? (air ? nextPlane(p) : nextCar(p)) : undefined;
  const prize: Prize | undefined = won ? { kind: air ? 'plane' : 'car', item: won } : undefined;
  const cars = won && !air ? [...p.cars, won.id] : p.cars;
  const planes = won && air ? [...p.planes, won.id] : p.planes;
  return {
    progress: { ...p, stars, misses, seen, cars, planes, coins: p.coins + coins, flawless: p.flawless + (flawless ? 1 : 0) },
    prize,
    coins,
    practice,
  };
}

// ---------- the smart level ----------

/** Smart-level rules for the race: levels 1..5 are the tracks. */
export const LEVEL_RULES = { maxLevel: TRACKS.length, minLevel: 1, up: 0.9, down: 0.6 } as const;

/**
 * What the race tells the smart level: words, booster answers, and every cone
 * or storm cloud hit counts as a wrong answer. Only races on the child's own
 * track or above move the level (practice below changes nothing).
 */
export function levelStats(o: RaceOutcome, boostRight: number, boostTotal: number): { right: number; total: number } {
  return { right: o.correct + boostRight, total: o.rows + boostTotal + o.bumps };
}

/** Puts the smart level's decision (1-based) into the progress. */
export const withLevel = (p: Progress, level1: number): Progress => ({ ...p, level: Math.max(0, Math.min(TRACKS.length - 1, level1 - 1)) });

/** A nitro costs 3 to 9 coins; the price changes so counting stays a task. */
export const nitroPrice = (rng: Rng) => int(rng, 3, 9);

/** English lines of this game (besides the words and numbers Snake already has). */
export function englishLines(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of CARS) out[carLine(c.id)] = c.en;
  for (const c of PLANES) out[planeLine(c.id)] = c.en;
  out['race.go'] = 'Go!';
  out['race.great'] = 'Great!';
  out['race.yes'] = 'Yes!';
  out['race.welldone'] = 'Well done!';
  out['race.finish'] = 'Finish!';
  out['race.squat'] = 'Squat!';
  out['race.plane'] = 'The plane!';
  out['race.nitro'] = 'Nitro!';
  for (const [d, t] of Object.entries(DIR_WORDS)) out[`race.${d}`] = t;
  for (let n = 21; n < LINE_MAX; n++) out[`n${n}`] = numberWords(n);
  return out;
}

export const DIR_WORDS: Record<'left' | 'right' | 'up' | 'down', string> = { left: 'Left!', right: 'Right!', up: 'Up!', down: 'Down!' };

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TENS_W = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
/** 21–49 in words, "twenty-one"; the round tens are Snake's numbers. */
export function numberWords(n: number): string {
  const t = Math.floor(n / 10);
  return n % 10 ? `${TENS_W[t]}-${ONES[n % 10]}` : TENS_W[t]!;
}

export const PRAISE_LINES = ['race.great', 'race.yes', 'race.welldone', 'goodjob'];

// ---------- number line ----------

/**
 * The race is also a straight number line 0–50 (Siegler & Ramani: linear board
 * games build the mental number line). Every right word moves the car one
 * step; after rows 4, 8 and 11 a booster with a sum that gets harder from
 * track to track: pick the bigger booster, add two boosters, compare two
 * pairs, or roll back after an oil puddle (headwind for the plane).
 */
export const LINE_MAX = 50;
export const BOOST_AFTER: readonly number[] = [3, 7, 10];

export type BoostTask =
  /** Two boosters, take the bigger; then where do we land. */
  | { kind: 'compare'; a: number; b: number; right: number }
  /** Both boosters one after another: pos + a + b. */
  | { kind: 'sum'; a: number; b: number; right: number }
  /** Which pair gives more: a1+a2 or b1+b2; then land. */
  | { kind: 'pairs'; a: [number, number]; b: [number, number]; right: number }
  /** An oil puddle (headwind): pos − a. */
  | { kind: 'minus'; a: number; right: number };

const two = (rng: Rng, lo: number, hi: number): [number, number] => {
  const a = int(rng, lo, hi);
  let b = int(rng, lo, hi);
  while (b === a) b = int(rng, lo, hi);
  return [a, b];
};

/** The booster task after row `after` on a track of difficulty `level`, starting from `pos`. */
export function boosterTask(level: number, after: number, pos: number, rng: Rng): BoostTask {
  const k = BOOST_AFTER.indexOf(after);
  const land = (v: number) => Math.max(0, Math.min(LINE_MAX, pos + v));
  if (level === 0) {
    const [a, b] = two(rng, 2, k === 0 ? 4 : 6);
    return { kind: 'compare', a, b, right: land(Math.max(a, b)) };
  }
  if (level === 1) {
    if (k < 2) {
      const [a, b] = two(rng, 3, 9);
      return { kind: 'compare', a, b, right: land(Math.max(a, b)) };
    }
    const a = int(rng, 2, 4);
    const b = int(rng, 2, 4);
    return { kind: 'sum', a, b, right: land(a + b) };
  }
  if (level === 2) {
    if (k === 1 && pos >= 6) {
      const a = int(rng, 2, 4);
      return { kind: 'minus', a, right: land(-a) };
    }
    const a = int(rng, 2, 6);
    const b = int(rng, 2, 6);
    return { kind: 'sum', a, b, right: land(a + b) };
  }
  // level 3: compare two sums, or a bigger roll-back
  if (k === 1 && pos >= 8) {
    const a = int(rng, 3, 6);
    return { kind: 'minus', a, right: land(-a) };
  }
  let x: [number, number];
  let y: [number, number];
  do {
    x = [int(rng, 1, 6), int(rng, 1, 6)];
    y = [int(rng, 1, 6), int(rng, 1, 6)];
  } while (x[0] + x[1] === y[0] + y[1]);
  return { kind: 'pairs', a: x, b: y, right: land(Math.max(x[0] + x[1], y[0] + y[1])) };
}

/** The steps a booster really moves the car (what the child chose may differ for compare). */
export function boostSteps(t: BoostTask, chosen?: number): number {
  if (t.kind === 'compare') return chosen ?? Math.max(t.a, t.b);
  if (t.kind === 'sum') return t.a + t.b;
  if (t.kind === 'pairs') return chosen ?? Math.max(t.a[0] + t.a[1], t.b[0] + t.b[1]);
  return -t.a;
}

/** Three landing places: the right one and two neighbours on the line. */
export function landingOptions(pos: number, v: number, rng: Rng): number[] {
  const right = Math.max(0, Math.min(LINE_MAX, pos + v));
  const lo = v < 0 ? 0 : pos + 1;
  const hi = v < 0 ? pos - 1 : LINE_MAX;
  const near = shuffle(rng, [right - 2, right - 1, right + 1, right + 2].filter((x) => x >= lo && x <= hi && x !== right)).slice(0, 2);
  return shuffle(rng, [right, ...near]);
}

// ---------- the maze in the garage ----------

export interface Maze {
  cols: number;
  rows: number;
  /** walls[y][x] = [up, right, down, left] */
  walls: boolean[][][];
  start: { x: number; y: number };
  part: { x: number; y: number };
  exit: { x: number; y: number };
}

/**
 * A perfect maze (one way between any two cells) by depth-first search. The car
 * starts bottom left, the garage is top right, and the spare part waits in the
 * dead end farthest from the straight way: the child has to plan a detour.
 */
export function makeMaze(cols: number, rows: number, rng: Rng): Maze {
  const walls = Array.from({ length: rows }, () => Array.from({ length: cols }, () => [true, true, true, true]));
  const seen = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  const D = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]] as const;
  const stack = [{ x: 0, y: rows - 1 }];
  seen[rows - 1]![0] = true;
  while (stack.length) {
    const c = stack.at(-1)!;
    const next = shuffle(rng, D.filter(([dx, dy]) => {
      const nx = c.x + dx;
      const ny = c.y + dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny]![nx];
    }));
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [dx, dy, w, back] = next[0]!;
    const n = { x: c.x + dx, y: c.y + dy };
    walls[c.y]![c.x]![w] = false;
    walls[n.y]![n.x]![back] = false;
    seen[n.y]![n.x] = true;
    stack.push(n);
  }
  const start = { x: 0, y: rows - 1 };
  const exit = { x: cols - 1, y: 0 };
  const fromStart = mazeDistances({ cols, rows, walls, start, part: start, exit }, start);
  const fromExit = mazeDistances({ cols, rows, walls, start, part: start, exit }, exit);
  // the part: the dead end that makes the longest detour off the start–exit way
  let part = exit;
  let best = -1;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const open = walls[y]![x]!.filter((b) => !b).length;
    const detour = fromStart[y]![x]! + fromExit[y]![x]! - fromStart[exit.y]![exit.x]!;
    if (open === 1 && (x !== start.x || y !== start.y) && (x !== exit.x || y !== exit.y) && detour > best) {
      best = detour;
      part = { x, y };
    }
  }
  return { cols, rows, walls, start, part, exit };
}

/** Steps from `from` to every cell. */
export function mazeDistances(m: Maze, from: { x: number; y: number }): number[][] {
  const d = Array.from({ length: m.rows }, () => Array.from({ length: m.cols }, () => -1));
  d[from.y]![from.x] = 0;
  const q = [from];
  const D = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  while (q.length) {
    const c = q.shift()!;
    D.forEach(([dx, dy], i) => {
      if (m.walls[c.y]![c.x]![i]) return;
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (d[ny]![nx]! >= 0) return;
      d[ny]![nx] = d[c.y]![c.x]! + 1;
      q.push({ x: nx, y: ny });
    });
  }
  return d;
}

/** Maze size grows with the track. */
export const mazeSize = (track: number): [number, number] => (track === 0 ? [5, 4] : track <= 2 ? [6, 5] : [7, 5]);

export const PUSHUPS = 10;
