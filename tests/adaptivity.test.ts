import { describe, expect, it } from 'vitest';
import {
  dueReviews,
  recordOutcome,
  recordReview,
  REVIEW_INTERVALS_DAYS,
  score,
  setLevel,
} from '../src/core/adaptivity';
import type { Outcome, SkillState } from '../src/core/types';

const DAY = 24 * 60 * 60 * 1000;
const base = (level = 2): SkillState => ({
  level,
  maxLevel: 5,
  window: [],
  reviewQueue: [],
  lastPlayedAt: 0,
});

function play(state: SkillState, outcomes: Outcome[], now = 0, calibrating = false) {
  let s = state;
  const changes: string[] = [];
  for (const o of outcomes) {
    const r = recordOutcome(s, o, now, calibrating);
    s = r.state;
    changes.push(r.change);
  }
  return { s, changes };
}

describe('score', () => {
  it('weights outcomes 1 / 0.5 / 0', () => {
    expect(score(['first_try', 'with_hint', 'shown', 'first_try'])).toBe(0.625);
    expect(score([])).toBe(0);
  });
});

describe('recordOutcome', () => {
  it('does not change level before enough samples', () => {
    const { s, changes } = play(base(), Array(5).fill('first_try'));
    expect(s.level).toBe(2);
    expect(changes.every((c) => c === 'none')).toBe(true);
  });

  it('levels up at >90% and schedules a review of the passed level', () => {
    const { s, changes } = play(base(), Array(6).fill('first_try'), 1000);
    expect(changes.at(-1)).toBe('up');
    expect(s.level).toBe(3);
    expect(s.window).toEqual([]);
    expect(s.reviewQueue).toEqual([{ level: 2, step: 0, dueAt: 1000 + DAY }]);
  });

  it('levels down below 65% but never under 1', () => {
    const { s } = play(base(2), Array(6).fill('shown'));
    expect(s.level).toBe(1);
    const again = play(s, Array(10).fill('shown')).s;
    expect(again.level).toBe(1);
  });

  it('stays on level inside the 65–90% corridor', () => {
    const mix: Outcome[] = ['first_try', 'first_try', 'first_try', 'with_hint', 'first_try', 'with_hint'];
    const { s } = play(base(), mix); // score = 5/6 ≈ 0.83
    expect(s.level).toBe(2);
  });

  it('does not go above maxLevel', () => {
    const { s } = play(base(5), Array(10).fill('first_try'));
    expect(s.level).toBe(5);
  });

  it('decides after 3 samples while calibrating', () => {
    const { s } = play(base(), Array(3).fill('first_try'), 0, true);
    expect(s.level).toBe(3);
  });

  it('simulated 95% accuracy climbs, 50% falls (acceptance criterion)', () => {
    const rng = mulberry32(42);
    const sim = (p: number, start: number) =>
      play(base(start), Array.from({ length: 60 }, () => (rng() < p ? 'first_try' : 'shown'))).s.level;
    expect(sim(0.97, 1)).toBeGreaterThanOrEqual(4);
    expect(sim(0.5, 5)).toBeLessThanOrEqual(2);
  });
});

describe('reviews', () => {
  it('advances through 1, 3, 7, 14 days and then drops', () => {
    let s: SkillState = { ...base(3), reviewQueue: [{ level: 2, step: 0, dueAt: DAY }] };
    let now = DAY;
    for (let i = 1; i < REVIEW_INTERVALS_DAYS.length; i++) {
      s = recordReview(s, 2, 'first_try', now);
      expect(s.reviewQueue[0]!.step).toBe(i);
      expect(s.reviewQueue[0]!.dueAt).toBe(now + REVIEW_INTERVALS_DAYS[i]! * DAY);
      now = s.reviewQueue[0]!.dueAt;
    }
    s = recordReview(s, 2, 'first_try', now);
    expect(s.reviewQueue).toEqual([]);
  });

  it('a failed review restarts at 1 day', () => {
    const s0: SkillState = { ...base(3), reviewQueue: [{ level: 2, step: 2, dueAt: 10 }] };
    const s = recordReview(s0, 2, 'shown', 10);
    expect(s.reviewQueue).toEqual([{ level: 2, step: 0, dueAt: 10 + DAY }]);
  });

  it('only due reviews are returned', () => {
    const s: SkillState = { ...base(), reviewQueue: [{ level: 1, step: 0, dueAt: 5 }, { level: 2, step: 0, dueAt: 50 }] };
    expect(dueReviews(s, 10).map((r) => r.level)).toEqual([1]);
  });
});

describe('setLevel', () => {
  it('clamps and clears window', () => {
    const s = setLevel({ ...base(), window: ['shown'] }, 99);
    expect(s.level).toBe(5);
    expect(s.window).toEqual([]);
  });
});

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
