import { int, type Rng } from '../common/rng';

/**
 * «Затор в гавани»: a sliding-block puzzle. Every boat moves only along its own
 * length; slide them so the yacht (boat 0) can leave through the gap on the right.
 * Trains planning several steps ahead and mental movement of shapes (spatial
 * reasoning). Puzzles are generated and solved here; the solver also gives hints.
 */

export const N = 6;
/** The yacht's row; the exit is at the right end of it. */
export const EXIT_ROW = 2;

export interface Boat {
  /** Column of the left end (horizontal) / of the column it stands in (vertical). */
  x: number;
  /** Row of the top end (vertical) / of the row it lies in (horizontal). */
  y: number;
  len: 2 | 3;
  dir: 'h' | 'v';
}

export interface Puzzle {
  boats: Boat[];
  /** Fewest moves to solve; one move = one boat slid any distance. */
  min: number;
}

export interface Move {
  boat: number;
  /** Cells along the boat's axis: + is right / down. */
  delta: number;
}

export const cells = (b: Boat): [number, number][] =>
  Array.from({ length: b.len }, (_, i) => (b.dir === 'h' ? [b.x + i, b.y] : [b.x, b.y + i]));

/** Occupancy grid: boat index or -1. */
export function grid(boats: Boat[]): number[][] {
  const g = Array.from({ length: N }, () => Array<number>(N).fill(-1));
  boats.forEach((b, i) => {
    for (const [x, y] of cells(b)) g[y]![x] = i;
  });
  return g;
}

export function fits(boats: Boat[]): boolean {
  const seen = new Set<string>();
  for (const b of boats)
    for (const [x, y] of cells(b)) {
      if (x < 0 || y < 0 || x >= N || y >= N) return false;
      const k = `${x},${y}`;
      if (seen.has(k)) return false;
      seen.add(k);
    }
  return true;
}

/** How far boat i can slide: [most negative delta, most positive delta]. */
export function range(boats: Boat[], i: number, g = grid(boats)): [number, number] {
  const b = boats[i]!;
  let lo = 0;
  let hi = 0;
  if (b.dir === 'h') {
    while (b.x + lo - 1 >= 0 && g[b.y]![b.x + lo - 1] === -1) lo--;
    while (b.x + b.len + hi < N && g[b.y]![b.x + b.len + hi] === -1) hi++;
  } else {
    while (b.y + lo - 1 >= 0 && g[b.y + lo - 1]![b.x] === -1) lo--;
    while (b.y + b.len + hi < N && g[b.y + b.len + hi]![b.x] === -1) hi++;
  }
  return [lo, hi];
}

export function apply(boats: Boat[], m: Move): Boat[] {
  return boats.map((b, i) => (i !== m.boat ? b : b.dir === 'h' ? { ...b, x: b.x + m.delta } : { ...b, y: b.y + m.delta }));
}

/** The yacht stands at the exit. */
export const solved = (boats: Boat[]) => boats[0]!.x + boats[0]!.len === N;

const key = (boats: Boat[]) => boats.map((b) => (b.dir === 'h' ? b.x : b.y)).join('');

/** Shortest solution (breadth-first). null when there is none or the search is too big. */
export function solve(boats: Boat[], limit = 60000): Move[] | null {
  if (solved(boats)) return [];
  const prev = new Map<string, { from: string; move: Move } | null>();
  const states = new Map<string, Boat[]>();
  const start = key(boats);
  prev.set(start, null);
  states.set(start, boats);
  let frontier = [start];
  while (frontier.length && prev.size < limit) {
    const next: string[] = [];
    for (const k of frontier) {
      const s = states.get(k)!;
      const g = grid(s);
      for (let i = 0; i < s.length; i++) {
        const [lo, hi] = range(s, i, g);
        for (let d = lo; d <= hi; d++) {
          if (d === 0) continue;
          const t = apply(s, { boat: i, delta: d });
          const tk = key(t);
          if (prev.has(tk)) continue;
          prev.set(tk, { from: k, move: { boat: i, delta: d } });
          if (solved(t)) {
            const path: Move[] = [];
            let cur: string = tk;
            for (let p = prev.get(cur); p; p = prev.get(cur)) {
              path.unshift(p.move);
              cur = p.from;
            }
            return path;
          }
          states.set(tk, t);
          next.push(tk);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** Per level: how many other boats and the range of the shortest solution. */
export const LEVELS: Record<number, { boats: [number, number]; moves: [number, number] }> = {
  1: { boats: [2, 3], moves: [2, 3] },
  2: { boats: [3, 5], moves: [3, 4] },
  3: { boats: [5, 7], moves: [5, 6] },
  4: { boats: [6, 9], moves: [6, 8] },
  5: { boats: [8, 10], moves: [8, 11] },
  6: { boats: [9, 12], moves: [10, 16] },
};
export const MAX_LEVEL = 6;

function randomBoats(rng: Rng, others: number): Boat[] | null {
  const boats: Boat[] = [{ x: int(rng, 0, 2), y: EXIT_ROW, len: 2, dir: 'h' }];
  let tries = 0;
  while (boats.length < others + 1 && tries++ < 200) {
    const dir = rng() < 0.55 ? 'v' : 'h';
    const len = rng() < 0.3 ? 3 : 2;
    // No other horizontal boat on the exit row: it could never get out of the way.
    if (dir === 'h') {
      const y = int(rng, 0, N - 1);
      if (y === EXIT_ROW) continue;
      const b: Boat = { x: int(rng, 0, N - len), y, len, dir };
      if (fits([...boats, b])) boats.push(b);
    } else {
      const b: Boat = { x: int(rng, 0, N - 1), y: int(rng, 0, N - len), len, dir: 'v' };
      if (fits([...boats, b])) boats.push(b);
    }
  }
  return boats.length === others + 1 ? boats : null;
}

/**
 * A puzzle whose shortest solution falls in the level's range; if none is found
 * within the budget, the closest one found (harder levels are rare at random).
 */
export function generate(level: number, rng: Rng, budget = 1500): Puzzle {
  const L = LEVELS[Math.max(1, Math.min(MAX_LEVEL, level))]!;
  let best: Puzzle | null = null;
  const miss = (m: number) => (m < L.moves[0] ? L.moves[0] - m : m > L.moves[1] ? m - L.moves[1] : 0);
  for (let i = 0; i < budget; i++) {
    const boats = randomBoats(rng, int(rng, L.boats[0], L.boats[1]));
    if (!boats || solved(boats)) continue;
    const sol = solve(boats, 20000);
    if (!sol || sol.length === 0) continue;
    const p = { boats, min: sol.length };
    if (miss(p.min) === 0) return p;
    if (!best || miss(p.min) < miss(best.min)) best = p;
  }
  return best ?? { boats: [{ x: 0, y: EXIT_ROW, len: 2, dir: 'h' }, { x: 3, y: 1, len: 2, dir: 'v' }], min: 1 };
}

/** 3 stars: no more than one extra move and no hints; 1 star: a shown move or twice the moves. */
export function stars(moves: number, min: number, hints: number): number {
  if (hints >= 2 || moves > min * 2 + 2) return 1;
  if (hints === 0 && moves <= min + 1) return 3;
  return 2;
}

/** After each puzzle: up when solved cleanly, down when the solution had to be shown. */
export function nextLevel(level: number, s: number): number {
  return s === 3 ? Math.min(MAX_LEVEL, level + 1) : s === 1 ? Math.max(1, level - 1) : level;
}

/** English direction word for a move, said as the boat slides. */
export const dirWord = (b: Boat, delta: number) =>
  b.dir === 'h' ? (delta < 0 ? 'cmd.left' : 'cmd.right') : delta < 0 ? 'cmd.up' : 'cmd.down';
