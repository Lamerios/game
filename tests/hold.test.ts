import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/games/common/rng';
import { canMake, generateHold, HOLD_MAX_LEVEL } from '../src/games/hold/generator';

describe('generateHold', () => {
  it('every task is solvable and within its ranges', () => {
    for (let level = 1; level <= HOLD_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 300; seed++) {
        const t = generateHold(level, mulberry32(seed * 31 + level));
        if (t.kind === 'load') {
          expect(canMake(t.cargo, t.target)).toBe(true);
          expect(t.target).toBeLessThanOrEqual(t.capacity);
          expect(t.cargo.every((c) => c >= 1)).toBe(true);
        } else if (t.kind === 'unload') {
          const total = t.start.reduce((s, v) => s + v, 0);
          expect(t.leave).toBeGreaterThan(0);
          expect(t.leave).toBeLessThan(total);
          expect(canMake(t.start, t.leave)).toBe(true);
          expect(total).toBeLessThanOrEqual(t.capacity);
        } else {
          expect(t.became - t.was).toBe(t.answer);
          expect(t.options).toContain(t.answer);
          expect(new Set(t.options).size).toBe(t.options.length);
          expect(t.became).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it('L1–L2 stay within 10, L3 crosses ten', () => {
    for (let seed = 1; seed < 100; seed++) {
      const l1 = generateHold(1, mulberry32(seed));
      const l3 = generateHold(3, mulberry32(seed));
      if (l1.kind === 'load') expect(l1.target).toBeLessThanOrEqual(10);
      if (l3.kind === 'load') expect(l3.target).toBeGreaterThan(10);
    }
  });

  it('L5 shows the grid, L6 does not', () => {
    const l5 = generateHold(5, mulberry32(1));
    const l6 = generateHold(6, mulberry32(1));
    expect(l5.kind === 'missing' && l5.showGrid).toBe(true);
    expect(l6.kind === 'missing' && l6.showGrid).toBe(false);
  });
});

describe('canMake', () => {
  it('finds subset sums', () => {
    expect(canMake([3, 5, 2], 7)).toBe(true);
    expect(canMake([3, 5], 4)).toBe(false);
  });
});

import { solve } from '../src/games/hold/generator';
describe('solve', () => {
  it('returns indices that sum to target', () => {
    const p = [4, 7, 2, 5];
    const idx = solve(p, 9)!;
    expect(idx.reduce((s, i) => s + p[i]!, 0)).toBe(9);
    expect(solve([3, 5], 4)).toBeUndefined();
  });
});
