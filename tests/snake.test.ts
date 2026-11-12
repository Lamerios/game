import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allClips, english, ENGLISH, webText } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import {
  distractors, itemsForRound, moveSnake, NUMBERS, numberOf, pickWords, placeItems, planGame, stepHead, WORDS,
} from '../src/games/snake/logic';

describe('snake', () => {
  it('every word has a picture and an English clip', () => {
    const clips = allClips([]);
    for (const w of WORDS) {
      if (w.cat !== 'number') expect(existsSync(join(__dirname, '..', 'public', 'snake', `${w.id}.webp`)), w.id).toBe(true);
      expect(clips.get(`en.${w.id}`), w.id).toBe(ENGLISH[w.id]);
    }
  });

  it('English words go to the English browser voice', () => {
    const u = english('apple');
    expect(u.lang).toBe('en-US');
    expect(webText(u)).toBe('apple');
  });

  it('wraps at the edges and grows only when fed', () => {
    expect(stepHead({ x: 13, y: 2 }, 'right', 14, 10)).toEqual({ x: 0, y: 2 });
    expect(stepHead({ x: 0, y: 0 }, 'up', 14, 10)).toEqual({ x: 0, y: 9 });
    const body = [{ x: 2, y: 0 }, { x: 1, y: 0 }];
    expect(moveSnake(body, 'down', false, 14, 10)).toEqual([{ x: 2, y: 1 }, { x: 2, y: 0 }]);
    expect(moveSnake(body, 'down', true, 14, 10)).toHaveLength(3);
  });

  it('places pictures off the snake, away from its head and from each other', () => {
    const rng = mulberry32(3);
    const body = [{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }];
    for (let i = 0; i < 300; i++) {
      const cells = placeItems(4, body, 'right', 14, 10, rng);
      expect(cells).toHaveLength(4);
      for (const c of cells) {
        expect(body.some((b) => b.x === c.x && b.y === c.y)).toBe(false);
        expect(Math.abs(c.x - 4) + Math.abs(c.y - 5)).toBeGreaterThanOrEqual(3);
        expect(c.y === 5 && c.x > 4 && c.x <= 8).toBe(false);
      }
      for (const a of cells) for (const b of cells) if (a !== b) expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBeGreaterThanOrEqual(2);
    }
  });

  it('picks distinct words, least practised first, and distinct distractors', () => {
    const rng = mulberry32(9);
    const known = Object.fromEntries(WORDS.slice(0, 20).map((w) => [w.id, 5]));
    const words = pickWords(known, 10, rng);
    expect(new Set(words).size).toBe(10);
    expect(words.every((id) => !(id in known))).toBe(true);
    for (let round = 0; round < 10; round++) {
      const k = itemsForRound(round) - 1;
      const d = distractors(words[round]!, k, round, rng);
      expect(d).toHaveLength(k);
      expect(new Set([words[round], ...d]).size).toBe(k + 1);
    }
  });

  it('numbers: 0–20 and the tens, in English and Russian', () => {
    expect(NUMBERS.map((w) => numberOf(w.id))).toEqual([...Array.from({ length: 21 }, (_, i) => i), 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(ENGLISH.n13).toBe('thirteen');
    expect(ENGLISH.n100).toBe('one hundred');
    expect(NUMBERS.find((w) => w.id === 'n7')!.ru).toBe('семь');
  });

  it('plans a game of the chosen kind, and numbers only meet numbers', () => {
    const rng = mulberry32(5);
    for (let g = 0; g < 50; g++) {
      const nums = planGame('numbers', {}, 10, rng);
      expect(nums.every((id) => numberOf(id) !== undefined)).toBe(true);
      expect(planGame('words', {}, 10, rng).every((id) => numberOf(id) === undefined)).toBe(true);
      const mix = planGame('mix', {}, 10, rng);
      expect(new Set(mix).size).toBe(10);
      expect(mix.filter((id) => numberOf(id) !== undefined)).toHaveLength(4);
      for (const id of [...nums, ...mix]) {
        const d = distractors(id, 3, 8, rng);
        expect(d.every((x) => (numberOf(x) !== undefined) === (numberOf(id) !== undefined))).toBe(true);
      }
    }
    // Later rounds put the sound-alike next to it.
    expect(distractors('n13', 3, 6, rng)).toContain('n30');
    expect(distractors('n6', 3, 6, rng)).toContain('n16');
  });
});
