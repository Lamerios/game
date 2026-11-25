import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  byLevel, COLORS, LEVEL_LISTS, levelForStage, levelOf, NUMBERS, PICTURES, THEMES, themeWords, upToLevel, WORDS, type ThemeId,
} from '../src/core/dictionary';
import { ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import { planGame } from '../src/games/snake/logic';

describe('dictionary', () => {
  it('has unique ids, an English text and a picture for every word', () => {
    const ids = WORDS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of PICTURES) {
      expect(ENGLISH[w.id], w.id).toBeTruthy();
      expect(existsSync(join(__dirname, '..', 'public', 'snake', `${w.id}.webp`)), w.id).toBe(true);
      expect(w.ru, w.id).toBeTruthy();
    }
    expect(PICTURES.length).toBeGreaterThanOrEqual(330);
  });

  it('level lists name real words, and every level has plenty of them', () => {
    for (const id of [...LEVEL_LISTS.basic, ...LEVEL_LISTS.hard]) expect(WORDS.some((w) => w.id === id), id).toBe(true);
    for (const l of [1, 2, 3] as const) expect(PICTURES.filter((w) => w.level === l).length, `level ${l}`).toBeGreaterThanOrEqual(40);
    expect(levelOf('cat')).toBe(1);
    expect(levelOf('jellyfish')).toBe(3);
    expect(levelOf('n7')).toBe(1);
    expect(levelOf('n30')).toBe(3);
    expect(COLORS.find((c) => c.id === 'c-red')!.level).toBe(1);
    expect(NUMBERS.every((n) => n.level >= 1 && n.level <= 3)).toBe(true);
  });

  it('sorts easy words first and filters by level', () => {
    const sorted = byLevel(PICTURES);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.level).toBeGreaterThanOrEqual(sorted[i - 1]!.level);
    expect(upToLevel(PICTURES, 1).every((w) => w.level === 1)).toBe(true);
    expect([1, 2, 3, 4, 5, 6].map(levelForStage)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('themes are made of real words and are big enough to play', () => {
    for (const [id, t] of Object.entries(THEMES)) {
      for (const w of t.ids) expect(PICTURES.some((p) => p.id === w), `${id}: ${w}`).toBe(true);
      expect(themeWords(id as ThemeId).length, id).toBeGreaterThanOrEqual(10);
    }
    expect(themeWords('sea').map((w) => w.id)).toContain('anchor');
  });

  it('a new player meets first words before hard ones in Snake', () => {
    const ids = planGame('words', {}, 10, mulberry32(3));
    const fresh = ids.map(levelOf);
    expect(fresh.filter((l) => l === 3)).toEqual([]);
  });
});
