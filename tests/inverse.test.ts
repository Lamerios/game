import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import {
  englishLines, expected, freshProgress, isRight, LEVELS, MAX_LEVEL, parseProgress, planGame, recordGame, starsFor, switches,
} from '../src/games/inverse/logic';

describe('inverse («Наоборот, юнга!»)', () => {
  it('maps flags to the expected key', () => {
    expect(expected('left', 'white')).toBe('left');
    expect(expected('left', 'black')).toBe('right');
    expect(expected('up', 'black')).toBe('down');
    expect(expected('up', 'red')).toBeNull();
    expect(isRight({ kind: 'dir', dir: 'right', flag: 'red', late: false }, null)).toBe(true);
    expect(isRight({ kind: 'dir', dir: 'right', flag: 'red', late: false }, 'right')).toBe(false);
  });

  it('every game has both rules, a switch, two body commands and a storm; no-go from level 3', () => {
    const rng = mulberry32(5);
    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (let k = 0; k < 50; k++) {
        const steps = planGame(level, rng);
        const dirs = steps.filter((s) => s.kind === 'dir');
        const flags = new Set(dirs.map((s) => s.flag));
        expect(flags.has('white') && flags.has('black')).toBe(true);
        expect(flags.has('red')).toBe(LEVELS[level]!.noGo);
        expect(switches(steps).length).toBeGreaterThan(0);
        expect(steps.filter((s) => s.kind === 'body')).toHaveLength(2);
        expect(steps.filter((s) => s.kind === 'storm')).toHaveLength(1);
        for (const d of dirs) expect(LEVELS[level]!.dirs).toContain(d.dir);
        // Never the same direction twice in a row.
        for (let i = 1; i < dirs.length; i++) expect(dirs[i]!.dir).not.toBe(dirs[i - 1]!.dir);
        // Never two no-go commands in a row.
        for (let i = 1; i < dirs.length; i++) expect(dirs[i]!.flag === 'red' && dirs[i - 1]!.flag === 'red').toBe(false);
      }
    }
  });

  it('adapts the level: ≥ 90 % up, < 65 % down', () => {
    const p = freshProgress();
    expect(recordGame(p, 13, 14).progress.level).toBe(2);
    expect(recordGame({ ...p, level: 3 }, 8, 14).progress.level).toBe(2);
    expect(recordGame({ ...p, level: 3 }, 11, 14).change).toBe('none');
    expect(recordGame({ ...p, level: MAX_LEVEL }, 14, 14).progress.level).toBe(MAX_LEVEL);
    expect(parseProgress({ level: 9 }).level).toBe(1);
    expect(parseProgress('x')).toEqual(freshProgress());
  });

  it('always gives at least one star for finishing', () => {
    expect([0, 7, 10, 13].map((r) => starsFor(r, 14))).toEqual([1, 1, 2, 3]);
  });

  it('has a clip for every English command and every Russian line', () => {
    const clips = allClips([]);
    for (const [id, text] of Object.entries(englishLines())) {
      expect(ENGLISH[id], id).toBe(text);
      expect(clips.get(`en.${id}`), id).toBe(text);
    }
    const ph = content.phrases as Record<string, string>;
    const ids = ['hello', 'again', 'white', 'black', 'red', 'mixed', 'late', 'body', 'storm', 'wrong.white', 'wrong.black', 'wrong.red', 'slow', 'done', 'levelup', 'leveldown'];
    for (let i = 0; i < 4; i++) ids.push(`good.${i}`);
    for (let i = 1; i <= 3; i++) ids.push(`end.${i}`);
    for (const id of ids) expect(ph[`rumb.inverse.${id}`], id).toBeDefined();
  });
});
