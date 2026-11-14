import { beforeEach, describe, expect, it } from 'vitest';
import { BOX_DAYS, dueWords, planWords, readWordLog, recordWord, review, summary } from '../src/core/wordLog';
import { mulberry32 } from '../src/games/common/rng';

const DAY = 24 * 60 * 60 * 1000;

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

describe('word log («Судовой журнал»)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
  });

  it('moves a word up a box when it is recalled on time, back to 1 on a miss', () => {
    const t0 = 1_000_000_000_000;
    let e = review(undefined, true, 'snake', t0);
    expect(e.box).toBe(1);
    expect(e.due).toBe(t0 + BOX_DAYS[1] * DAY);
    // Again the same day: counted, but no credit for massed practice.
    e = review(e, true, 'race', t0 + 1000);
    expect(e.box).toBe(1);
    expect(e.games).toEqual(['snake', 'race']);
    e = review(e, true, 'race', t0 + 2 * DAY);
    expect(e.box).toBe(2);
    e = review(e, false, 'logbook', t0 + 6 * DAY);
    expect(e.box).toBe(1);
    expect(e.due - (t0 + 6 * DAY)).toBeLessThan(DAY);
    expect([e.seen, e.right, e.wrong]).toEqual([4, 3, 1]);
  });

  it('stores words across games and lists the due ones, most overdue first', () => {
    const t0 = 1_000_000_000_000;
    recordWord('apple', true, 'snake', t0);
    recordWord('cat', true, 'snake', t0 - DAY);
    recordWord('dog', false, 'race', t0);
    expect(Object.keys(readWordLog()).sort()).toEqual(['apple', 'cat', 'dog']);
    expect(dueWords(t0 + 2 * DAY)).toEqual(['cat', 'dog', 'apple']);
    expect(dueWords(t0 + 2 * DAY, ['apple', 'dog'])).toEqual(['dog', 'apple']);
    expect(summary(t0)).toMatchObject({ met: 3, learnt: 0 });
  });

  it('plans a game: due words, then a few new ones, then the rest', () => {
    const t0 = 1_000_000_000_000;
    recordWord('a', true, 'snake', t0 - 5 * DAY);
    recordWord('b', true, 'snake', t0);
    const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const words = planWords(pool, 5, 2, mulberry32(1), t0 + 1000);
    expect(words).toHaveLength(5);
    expect(words).toContain('a');
    expect(words.filter((w) => !['a', 'b'].includes(w))).toHaveLength(3);
    expect(new Set(words).size).toBe(5);
  });
});
