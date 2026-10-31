import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/games/common/rng';
import { expandedLength, run, type CourseMap } from '../src/games/course/engine';
import { COURSE_MAX_LEVEL, generateCourse } from '../src/games/course/generator';

describe('course engine', () => {
  const map: CourseMap = {
    level: 1, w: 3, h: 3, start: { x: 0, y: 2, dir: 0 }, goal: { x: 2, y: 0 },
    reefs: [{ x: 1, y: 2 }], coins: [], allowRepeat: false, solution: [], itemId: 't',
  };
  it('moves, turns and reaches the goal', () => {
    const r = run(map, [{ cmd: 'F', times: 2 }, { cmd: 'R', times: 1 }, { cmd: 'F', times: 2 }]);
    expect(r.ok).toBe(true);
  });
  it('crashes into reefs and the edge, reporting the block', () => {
    const r = run(map, [{ cmd: 'R', times: 1 }, { cmd: 'F', times: 1 }]);
    expect(r).toMatchObject({ ok: false, reason: 'crash', block: 1 });
    expect(run(map, [{ cmd: 'L', times: 1 }, { cmd: 'F', times: 1 }])).toMatchObject({ ok: false, reason: 'crash' });
  });
  it('reports not_at_goal and too_long', () => {
    expect(run(map, [{ cmd: 'F', times: 1 }])).toMatchObject({ ok: false, reason: 'not_at_goal' });
    expect(run({ ...map, maxBlocks: 1 }, [{ cmd: 'F', times: 2 }, { cmd: 'R', times: 1 }])).toMatchObject({ ok: false, reason: 'too_long' });
  });
  it('requires all coins', () => {
    const m = { ...map, coins: [{ x: 0, y: 0 }] };
    expect(run(m, [{ cmd: 'F', times: 1 }, { cmd: 'R', times: 1 }, { cmd: 'F', times: 1 }, { cmd: 'L', times: 1 }, { cmd: 'F', times: 1 }, { cmd: 'R', times: 1 }, { cmd: 'F', times: 1 }])).toMatchObject({ ok: false, reason: 'coins_left' });
    expect(run(m, [{ cmd: 'F', times: 2 }, { cmd: 'R', times: 1 }, { cmd: 'F', times: 2 }]).ok).toBe(true);
  });
});

describe('generateCourse', () => {
  it('every generated map is solvable by its stored solution (BFS-free check via interpreter)', () => {
    for (let level = 1; level <= COURSE_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 300; seed++) {
        const m = generateCourse(level, mulberry32(seed * 7 + level));
        expect(run(m, m.solution).ok).toBe(true);
        const cells = [m.start, m.goal, ...m.reefs, ...m.coins].map((c) => `${c.x},${c.y}`);
        expect(new Set(cells).size).toBe(cells.length); // nothing overlaps
      }
    }
  });

  it('levels grow: L1 straight, L2 one turn, L3 ≤ 8 commands, L4+ need repeats', () => {
    for (let seed = 1; seed < 100; seed++) {
      const l1 = generateCourse(1, mulberry32(seed));
      expect(l1.solution.every((b) => b.cmd === 'F')).toBe(true);
      const l2 = generateCourse(2, mulberry32(seed));
      expect(l2.solution.filter((b) => b.cmd !== 'F')).toHaveLength(1);
      const l3 = generateCourse(3, mulberry32(seed));
      expect(expandedLength(l3.solution)).toBeLessThanOrEqual(8);
      const l4 = generateCourse(4, mulberry32(seed));
      expect(l4.maxBlocks).toBe(l4.solution.length);
      expect(expandedLength(l4.solution)).toBeGreaterThan(l4.maxBlocks!); // impossible without repeats
      const l5 = generateCourse(5, mulberry32(seed));
      expect(l5.coins).toHaveLength(2);
    }
  });
});
