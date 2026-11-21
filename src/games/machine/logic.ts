import { int, pick, shuffle, type Rng } from '../common/rng';

/**
 * «Машина Болтика»: a marble run on a pegboard. A ball drops into a chute at the
 * top and falls row by row; ramps push it one column left or right, a flipper
 * pushes it and then turns over (so the next ball goes the other way), a stopper
 * catches it. Cups wait at the bottom.
 *
 * The child predicts the result before seeing it, then checks (predict → observe
 * → explain is how young children revise causal ideas), and later works
 * backwards: which chute, or which ramps to turn, to ring the bell.
 */

/** '.' empty, '<' / '>' ramp, 'a' / 'b' flipper now pushing left / right, '#' stopper. */
export type Cell = '.' | '<' | '>' | 'a' | 'b' | '#';
export type Board = Cell[][];

export interface Step {
  col: number;
  row: number;
}

export interface Drop {
  /** Columns the ball visits, one per row it enters, plus where it ends. */
  path: Step[];
  /** Cup index, or -1 when a stopper caught it. */
  cup: number;
  /** The board after the ball passed (flippers turned over). */
  after: Board;
}

export const copy = (b: Board): Board => b.map((r) => [...r]);

/** Rolls one ball from the chute above `col`. */
export function drop(board: Board, col: number): Drop {
  const b = copy(board);
  const cols = b[0]!.length;
  const path: Step[] = [];
  let c = col;
  for (let r = 0; r < b.length; r++) {
    path.push({ col: c, row: r });
    const cell = b[r]![c]!;
    if (cell === '#') return { path, cup: -1, after: b };
    let d = 0;
    if (cell === '<') d = -1;
    else if (cell === '>') d = 1;
    else if (cell === 'a') {
      d = -1;
      b[r]![c] = 'b';
    } else if (cell === 'b') {
      d = 1;
      b[r]![c] = 'a';
    }
    // A ramp against the wall just lets the ball fall straight.
    if (c + d >= 0 && c + d < cols) c += d;
  }
  path.push({ col: c, row: b.length });
  return { path, cup: c, after: b };
}

export type Round =
  /** Tap the cup the ball will fall into. */
  | { kind: 'predict'; board: Board; chute: number }
  /** Two balls one after the other through flippers: predict each. */
  | { kind: 'twice'; board: Board; chute: number }
  /** Which chute leads to the bell? */
  | { kind: 'chute'; board: Board; bell: number }
  /** Turn the marked ramps so the ball rings the bell. */
  | { kind: 'fix'; board: Board; chute: number; bell: number; turnable: Step[] };

export interface LevelSpec {
  cols: number;
  rows: number;
  kinds: Round['kind'][];
  /** How many ramps / flippers / stoppers to scatter. */
  ramps: [number, number];
  flippers: number;
  stoppers: number;
  turnable: number;
}

export const LEVELS: Record<number, LevelSpec> = {
  1: { cols: 3, rows: 3, kinds: ['predict', 'predict', 'predict'], ramps: [2, 3], flippers: 0, stoppers: 0, turnable: 0 },
  2: { cols: 4, rows: 4, kinds: ['predict', 'predict', 'chute'], ramps: [2, 4], flippers: 0, stoppers: 1, turnable: 0 },
  3: { cols: 4, rows: 4, kinds: ['predict', 'chute', 'fix'], ramps: [3, 5], flippers: 0, stoppers: 1, turnable: 1 },
  4: { cols: 5, rows: 5, kinds: ['twice', 'chute', 'fix'], ramps: [3, 6], flippers: 1, stoppers: 1, turnable: 1 },
  5: { cols: 5, rows: 5, kinds: ['twice', 'fix', 'twice'], ramps: [4, 7], flippers: 2, stoppers: 1, turnable: 2 },
  6: { cols: 6, rows: 6, kinds: ['twice', 'chute', 'fix'], ramps: [6, 9], flippers: 2, stoppers: 2, turnable: 2 },
};
export const MAX_LEVEL = 6;

function emptyBoard(cols: number, rows: number): Board {
  return Array.from({ length: rows }, () => Array<Cell>(cols).fill('.'));
}

function scatter(rng: Rng, s: LevelSpec): Board {
  const b = emptyBoard(s.cols, s.rows);
  const free = shuffle(
    rng,
    Array.from({ length: s.cols * s.rows }, (_, i) => ({ col: i % s.cols, row: Math.floor(i / s.cols) })),
  );
  const put = (c: Cell) => {
    const at = free.pop();
    if (at) b[at.row]![at.col] = c;
  };
  for (let i = int(rng, s.ramps[0], s.ramps[1]); i > 0; i--) put(rng() < 0.5 ? '<' : '>');
  for (let i = 0; i < s.flippers; i++) put(rng() < 0.5 ? 'a' : 'b');
  for (let i = 0; i < s.stoppers; i++) put('#');
  return b;
}

/** How many times a path turns: a straight fall is too easy to predict. */
const turns = (d: Drop) => d.path.slice(1).filter((p, i) => p.col !== d.path[i]!.col).length;

const flippersOn = (d: Drop, board: Board) => d.path.some((p) => 'ab'.includes(board[p.row]?.[p.col] ?? '.'));

const cellAt = (b: Board, s: Step) => b[s.row]![s.col]!;

function makeRound(kind: Round['kind'], s: LevelSpec, rng: Rng): Round | null {
  const board = scatter(rng, s);
  const cols = s.cols;
  if (kind === 'predict' || kind === 'twice') {
    const chute = int(rng, 0, cols - 1);
    const d1 = drop(board, chute);
    if (d1.cup < 0 || turns(d1) < 1) return null;
    if (kind === 'twice') {
      // The first ball must turn a flipper over, and the second must land somewhere else.
      if (!flippersOn(d1, board)) return null;
      const d2 = drop(d1.after, chute);
      if (d2.cup < 0 || d2.cup === d1.cup) return null;
    }
    return { kind, board, chute };
  }
  if (kind === 'chute') {
    const ends = Array.from({ length: cols }, (_, c) => drop(board, c).cup);
    // Exactly one chute reaches the bell, and the bell is not right under it.
    const bell = pick(rng, ends.filter((e) => e >= 0));
    if (bell === undefined) return null;
    const hits = ends.map((e, c) => (e === bell ? c : -1)).filter((c) => c >= 0);
    if (hits.length !== 1 || hits[0] === bell) return null;
    return { kind, board, bell };
  }
  // fix: some ramps are turnable; only one way of setting them rings the bell.
  const ramps: Step[] = [];
  board.forEach((r, row) => r.forEach((c, col) => (c === '<' || c === '>') && ramps.push({ col, row })));
  if (ramps.length < s.turnable) return null;
  const chute = int(rng, 0, cols - 1);
  const turnable = shuffle(rng, ramps).slice(0, s.turnable);
  // Try every setting of the turnable ramps.
  const combos = 1 << turnable.length;
  const ends: number[] = [];
  for (let m = 0; m < combos; m++) {
    const b = copy(board);
    turnable.forEach((t, i) => (b[t.row]![t.col] = m & (1 << i) ? '>' : '<'));
    ends.push(drop(b, chute).cup);
  }
  const start = turnable.reduce((m, t, i) => m | (cellAt(board, t) === '>' ? 1 << i : 0), 0);
  const counts = new Map<number, number>();
  ends.forEach((e) => counts.set(e, (counts.get(e) ?? 0) + 1));
  const goals = [...counts.entries()].filter(([e, n]) => e >= 0 && n === 1 && e !== ends[start]).map(([e]) => e);
  if (!goals.length) return null;
  const bell = pick(rng, goals);
  // The board as shown starts in a wrong setting; at least one turn is needed.
  return { kind: 'fix', board, chute, bell, turnable };
}

export function planRounds(level: number, rng: Rng): Round[] {
  const s = LEVELS[Math.max(1, Math.min(MAX_LEVEL, level))]!;
  return s.kinds.map((k) => {
    for (let i = 0; i < 3000; i++) {
      const r = makeRound(k, s, rng);
      if (r) return r;
    }
    // Never expected: a plain board where the ball turns once.
    const board = emptyBoard(s.cols, s.rows);
    board[0]![0] = '>';
    return { kind: 'predict', board, chute: 0 } as Round;
  });
}

/** Ramps can only be '<' or '>'; turning one swaps them. */
export const turn = (c: Cell): Cell => (c === '<' ? '>' : c === '>' ? '<' : c);

/** Colour of each cup, by index; the English word is said when a ball lands. */
export const CUP_COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple'] as const;
export const CUP_PAINT: Record<(typeof CUP_COLORS)[number], number> = {
  red: 0xe63946,
  blue: 0x277da1,
  green: 0x52b788,
  yellow: 0xffd166,
  orange: 0xf4a261,
  purple: 0x9b5de5,
};

/** First-try share decides the level: all right → up, under half → down. */
export function nextLevel(level: number, right: number, total: number): number {
  if (total > 0 && right === total) return Math.min(MAX_LEVEL, level + 1);
  if (right * 2 <= total - 1) return Math.max(1, level - 1);
  return level;
}
