import { describe, expect, it } from 'vitest';
import { createProfile } from '../src/core/profile';
import { buildIsland, canStartSession, finishSession, isTimeUp, startSession } from '../src/core/session';

const HOUR = 60 * 60 * 1000;
const NOON = new Date(2026, 9, 31, 12, 0, 0).getTime();

describe('buildIsland', () => {
  it('gives 3 tasks from different skills', () => {
    const tasks = buildIsland(createProfile('Тест'), NOON);
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((t) => t.skill)).size).toBe(3);
  });

  it('first task is one level below current (warm-up), others at current', () => {
    const p = createProfile('Тест', { reading: 3, math: 3, chess: 3 });
    const tasks = buildIsland(p, NOON);
    expect(tasks[0]!.level).toBe(2);
    expect(tasks.slice(1).every((t) => t.level === 3)).toBe(true);
  });

  it('puts the strongest skill last', () => {
    const p = createProfile('Тест');
    p.skills.math.window = ['first_try', 'first_try'];
    p.skills.reading.window = ['shown'];
    expect(buildIsland(p, NOON).at(-1)!.skill).toBe('math');
  });

  it('uses at most one due review', () => {
    const p = createProfile('Тест', { reading: 3, math: 3, chess: 3 });
    p.skills.reading.reviewQueue = [{ level: 2, step: 0, dueAt: 0 }];
    p.skills.math.reviewQueue = [{ level: 1, step: 0, dueAt: 0 }];
    const reviews = buildIsland(p, NOON).filter((t) => t.isReview);
    expect(reviews).toHaveLength(1);
  });
});

describe('canStartSession', () => {
  it('allows the first session', () => {
    expect(canStartSession(createProfile('Тест'), NOON)).toEqual({ allowed: true });
  });

  it('enforces cooldown between sessions', () => {
    const p = { ...createProfile('Тест'), sessionLog: [NOON - HOUR] };
    expect(canStartSession(p, NOON)).toEqual({ allowed: false, reason: 'cooldown', availableAt: NOON + HOUR });
    expect(canStartSession(p, NOON + HOUR)).toEqual({ allowed: true });
  });

  it('enforces the daily limit', () => {
    const p = { ...createProfile('Тест'), sessionLog: [NOON - 4 * HOUR, NOON - 3 * HOUR] };
    expect(canStartSession(p, NOON)).toEqual({ allowed: false, reason: 'daily_limit' });
  });

  it('always allows resuming an unfinished session', () => {
    const p = createProfile('Тест');
    p.sessionLog = [NOON - 4 * HOUR, NOON - 3 * HOUR];
    p.currentSession = startSession(p, NOON);
    expect(canStartSession(p, NOON).allowed).toBe(true);
  });
});

describe('session lifecycle', () => {
  it('times out after sessionMinutes', () => {
    const p = createProfile('Тест');
    const s = startSession(p, NOON);
    expect(isTimeUp(s, p, NOON + 14 * 60 * 1000)).toBe(false);
    expect(isTimeUp(s, p, NOON + 15 * 60 * 1000)).toBe(true);
  });

  it('finishSession logs, advances route and ends calibration after three sessions', () => {
    let p = createProfile('Тест');
    p.currentSession = startSession(p, NOON);
    const after = finishSession(p, NOON + 10);
    expect(after.currentSession).toBeUndefined();
    expect(after.calibrating).toBe(true);
    expect(after.sessionLog).toEqual([NOON + 10]);
    expect(after.route.islandIndex).toBe(1);
    p = finishSession(finishSession(after, NOON + 20), NOON + 30);
    expect(p.calibrating).toBe(false);
  });

  it('adds a star task of the focus skill one level up, before the last task', () => {
    const p = createProfile('Тест');
    const tasks = buildIsland(p, NOON, 'reading');
    expect(tasks).toHaveLength(4);
    expect(tasks[2]).toEqual({ skill: 'reading', level: p.skills.reading.level + 1, isReview: false, star: true });
    expect(tasks.filter((t) => t.star)).toHaveLength(1);
  });
});
