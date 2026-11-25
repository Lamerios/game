import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/analytics';
import { lastPlayed, pickTip, progressFromEvents, runStars, totalStars } from '../src/core/menuProgress';
import { GAMES } from '../src/games/registry';
import content from '../content/phrases.json';

const ev = (ts: number, game: string, type: string, data?: GameEvent['data']): GameEvent => ({ v: 1, ts, app: 'a', game, type, data });

describe('menu progress', () => {
  it('counts stars of finished runs only', () => {
    const map = progressFromEvents([
      ev(1, 'jam', 'run.start'),
      ev(2, 'jam', 'run.end', { completed: true, stars: 3 }),
      ev(3, 'jam', 'run.end', { completed: false, stars: 3 }),
      ev(4, 'snake', 'run.end', { completed: true, score: 9 }),
      ev(5, 'parcel', 'run.end', { completed: true, score: 7, total: 10 }),
      ev(6, 'menu', 'menu.pick', { game: 'jam' }),
    ]);
    expect(map.jam).toEqual({ stars: 3, plays: 1, last: 3 });
    expect(map.snake!.stars).toBe(1);
    expect(map.parcel!.stars).toBe(2);
    expect(map.menu).toBeUndefined();
    expect(totalStars(map)).toBe(6);
    expect(lastPlayed(map)).toBe('parcel');
  });

  it('caps stars at 3 and maps score ratios', () => {
    expect(runStars({ completed: true, stars: 7 })).toBe(3);
    expect(runStars({ completed: true, score: 10, total: 10 })).toBe(3);
    expect(runStars({ completed: true, score: 1, total: 10 })).toBe(1);
    expect(runStars({ completed: false })).toBe(0);
  });

  it('tips a new game first, then the one played longest ago, never the one just played', () => {
    const map = progressFromEvents([ev(10, 'a', 'run.start'), ev(20, 'b', 'run.start'), ev(30, 'c', 'run.start')]);
    expect(pickTip(['a', 'b', 'c', 'd'], map, { fresh: ['c'] })).toBe('c');
    expect(pickTip(['a', 'b', 'c', 'd'], map)).toBe('d');
    expect(pickTip(['a', 'b', 'c'], map, { lastPlayed: 'a' })).toBe('b');
    expect(pickTip(['a'], map, { lastPlayed: 'a' })).toBe('a');
  });

  it('has a voiced Rumb line for every game on the menu', () => {
    const phrases = content.phrases as Record<string, string>;
    const missing = GAMES.filter((g) => !g.hidden && !phrases[`rumb.menu.game.${g.id}`]).map((g) => g.id);
    expect(missing).toEqual([]);
  });
});
