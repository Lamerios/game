import { describe, expect, it } from 'vitest';
import { addAsk, firstTries, loadStats, recordWord, report, STATS_KEY, type Store } from '../src/core/wordStats';

const memory = (init: Record<string, string> = {}): Store & { data: Record<string, string> } => ({
  data: { ...init },
  getItem(k) {
    return this.data[k] ?? null;
  },
  setItem(k, v) {
    this.data[k] = v;
  },
});

describe('word stats', () => {
  it('counts first tries, misses and what was picked instead', () => {
    const s = {};
    addAsk(s, 'apple', []);
    addAsk(s, 'apple', ['pear', 'pear']);
    addAsk(s, 'apple', ['cherry']);
    expect(s).toMatchObject({ apple: { asked: 3, firstTry: 1, misses: 3, confused: { pear: 2, cherry: 1 } } });
    const r = report(s);
    expect(r.rows[0]).toMatchObject({ id: 'apple', status: 'hard', topConfusion: 'pear' });
    expect(r.rows[0]!.accuracy).toBeCloseTo(1 / 3);
  });

  it('puts hard words first and learnt ones last', () => {
    const s = {};
    for (let i = 0; i < 3; i++) addAsk(s, 'cat', []);
    addAsk(s, 'dog', []);
    addAsk(s, 'cow', ['pig']);
    addAsk(s, 'cow', ['dog']);
    const r = report(s);
    expect(r.rows.map((x) => [x.id, x.status])).toEqual([['cow', 'hard'], ['dog', 'learning'], ['cat', 'learnt']]);
    expect(r).toMatchObject({ asked: 6, firstTry: 4, learnt: 1, hard: 1 });
    expect(firstTries(s)).toEqual({ cat: 3, dog: 1, cow: 0 });
  });

  it('saves to the store and carries over the old Snake counts', () => {
    const store = memory({ 'snake-words': JSON.stringify({ apple: 2 }) });
    expect(loadStats(store).apple).toMatchObject({ asked: 2, firstTry: 2, misses: 0 });
    recordWord('apple', ['pear'], store);
    expect(JSON.parse(store.data[STATS_KEY]!).apple).toMatchObject({ asked: 3, firstTry: 2, misses: 1 });
    expect(loadStats(memory({ [STATS_KEY]: 'not json' }))).toEqual({});
  });
});
