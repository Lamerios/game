import { shuffle, type Rng } from '../common/rng';

/**
 * «Кругосветная посылка»: rules without Phaser, so they can be tested.
 * A mysterious parcel goes round the world in six legs. On each leg the
 * dispatcher says in English which transport to take ("Take the camel!"),
 * then how many boxes, and later of which colour, to load ("Load two red boxes!").
 * Nothing is lost on a mistake: the word is named and the task is said again.
 */

/** Pictures live in public/parcel/<id>.webp; the English word is clip en.<id>. */
export type Vehicle = 'boat' | 'car' | 'bus' | 'bicycle' | 'tractor' | 'train' | 'camel' | 'helicopter' | 'plane' | 'sled';
export const VEHICLES: readonly Vehicle[] = ['boat', 'car', 'bus', 'bicycle', 'tractor', 'train', 'camel', 'helicopter', 'plane', 'sled'];
export const VEHICLE_RU: Record<Vehicle, string> = {
  boat: 'лодка', car: 'машина', bus: 'автобус', bicycle: 'велосипед', tractor: 'трактор',
  train: 'поезд', camel: 'верблюд', helicopter: 'вертолёт', plane: 'самолёт', sled: 'санки',
};

export type Terrain = 'sea' | 'desert' | 'mountains' | 'rails' | 'ocean' | 'snow';
/** How a wrong vehicle fails on this terrain: sinks, gets stuck, or bumps into it. */
export type Fail = 'sink' | 'stuck' | 'bump';

export interface Leg {
  terrain: Terrain;
  /** The transport that gets the parcel across. */
  answer: Vehicle;
  /** Transport that clearly cannot (no plane among the options over the sea, where it would fly). */
  wrong: readonly Vehicle[];
  /** Pictures to choose from: the answer and options − 1 wrong ones. */
  options: number;
  fail: Fail;
  /** Where the parcel arrives, for the map. */
  place: string;
  /** Boxes to load: how many (min..max) and whether a colour is named. */
  load: { min: number; max: number; color: boolean };
}

export const LEGS: readonly Leg[] = [
  { terrain: 'sea', answer: 'boat', wrong: ['car', 'bus', 'bicycle', 'tractor', 'train'], options: 2, fail: 'sink', place: 'Африка', load: { min: 2, max: 3, color: false } },
  { terrain: 'desert', answer: 'camel', wrong: ['boat', 'sled', 'bicycle', 'train', 'bus'], options: 3, fail: 'stuck', place: 'Оазис', load: { min: 3, max: 4, color: false } },
  { terrain: 'mountains', answer: 'helicopter', wrong: ['boat', 'bus', 'car', 'camel', 'bicycle', 'tractor'], options: 3, fail: 'bump', place: 'Гималаи', load: { min: 1, max: 2, color: true } },
  { terrain: 'rails', answer: 'train', wrong: ['boat', 'camel', 'sled', 'tractor', 'bicycle'], options: 4, fail: 'stuck', place: 'Япония', load: { min: 2, max: 3, color: true } },
  { terrain: 'ocean', answer: 'plane', wrong: ['car', 'bus', 'train', 'bicycle', 'camel', 'tractor'], options: 4, fail: 'sink', place: 'Америка', load: { min: 3, max: 4, color: true } },
  { terrain: 'snow', answer: 'sled', wrong: ['boat', 'bicycle', 'camel', 'bus', 'car', 'train'], options: 4, fail: 'stuck', place: 'Аляска', load: { min: 4, max: 5, color: true } },
];

export type BoxColor = 'red' | 'blue' | 'green' | 'yellow';
export const BOX_COLORS: readonly BoxColor[] = ['red', 'blue', 'green', 'yellow'];
export const BOX_PAINT: Record<BoxColor, number> = { red: 0xe63946, blue: 0x277da1, green: 0x43aa8b, yellow: 0xffc94a };
/** Plain wooden boxes when no colour is named. */
export const WOOD = 0xd4a373;

/** Boxes on the pier for one loading task. */
export const PIER_BOXES = 8;
export const MAX_LOAD = 5;

/** The English line for a load task, as an id of content/phrases.json "english.words". */
export const loadId = (n: number, color?: BoxColor) => (color ? `load.${n}.${color}` : `load.${n}`);
export const takeId = (v: Vehicle) => `take.${v}`;

/** English text of a load task: "Load one box!", "Load three red boxes!". */
export function loadText(n: number, color?: BoxColor): string {
  const num = ['zero', 'one', 'two', 'three', 'four', 'five'][n]!;
  return `Load ${num}${color ? ` ${color}` : ''} ${n === 1 ? 'box' : 'boxes'}!`;
}

/** Every English line the game says: id → text (merged into phrases.json, checked by a test). */
export function englishLines(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of VEHICLES) out[v] = v;
  for (const c of BOX_COLORS) out[c] = c;
  for (const leg of LEGS) out[takeId(leg.answer)] = `Take the ${leg.answer}!`;
  for (let n = 1; n <= MAX_LOAD; n++) {
    out[loadId(n)] = loadText(n);
    for (const c of BOX_COLORS) out[loadId(n, c)] = loadText(n, c);
  }
  out['goodjob'] = 'Good job!';
  return out;
}

/** The pictures for one leg, the answer among them, in a random order. */
export function choices(leg: Leg, rng: Rng): Vehicle[] {
  return shuffle(rng, [leg.answer, ...shuffle(rng, leg.wrong).slice(0, leg.options - 1)]);
}

export interface LoadTask {
  n: number;
  color?: BoxColor;
  /** Colours of the boxes on the pier, left to right. */
  pier: (BoxColor | undefined)[];
}

/**
 * One loading task. With a colour named, the pier has a few more boxes of that
 * colour than needed (so the count still matters) and the rest in other colours.
 */
export function planLoad(leg: Leg, rng: Rng): LoadTask {
  const n = leg.load.min + Math.floor(rng() * (leg.load.max - leg.load.min + 1));
  if (!leg.load.color) return { n, pier: Array.from({ length: PIER_BOXES }, () => undefined) };
  const color = BOX_COLORS[Math.floor(rng() * BOX_COLORS.length)]!;
  const own = Math.min(PIER_BOXES - 2, n + 1 + Math.floor(rng() * 2));
  const others = shuffle(rng, BOX_COLORS.filter((c) => c !== color));
  const pier: BoxColor[] = [...Array.from({ length: own }, () => color)];
  for (let i = 0; pier.length < PIER_BOXES; i++) pier.push(others[i % others.length]!);
  return { n, color, pier: shuffle(rng, pier) };
}

export type LoadCheck = { ok: true } | { ok: false; why: 'color'; wrong: BoxColor } | { ok: false; why: 'many' | 'few'; count: number };

/** What is wrong with the boxes in the vehicle, colour first (it is the harder part to hear). */
export function checkLoad(task: LoadTask, loaded: readonly (BoxColor | undefined)[]): LoadCheck {
  if (task.color) {
    const wrong = loaded.find((c) => c !== task.color);
    if (wrong) return { ok: false, why: 'color', wrong };
  }
  if (loaded.length > task.n) return { ok: false, why: 'many', count: loaded.length };
  if (loaded.length < task.n) return { ok: false, why: 'few', count: loaded.length };
  return { ok: true };
}

/** Saved between visits: how many legs are done. */
export interface Progress {
  leg: number;
  /** Times the whole trip was finished. */
  trips: number;
}

export const freshProgress = (): Progress => ({ leg: 0, trips: 0 });

export function parseProgress(raw: unknown): Progress {
  const p = raw as Partial<Progress> | null;
  const leg = Number.isInteger(p?.leg) && p!.leg! >= 0 && p!.leg! <= LEGS.length ? p!.leg! : 0;
  const trips = Number.isInteger(p?.trips) && p!.trips! >= 0 ? p!.trips! : 0;
  return { leg, trips };
}
