import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allClips, ENGLISH } from '../src/core/phrases';
import content from '../content/phrases.json';
import { freshGame, nextPrize, parseAll, parseGame, recordResult, totalStars } from '../src/core/progress';
import { COLLECTIONS, englishLines, LEVELS, SKINS, skinById, starsFor, STARTER_SKIN } from '../src/games/common/collections';
import { GAMES } from '../src/games/registry';

describe('progress like the race', () => {
  const items = ['a', 'b', 'c'];

  it('keeps the best stars per level and gives the next prize for three stars', () => {
    let p = freshGame();
    let r = recordResult(p, { level: 2, stars: 2 }, items);
    expect(r.progress.best).toEqual([0, 2]);
    expect(r.prize).toBeUndefined();
    expect(r.newBest).toBe(true);
    p = r.progress;
    r = recordResult(p, { level: 2, stars: 1 }, items);
    expect(r.progress.best).toEqual([0, 2]);
    expect(r.newBest).toBe(false);
    r = recordResult(r.progress, { level: 3, stars: 3 }, items);
    expect(r.prize).toBe('a');
    expect(r.progress.prizes).toEqual(['a']);
    expect(r.progress.peak).toBe(3);
    expect(r.progress.played).toBe(3);
    expect(r.progress.perfect).toBe(1);
    expect(totalStars(r.progress)).toBe(5);
    expect(nextPrize(r.progress, items)).toBe('b');
  });

  it('gives nothing more once the collection is full', () => {
    const full = { ...freshGame(), prizes: [...items] };
    const r = recordResult(full, { level: 1, stars: 3 }, items);
    expect(r.prize).toBeUndefined();
    expect(r.progress.perfect).toBe(1);
  });

  it('games without levels still count games and prizes', () => {
    const r = recordResult(freshGame(), { level: 0, stars: 3 }, items);
    expect(r.progress.best).toEqual([]);
    expect(r.prize).toBe('a');
  });

  it('survives broken saves', () => {
    expect(parseGame(null)).toEqual(freshGame());
    expect(parseGame({ best: [5, -1, 'x'], prizes: ['a', 'a', 3], played: -2 })).toEqual({ ...freshGame(), best: [3, 0, 0], prizes: ['a'] });
    expect(parseAll('junk')).toEqual({});
  });

  it('stars from the share of right answers', () => {
    expect([starsFor(9, 10), starsFor(7, 10), starsFor(3, 10), starsFor(0, 0)]).toEqual([3, 2, 1, 1]);
  });
});

describe('collections', () => {
  it('every collection belongs to a game on the menu and every stickered word has a picture and a clip', () => {
    const clips = allClips([]);
    for (const [game, col] of Object.entries(COLLECTIONS)) {
      expect(GAMES.some((g) => g.id === game), game).toBe(true);
      expect(new Set(col.items).size, game).toBe(col.items.length);
      if (col.kind !== 'sticker') continue;
      for (const id of col.items) {
        expect(existsSync(`public/snake/${id}.webp`), `${game}: ${id}`).toBe(true);
        expect(ENGLISH[id], id).toBeDefined();
        expect(clips.has(`en.${id}`), id).toBe(true);
      }
    }
  });

  it('every snake skin has its English line', () => {
    const words = content.english.words as Record<string, string>;
    for (const [id, text] of Object.entries(englishLines())) expect(words[id], id).toBe(text);
    expect(skinById(undefined).id).toBe(STARTER_SKIN);
    expect(COLLECTIONS.snake!.items).not.toContain(STARTER_SKIN);
    expect(COLLECTIONS.snake!.items.length).toBe(SKINS.length - 1);
  });

  it('every game with levels on the results ladder is a menu game', () => {
    for (const [game, n] of Object.entries(LEVELS)) {
      expect(GAMES.some((g) => g.id === game), game).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });
});
