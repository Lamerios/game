import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { pick, shuffle, type Rng } from '../common/rng';

export const CHESS_MAX_LEVEL = 5;

/**
 * Levels (SDD 3.4, for a child who already knows how pieces move):
 * 1 — capture an undefended piece without losing yours
 * 2 — save your attacked piece
 * 3 — give check
 * 4 — mate in one
 * 5 — knight fork (check + attack on rook/queen)
 */
export interface ChessTask {
  level: number;
  fen: string;
  /** Correct moves in "from-to" form. White always moves. */
  correct: string[];
  /** For L2: the square of the piece in danger. */
  focus?: Square;
  goal: string;
  itemId: string;
}

const FILES = 'abcdefgh';
const sq = (f: number, r: number) => `${FILES[f]}${r + 1}` as Square;
const uci = (m: Move) => `${m.from}-${m.to}`;

function randomSquares(rng: Rng, n: number): Square[] {
  const all: Square[] = [];
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) all.push(sq(f, r));
  return shuffle(rng, all).slice(0, n);
}

/** Builds a legal position with white to move, or undefined. */
function position(rng: Rng, white: PieceSymbol[], black: PieceSymbol[]): Chess | undefined {
  const squares = randomSquares(rng, white.length + black.length + 2);
  const c = new Chess();
  c.clear();
  const put = (type: PieceSymbol, color: 'w' | 'b', s: Square) => c.put({ type, color }, s);
  put('k', 'w', squares[0]!);
  put('k', 'b', squares[1]!);
  white.forEach((p, i) => put(p, 'w', squares[2 + i]!));
  black.forEach((p, i) => put(p, 'b', squares[2 + white.length + i]!));
  // No pawns on the back ranks.
  for (const s of squares) {
    const p = c.get(s);
    if (p?.type === 'p' && (s.endsWith('1') || s.endsWith('8'))) return undefined;
  }
  // Black must not be in check with white to move, and white must have moves.
  const flipped = c.fen().replace(' w ', ' b ');
  try {
    if (new Chess(flipped).inCheck()) return undefined;
  } catch {
    return undefined;
  }
  if (c.inCheck() || c.moves().length === 0) return undefined;
  return c;
}

/** True if, after white's move, black can capture on `to`. */
function canBeTakenAfter(c: Chess, m: Move): boolean {
  const next = new Chess(c.fen());
  next.move({ from: m.from, to: m.to, promotion: 'q' });
  return next.moves({ verbose: true }).some((r) => r.to === m.to && r.captured);
}

function attackedSquares(c: Chess, color: 'w' | 'b'): Set<string> {
  // Squares the side could capture on if it were to move.
  const fen = c.fen().replace(color === 'w' ? ' b ' : ' w ', color === 'w' ? ' w ' : ' b ');
  try {
    return new Set(new Chess(fen).moves({ verbose: true }).filter((m) => m.captured).map((m) => m.to));
  } catch {
    return new Set();
  }
}

function tryLevel(level: number, rng: Rng): ChessTask | undefined {
  switch (level) {
    case 1: {
      const c = position(rng, [pick(rng, ['r', 'b', 'n', 'q'] as const)], [pick(rng, ['n', 'b', 'r'] as const), pick(rng, ['p', 'n'] as const)]);
      if (!c) return;
      const caps = c.moves({ verbose: true }).filter((m) => m.captured && m.captured !== 'k');
      const correct = caps.filter((m) => !canBeTakenAfter(c, m)).map(uci);
      if (correct.length !== 1 || caps.length === 0) return;
      return { level, fen: c.fen(), correct, goal: 'Забери фигуру так, чтобы тебя не съели в ответ.', itemId: `chess1-${c.fen()}` };
    }
    case 2: {
      const c = position(rng, [pick(rng, ['r', 'b', 'n'] as const)], [pick(rng, ['r', 'b', 'n', 'q'] as const)]);
      if (!c) return;
      const threatened = [...attackedSquares(c, 'b')].filter((s) => {
        const p = c.get(s as Square);
        return p && p.color === 'w' && p.type !== 'k';
      });
      if (threatened.length !== 1) return;
      const focus = threatened[0] as Square;
      const moves = c.moves({ verbose: true }).filter((m) => m.from === focus);
      const correct = moves.filter((m) => !canBeTakenAfter(c, m)).map(uci);
      if (correct.length === 0 || correct.length === moves.length) return;
      return { level, fen: c.fen(), correct, focus, goal: 'Твою фигуру сейчас съедят! Спаси её.', itemId: `chess2-${c.fen()}` };
    }
    case 3: {
      const c = position(rng, [pick(rng, ['r', 'q', 'b', 'n'] as const)], []);
      if (!c) return;
      const checks = c.moves({ verbose: true }).filter((m) => m.san.includes('+') && !m.san.includes('#') && !canBeTakenAfter(c, m));
      if (checks.length < 1 || checks.length > 4) return;
      return { level, fen: c.fen(), correct: checks.map(uci), goal: 'Объяви шах чёрному королю.', itemId: `chess3-${c.fen()}` };
    }
    case 4: {
      const c = edgeMatePosition(rng, pick(rng, ['q', 'r'] as const));
      if (!c) return;
      const mates = c.moves({ verbose: true }).filter((m) => m.san.includes('#'));
      if (mates.length < 1 || mates.length > 2) return;
      return { level, fen: c.fen(), correct: mates.map(uci), goal: 'Поставь мат в один ход.', itemId: `chess4-${c.fen()}` };
    }
    default: {
      const c = position(rng, ['n'], [pick(rng, ['r', 'q'] as const)]);
      if (!c) return;
      const forks = c.moves({ verbose: true }).filter((m) => {
        if (m.piece !== 'n' || !m.san.includes('+') || canBeTakenAfter(c, m)) return false;
        const next = new Chess(c.fen());
        next.move(m);
        // From its new square the knight also hits a rook or queen.
        const targets = knightTargets(m.to).map((s) => next.get(s));
        return targets.some((p) => p && p.color === 'b' && (p.type === 'r' || p.type === 'q'));
      });
      if (forks.length !== 1) return;
      return { level: 5, fen: c.fen(), correct: forks.map(uci), goal: 'Найди вилку конём: шах и нападение сразу.', itemId: `chess5-${c.fen()}` };
    }
  }
}

/**
 * Mate-in-one candidates: black king on an edge, white king in opposition,
 * the heavy piece anywhere. Random placement finds these rarely, this way
 * most tries succeed. Rotated to any of the four edges for variety.
 */
function edgeMatePosition(rng: Rng, heavy: 'q' | 'r'): Chess | undefined {
  const f = Math.floor(rng() * 8);
  const wf = Math.min(7, Math.max(0, f + Math.floor(rng() * 3) - 1));
  const hf = Math.floor(rng() * 8);
  const hr = Math.floor(rng() * 6);
  const orient = Math.floor(rng() * 4);
  // Base orientation: black king on rank 8 (index 7), white king on rank 6 (index 5).
  const place = (file: number, rank: number) => {
    switch (orient) {
      case 0: return sq(file, rank);
      case 1: return sq(file, 7 - rank);
      case 2: return sq(rank, file);
      default: return sq(7 - rank, file);
    }
  };
  const bk = place(f, 7);
  const wk = place(wf, 5);
  const h = place(hf, hr);
  if (new Set([bk, wk, h]).size < 3) return undefined;
  const c = new Chess();
  c.clear();
  c.put({ type: 'k', color: 'b' }, bk);
  c.put({ type: 'k', color: 'w' }, wk);
  c.put({ type: heavy, color: 'w' }, h);
  try {
    if (new Chess(c.fen().replace(' w ', ' b ')).inCheck()) return undefined;
  } catch {
    return undefined;
  }
  return c.moves().length ? c : undefined;
}

function knightTargets(s: Square): Square[] {
  const f = FILES.indexOf(s[0]!);
  const r = Number(s[1]) - 1;
  const d = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  return d.map(([df, dr]) => [f + df!, r + dr!]).filter(([a, b]) => a! >= 0 && a! < 8 && b! >= 0 && b! < 8).map(([a, b]) => sq(a!, b!));
}

export function generateChess(level: number, rng: Rng): ChessTask {
  const lvl = Math.min(CHESS_MAX_LEVEL, Math.max(1, level));
  for (let i = 0; i < 5000; i++) {
    const t = tryLevel(lvl, rng);
    if (t) return t;
  }
  throw new Error(`could not generate chess level ${lvl}`);
}
