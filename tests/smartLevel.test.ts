import { describe, expect, it } from 'vitest';
import { decideLevel, emptyMemory, levelNote, longestStreak, median, statsFromRun, type LevelMemory, type LevelRules } from '../src/core/smartLevel';
import { recordFastOutcome, recordOutcome } from '../src/core/adaptivity';
import type { Outcome, SkillState } from '../src/core/types';

const R: LevelRules = { maxLevel: 10 };
const ms = (n: number, each: number) => Array(n).fill(each) as number[];

describe('helpers', () => {
  it('median and streak', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeUndefined();
    expect(longestStreak([true, true, false, true, true, true])).toBe(3);
  });

  it('statsFromRun takes times and the first-try streak from the run', () => {
    const run = { results: () => [true, true, false, true].map((firstTry, i) => ({ correct: firstTry, firstTry, ms: 1000 + i })) };
    expect(statsFromRun(run, 3, 4)).toEqual({ right: 3, total: 4, ms: [1000, 1001, 1002, 1003], streak: 2 });
  });
});

describe('decideLevel', () => {
  it('goes up one level at ≥ 90 %', () => {
    const d = decideLevel(3, { right: 9, total: 10 }, emptyMemory(), R);
    expect(d.level).toBe(4);
    expect(d.reason).toBe('up');
  });

  it('skips a level when perfect and fast for the game', () => {
    const d = decideLevel(3, { right: 10, total: 10, ms: ms(10, 1500) }, emptyMemory(), { ...R, fastMs: 2000 });
    expect(d.level).toBe(5);
    expect(d.reason).toBe('skip');
  });

  it('skips when perfect and faster than own pace on this level', () => {
    let mem: LevelMemory = emptyMemory();
    mem = decideLevel(3, { right: 7, total: 10, ms: ms(10, 4000) }, mem, R).memory;
    const d = decideLevel(3, { right: 10, total: 10, ms: ms(10, 2500) }, mem, R);
    expect(d.fast).toBe(true);
    expect(d.change).toBe(2);
  });

  it('skips when as fast on a new level as on the easier ones', () => {
    let mem: LevelMemory = emptyMemory();
    mem = decideLevel(2, { right: 8, total: 10, ms: ms(10, 3000) }, mem, R).memory;
    mem = decideLevel(2, { right: 8, total: 10, ms: ms(10, 3000) }, mem, R).memory;
    const d = decideLevel(3, { right: 10, total: 10, ms: ms(10, 2900) }, mem, R);
    expect(d.reason).toBe('skip');
  });

  it('skips on momentum: two flawless games in a row', () => {
    const first = decideLevel(2, { right: 10, total: 10 }, emptyMemory(), R);
    expect(first.level).toBe(3);
    const second = decideLevel(3, { right: 10, total: 10 }, first.memory, R);
    expect(second.level).toBe(5);
    expect(levelNote(3, second)).toBe('Перескок! Уровень 3 → 5');
  });

  it('skips on a long first-try streak in one game', () => {
    expect(decideLevel(2, { right: 10, total: 10, streak: 10 }, emptyMemory(), R).change).toBe(2);
    expect(decideLevel(2, { right: 10, total: 10, streak: 5 }, emptyMemory(), R).change).toBe(1);
  });

  it('holds the level when right but very slow', () => {
    const d = decideLevel(3, { right: 9, total: 10, ms: ms(10, 9000) }, emptyMemory(), { ...R, fastMs: 2000 });
    expect(d.reason).toBe('steady');
    expect(d.level).toBe(3);
  });

  it('drops two levels after a very bad game, one after a bad one', () => {
    expect(decideLevel(5, { right: 3, total: 10 }, emptyMemory(), R).level).toBe(3);
    expect(decideLevel(5, { right: 5, total: 10 }, emptyMemory(), R).level).toBe(4);
  });

  it('steps back after two shaky games in a row on the same level', () => {
    const a = decideLevel(5, { right: 7, total: 10 }, emptyMemory(), R);
    expect(a.change).toBe(0);
    const b = decideLevel(5, { right: 7, total: 10 }, a.memory, R);
    expect(b.reason).toBe('shaky');
    expect(b.level).toBe(4);
  });

  it('stays inside the level range', () => {
    expect(decideLevel(9, { right: 10, total: 10, streak: 10 }, emptyMemory(), R).level).toBe(10);
    expect(decideLevel(1, { right: 0, total: 10 }, emptyMemory(), R).level).toBe(1);
    expect(decideLevel(3, { right: 0, total: 0 }, emptyMemory(), R).level).toBe(3);
  });

  it('keeps only the last runs in memory', () => {
    let mem = emptyMemory();
    for (let i = 0; i < 20; i++) mem = decideLevel(3, { right: 8, total: 10 }, mem, R).memory;
    expect(mem.runs.length).toBe(8);
  });
});

describe('voyage skills: skip after two flawless level-ups', () => {
  const base = (): SkillState => ({ level: 1, maxLevel: 6, window: [], reviewQueue: [], lastPlayedAt: 0 });
  const play = (s: SkillState, os: Outcome[], fast = false) => {
    for (const o of os) s = (fast ? recordFastOutcome : recordOutcome)(s, o, 0).state;
    return s;
  };

  it('first flawless up is +1, the next flawless up is +2', () => {
    let s = play(base(), Array(6).fill('first_try'));
    expect(s.level).toBe(2);
    s = play(s, Array(6).fill('first_try'));
    expect(s.level).toBe(4);
  });

  it('a mistake on the way breaks the momentum', () => {
    let s = play(base(), Array(6).fill('first_try'));
    s = play(s, ['with_hint', ...Array(6).fill('first_try')]);
    expect(s.level).toBe(3);
    expect(s.momentum).toBe(0);
  });

  it('three shown solutions in a row step back at once', () => {
    const s = play({ ...base(), level: 4 }, ['shown', 'shown', 'shown']);
    expect(s.level).toBe(3);
  });

  it('action stages skip too', () => {
    let s = play(base(), Array(3).fill('first_try'), true);
    expect(s.level).toBe(2);
    s = play(s, Array(3).fill('first_try'), true);
    expect(s.level).toBe(4);
  });
});
