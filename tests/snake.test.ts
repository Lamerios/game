import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allClips, english, ENGLISH, webText } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import {
  COLORS, distractors, itemsForRound, NEW_PER_GAME, moveSnake, NUMBERS, numberOf, pickWords, placeItems, planGame, stepHead, WORDS,
} from '../src/games/snake/logic';

describe('snake', () => {
  it('every word has a picture and an English clip', () => {
    const clips = allClips([]);
    for (const w of WORDS) {
      if (w.cat !== 'number' && w.cat !== 'color') expect(existsSync(join(__dirname, '..', 'public', 'snake', `${w.id}.webp`)), w.id).toBe(true);
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

  it('a few new words per game among ones being learnt, then review', () => {
    const rng = mulberry32(9);
    const ids = WORDS.filter((w) => w.cat !== 'number').map((w) => w.id);
    // Fresh start: ten words, basic ones first.
    const first = planGame('words', {}, 10, rng);
    expect(new Set(first).size).toBe(10);
    // Some learnt, some in progress: four new, the rest from those in progress.
    const stats: Record<string, number> = {};
    ids.slice(0, 10).forEach((id) => (stats[id] = 5));
    ids.slice(10, 30).forEach((id) => (stats[id] = 1));
    const next = pickWords(stats, 10, rng, WORDS.filter((w) => w.cat !== 'number'));
    expect(next.filter((id) => !(id in stats))).toHaveLength(NEW_PER_GAME);
    expect(next.filter((id) => stats[id] === 1)).toHaveLength(10 - NEW_PER_GAME);
    for (let round = 0; round < 10; round++) {
      const k = itemsForRound(round) - 1;
      const d = distractors(next[round]!, k, round, rng);
      expect(d).toHaveLength(k);
      expect(new Set([next[round], ...d]).size).toBe(k + 1);
    }
  });

  it('colours meet only colours', () => {
    const rng = mulberry32(2);
    for (const c of COLORS) {
      expect(ENGLISH[c.id]).toBe(c.id.slice(2));
      expect(distractors(c.id, 3, 8, rng).every((id) => id.startsWith('c-'))).toBe(true);
    }
    expect(distractors('apple', 3, 8, rng).some((id) => id.startsWith('c-') || numberOf(id) !== undefined)).toBe(false);
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

describe('snake: rule and sound rounds', () => {
  it('rule game switches category halfway and keeps the old one as the trap', async () => {
    const { planRules, wordById } = await import('../src/games/snake/logic');
    const { mulberry32 } = await import('../src/games/common/rng');
    const rng = mulberry32(4);
    for (let k = 0; k < 50; k++) {
      const rounds = planRules(rng, 6);
      const first = rounds[0]!.line;
      const last = rounds[5]!.line;
      expect(first).not.toBe(last);
      rounds.forEach((r, i) => {
        const cat = r.line.split('.')[1];
        expect(r.ok).toHaveLength(2);
        for (const id of r.ok) expect(wordById(id).cat).toBe(cat);
        for (const id of r.avoid) expect(wordById(id).cat).not.toBe(cat);
        if (i >= 3) expect(r.avoid.some((id) => `rule.${wordById(id).cat}` === first)).toBe(true);
      });
    }
  });

  it('sound game: one picture starts like the cue (cat and kite alike), the rest do not', async () => {
    const { planSounds, firstSound, multiLines } = await import('../src/games/snake/logic');
    const { ENGLISH } = await import('../src/core/phrases');
    const { mulberry32 } = await import('../src/games/common/rng');
    expect(firstSound('kite')).toBe(firstSound('cat'));
    expect(firstSound('ship')).toBeUndefined();
    for (const [id, text] of Object.entries(multiLines())) expect(ENGLISH[id], id).toBe(text);
    const rng = mulberry32(9);
    for (let k = 0; k < 50; k++) {
      for (const r of planSounds(rng, 10)) {
        const snd = firstSound(r.cue);
        expect(r.ok).toHaveLength(1);
        expect(firstSound(r.ok[0]!)).toBe(snd);
        expect(r.ok).not.toContain(r.cue);
        for (const id of r.avoid) expect(firstSound(id)).not.toBe(snd);
      }
    }
  });

  it('words due in the shared log come first', async () => {
    const { pickWords, PICTURES } = await import('../src/games/snake/logic');
    const { mulberry32 } = await import('../src/games/common/rng');
    const out = pickWords({}, 10, mulberry32(1), PICTURES, ['zebra', 'octopus']);
    expect(out).toContain('zebra');
    expect(out).toContain('octopus');
  });
});

describe('snake: rule card', () => {
  it('the card picture is of the category but not on the board', async () => {
    const { planRules, wordById } = await import('../src/games/snake/logic');
    const { mulberry32 } = await import('../src/games/common/rng');
    const rng = mulberry32(2);
    for (let k = 0; k < 50; k++) for (const r of planRules(rng, 6)) {
      expect(`rule.${wordById(r.cue).cat}`).toBe(r.line);
      expect([...r.ok, ...r.avoid]).not.toContain(r.cue);
    }
  });
});
