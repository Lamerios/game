import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/games/common/rng';
import { CHESS_MAX_LEVEL, generateChess } from '../src/games/chess/generator';

const apply = (fen: string, mv: string) => {
  const c = new Chess(fen);
  const [from, to] = mv.split('-');
  const m = c.move({ from: from!, to: to!, promotion: 'q' });
  return { c, m };
};

describe('generateChess', () => {
  for (let level = 1; level <= CHESS_MAX_LEVEL; level++) {
    it(`level ${level}: legal positions, white to move, correct moves are legal`, () => {
      const t0 = Date.now();
      for (let seed = 1; seed <= 60; seed++) {
        const t = generateChess(level, mulberry32(seed * 13 + level));
        const c = new Chess(t.fen);
        expect(c.turn()).toBe('w');
        expect(t.correct.length).toBeGreaterThan(0);
        for (const mv of t.correct) {
          const { c: after, m } = apply(t.fen, mv);
          if (level === 1) expect(m.captured).toBeTruthy();
          if (level === 3) expect(after.inCheck()).toBe(true);
          if (level === 4) expect(after.isCheckmate()).toBe(true);
          if (level === 5) expect(m.piece).toBe('n');
          // Black cannot take anything back, anywhere on the board.
          expect(after.moves({ verbose: true }).some((r) => r.captured)).toBe(false);
          if (level === 1) expect(m.piece).not.toBe('k');
        }
      }
      expect(Date.now() - t0).toBeLessThan(15000);
    });
  }

  it('the list of solutions is complete: every other move fails the goal', () => {
    for (const level of [1, 2, 3, 4]) {
      for (let seed = 1; seed <= 40; seed++) {
        const t = generateChess(level, mulberry32(seed * 31 + level));
        for (const m of new Chess(t.fen).moves({ verbose: true })) {
          const after = new Chess(t.fen);
          after.move(m);
          const loses = after.moves({ verbose: true }).some((r) => r.captured);
          const good =
            level === 1 ? !!m.captured && !loses :
            level === 2 ? m.from === t.focus && !loses :
            level === 3 ? after.inCheck() && !after.isCheckmate() && !loses :
            after.isCheckmate();
          expect(t.correct.includes(`${m.from}-${m.to}`), `L${level} ${t.fen} ${m.san}`).toBe(good);
        }
      }
    }
  }, 30000);
});
