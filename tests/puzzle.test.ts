import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/games/common/rng';
import { generateMathPuzzle, generateReadingPuzzle } from '../src/games/puzzle/generator';
import { breakProgram, generateCourse } from '../src/games/course/generator';
import { run } from '../src/games/course/engine';
import { usePuzzle } from '../src/games/puzzle/mix';

describe('math puzzles', () => {
  it('always have three distinct options with the right answer among them', () => {
    const rng = mulberry32(7);
    const kinds = new Set<string>();
    for (let level = 1; level <= 7; level++) {
      for (let i = 0; i < 300; i++) {
        const p = generateMathPuzzle(level, rng);
        kinds.add(p.kind);
        expect(p.options).toHaveLength(3);
        expect(new Set(p.options.map((o) => o.label)).size).toBe(3);
        expect(p.answer).toBeGreaterThanOrEqual(0);
        const a = p.options[p.answer]!.label!;
        const v = p.visual;
        if (v.type === 'scales') expect(Number(a) + v.known).toBe(v.total);
        if (v.type === 'trade') expect(Number(a)).toBe(v.items * v.price);
        if (v.type === 'share') expect(Number(a) * v.crew).toBe(v.coins);
        if (v.type === 'octopus') expect(Number(a)).toBe(v.rest ? v.holding + v.rest * 2 : 8 - v.holding);
        if (p.kind === 'code') expect(a).toMatch(/^\d\d$/);
      }
    }
    expect([...kinds].sort()).toEqual(['code', 'octopus', 'scales', 'share', 'trade']);
  });

  it('keep numbers within 20', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const p = generateMathPuzzle(7, rng);
      for (const o of p.options) if (p.kind !== 'code') expect(Number(o.label)).toBeLessThanOrEqual(20);
    }
  });
});

describe('reading puzzles', () => {
  it('smudge hides a letter of the word, and the answer is that letter', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 300; i++) {
      const p = generateReadingPuzzle(4, rng);
      if (p.visual.type !== 'note') continue;
      expect(p.options[p.answer]!.label).toBe(p.visual.text[p.visual.blot]);
    }
  });

  it('detective clue rules out exactly the other two places', () => {
    const rng = mulberry32(5);
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      const p = generateReadingPuzzle(6, rng);
      if (p.kind !== 'detective') continue;
      seen++;
      const answer = p.options[p.answer]!.key!;
      expect(p.options.map((o) => o.key)).toContain(answer);
      expect(p.text).toMatch(/^Записка Бороды: «Карта не в \S+\. И она не в \S+ \S+»\. Где карта\?$/);
    }
    expect(seen).toBeGreaterThan(50);
  });
});

describe('course: fix Klyaksa\'s route', () => {
  it('the broken program fails and differs from the solution in one arrow', () => {
    const rng = mulberry32(9);
    for (let level = 1; level <= 5; level++) {
      for (let i = 0; i < 30; i++) {
        const m = generateCourse(level, rng);
        const broken = breakProgram(m, rng);
        expect(run(m, broken).ok).toBe(false);
        expect(broken.filter((b, j) => b.cmd !== m.solution[j]!.cmd)).toHaveLength(1);
      }
    }
  });
});

describe('task mix', () => {
  it('star tasks and levels above the classic games are puzzles; chess never is', () => {
    expect(usePuzzle({ skill: 'reading', level: 3, isReview: false, star: true }, 1)).toBe(true);
    expect(usePuzzle({ skill: 'reading', level: 6, isReview: false }, 1)).toBe(true);
    expect(usePuzzle({ skill: 'math', level: 7, isReview: false }, 1)).toBe(true);
    expect(usePuzzle({ skill: 'math', level: 3, isReview: false }, 1)).toBe(false);
    expect(usePuzzle({ skill: 'math', level: 3, isReview: false }, 2)).toBe(true);
    expect(usePuzzle({ skill: 'chess', level: 3, isReview: false, star: true }, 0)).toBe(false);
  });
});
