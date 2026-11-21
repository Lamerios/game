import { shuffle, type Rng } from '../common/rng';

/**
 * «Кто в какой каюте?»: the crew moves into cabins and everyone says one thing
 * about where they live. Put each one in a cabin so that all clues are true.
 * Simple deduction with spatial words (left / right / next to / above / below)
 * and negation ("not in the red cabin"): the child keeps several rules in mind,
 * checks each against the picture and rules options out.
 */

export const CREW = ['rumb', 'kettle', 'raccoon', 'blot', 'walrus', 'strelka'] as const;
export type Who = (typeof CREW)[number];

export const DOORS = ['red', 'blue', 'green', 'yellow', 'orange', 'white'] as const;
export type Door = (typeof DOORS)[number];

export interface Layout {
  rows: number;
  cols: number;
}

/** A clue about one or two crew members. */
export type Clue =
  | { kind: 'at' | 'notAt'; a: Who; door: Door }
  | { kind: 'left' | 'right' | 'next' | 'notNext' | 'above' | 'below' | 'sameFloor'; a: Who; b: Who }
  | { kind: 'edge' | 'notEdge' | 'middle'; a: Who };

/** Cabin index → who lives there. Index = row * cols + col. */
export type Plan = Who[];

export interface Puzzle {
  layout: Layout;
  doors: Door[];
  crew: Who[];
  solution: Plan;
  clues: Clue[];
}

export interface LevelSpec {
  layout: Layout;
  /** Clue kinds allowed at this level. */
  kinds: Clue['kind'][];
  /** At most this many 'at' clues (they give a cabin away directly). */
  maxAt: number;
}

export const LEVELS: Record<number, LevelSpec> = {
  1: { layout: { rows: 1, cols: 3 }, kinds: ['at', 'left', 'right', 'middle', 'edge'], maxAt: 1 },
  2: { layout: { rows: 1, cols: 3 }, kinds: ['at', 'notAt', 'left', 'right', 'next', 'notNext', 'edge', 'middle'], maxAt: 1 },
  3: { layout: { rows: 1, cols: 4 }, kinds: ['at', 'notAt', 'left', 'right', 'next', 'notNext', 'edge', 'notEdge'], maxAt: 1 },
  4: { layout: { rows: 2, cols: 2 }, kinds: ['at', 'notAt', 'above', 'below', 'sameFloor', 'left', 'right'], maxAt: 1 },
  5: { layout: { rows: 2, cols: 3 }, kinds: ['at', 'notAt', 'above', 'below', 'sameFloor', 'left', 'right', 'next', 'edge'], maxAt: 1 },
};
export const MAX_LEVEL = 5;

const rc = (i: number, L: Layout) => ({ r: Math.floor(i / L.cols), c: i % L.cols });

/** Is the clue true for this plan? */
export function holds(clue: Clue, plan: Plan, doors: Door[], L: Layout): boolean {
  const where = (w: Who) => plan.indexOf(w);
  const A = rc(where(clue.a), L);
  switch (clue.kind) {
    case 'at':
      return doors[where(clue.a)] === clue.door;
    case 'notAt':
      return doors[where(clue.a)] !== clue.door;
    case 'edge':
      return A.c === 0 || A.c === L.cols - 1;
    case 'notEdge':
      return A.c !== 0 && A.c !== L.cols - 1;
    case 'middle':
      return L.cols % 2 === 1 && A.c === (L.cols - 1) / 2;
  }
  const B = rc(where(clue.b), L);
  switch (clue.kind) {
    case 'left':
      return A.c < B.c;
    case 'right':
      return A.c > B.c;
    case 'next':
      return A.r === B.r && Math.abs(A.c - B.c) === 1;
    case 'notNext':
      return !(A.r === B.r && Math.abs(A.c - B.c) === 1);
    case 'above':
      return A.c === B.c && A.r === B.r - 1;
    case 'below':
      return A.c === B.c && A.r === B.r + 1;
    case 'sameFloor':
      return A.r === B.r;
  }
}

/** Every arrangement of `items`. */
export function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((x, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [x, ...p]));
}

export const satisfies = (clues: Clue[], plan: Plan, doors: Door[], L: Layout) => clues.every((c) => holds(c, plan, doors, L));

/** All plans that fit every clue. */
export function solutions(clues: Clue[], crew: Who[], doors: Door[], L: Layout, all = permutations(crew)): Plan[] {
  return all.filter((p) => satisfies(clues, p, doors, L));
}

/** Every clue of the allowed kinds that is true for the solution. */
function trueClues(sol: Plan, doors: Door[], L: Layout, kinds: Clue['kind'][]): Clue[] {
  const out: Clue[] = [];
  for (const kind of kinds) {
    for (const a of sol) {
      if (kind === 'at' || kind === 'notAt') for (const door of doors) out.push({ kind, a, door });
      else if (kind === 'edge' || kind === 'notEdge' || kind === 'middle') out.push({ kind, a });
      else for (const b of sol) if (a !== b) out.push({ kind, a, b });
    }
  }
  return out.filter((c) => holds(c, sol, doors, L));
}

/**
 * A puzzle with exactly one solution and no clue that could be dropped. Clues
 * are added at random until only one arrangement is left, then trimmed.
 */
export function generate(level: number, rng: Rng): Puzzle {
  const spec = LEVELS[Math.max(1, Math.min(MAX_LEVEL, level))]!;
  const L = spec.layout;
  const n = L.rows * L.cols;
  for (;;) {
    const crew = shuffle(rng, [...CREW]).slice(0, n);
    const doors = shuffle(rng, [...DOORS]).slice(0, n);
    const solution = shuffle(rng, crew);
    const all = permutations(crew);
    const pool = shuffle(rng, trueClues(solution, doors, L, spec.kinds));
    const clues: Clue[] = [];
    let ats = 0;
    for (const c of pool) {
      if (c.kind === 'at' && ats >= spec.maxAt) continue;
      // Skip a clue that rules nothing new out.
      const before = solutions(clues, crew, doors, L, all).length;
      if (before === 1) break;
      const after = solutions([...clues, c], crew, doors, L, all).length;
      if (after === before) continue;
      clues.push(c);
      if (c.kind === 'at') ats++;
    }
    if (solutions(clues, crew, doors, L, all).length !== 1) continue;
    for (let i = clues.length - 1; i >= 0; i--) {
      const rest = clues.filter((_, k) => k !== i);
      if (solutions(rest, crew, doors, L, all).length === 1) clues.splice(i, 1);
    }
    // Every crew member should be talked about, or the child has to guess who is missing.
    const named = new Set(clues.flatMap((c) => ('b' in c ? [c.a, c.b] : [c.a])));
    if (named.size < n - 1) continue;
    if (clues.length > n + 1) continue;
    return { layout: L, doors, crew, solution, clues: shuffle(rng, clues) };
  }
}

/**
 * Phrase pieces of a clue, in speaking order (ids under kettle.cab.*):
 * "Румб | живёт левее | Пыхтелкина", "Румб | и | Болтик | живут рядом".
 * n. / g. / i. are a name in the nominative / genitive / instrumental.
 */
export function clueParts(c: Clue): string[] {
  if ('door' in c) return [`n.${c.a}`, `${c.kind === 'at' ? 'at' : 'not'}.${c.door}`];
  if (!('b' in c)) return [`n.${c.a}`, c.kind];
  if (c.kind === 'next' || c.kind === 'notNext' || c.kind === 'sameFloor') return [`n.${c.a}`, 'and', `n.${c.b}`, c.kind];
  return [`n.${c.a}`, c.kind, `${c.kind === 'left' || c.kind === 'right' ? 'g' : 'i'}.${c.b}`];
}

/** On the clue card: a short word between the two portraits. */
export const CLUE_WORD: Record<Clue['kind'], string> = {
  at: 'в каюте',
  notAt: 'не в каюте',
  left: 'левее',
  right: 'правее',
  next: 'рядом с',
  notNext: 'не рядом с',
  above: 'над',
  below: 'под',
  sameFloor: 'на одном этаже с',
  edge: 'с краю',
  notEdge: 'не с краю',
  middle: 'посередине',
};

export function nextLevel(level: number, firstTry: boolean, checks: number): number {
  if (firstTry) return Math.min(MAX_LEVEL, level + 1);
  return checks >= 4 ? Math.max(1, level - 1) : level;
}

