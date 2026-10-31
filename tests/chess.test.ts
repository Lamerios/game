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
          // The moved piece cannot be taken back.
          expect(after.moves({ verbose: true }).some((r) => r.to === m.to && r.captured)).toBe(level === 4 ? false : false);
        }
      }
      expect(Date.now() - t0).toBeLessThan(15000);
    });
  }
});
