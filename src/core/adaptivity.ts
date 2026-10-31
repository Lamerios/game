import type { Outcome, SkillState } from './types';

export const WINDOW_SIZE = 10;
export const MIN_SAMPLES = 6;
export const MIN_SAMPLES_CALIBRATION = 3;
export const LEVEL_UP_THRESHOLD = 0.9;
export const LEVEL_DOWN_THRESHOLD = 0.65;
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const WEIGHT: Record<Outcome, number> = { first_try: 1, with_hint: 0.5, shown: 0 };

export function score(window: readonly Outcome[]): number {
  if (window.length === 0) return 0;
  return window.reduce((sum, o) => sum + WEIGHT[o], 0) / window.length;
}

export type LevelChange = 'up' | 'down' | 'none';

/**
 * Records one outcome on the skill's current level and applies the level rule
 * from SDD section 5. Returns a new state; the input is not mutated.
 */
export function recordOutcome(
  state: SkillState,
  outcome: Outcome,
  now: number,
  calibrating = false,
): { state: SkillState; change: LevelChange } {
  const window = [...state.window, outcome].slice(-WINDOW_SIZE);
  let next: SkillState = { ...state, window, lastPlayedAt: now };

  const needed = calibrating ? MIN_SAMPLES_CALIBRATION : MIN_SAMPLES;
  if (window.length < needed) return { state: next, change: 'none' };

  const s = score(window);
  if (s > LEVEL_UP_THRESHOLD && state.level < state.maxLevel) {
    next = {
      ...next,
      level: state.level + 1,
      window: [],
      reviewQueue: [...next.reviewQueue, scheduleReview(state.level, 0, now)],
    };
    return { state: next, change: 'up' };
  }
  if (s < LEVEL_DOWN_THRESHOLD && state.level > 1) {
    return { state: { ...next, level: state.level - 1, window: [] }, change: 'down' };
  }
  return { state: next, change: 'none' };
}

function scheduleReview(level: number, step: number, now: number) {
  const days = REVIEW_INTERVALS_DAYS[Math.min(step, REVIEW_INTERVALS_DAYS.length - 1)] ?? 1;
  return { level, step, dueAt: now + days * DAY_MS };
}

export function dueReviews(state: SkillState, now: number) {
  return state.reviewQueue.filter((r) => r.dueAt <= now);
}

/**
 * Applies the result of a review task. A failed review ('shown') restarts the
 * interval at 1 day; otherwise the review moves to the next interval, and is
 * dropped after the last one.
 */
export function recordReview(
  state: SkillState,
  level: number,
  outcome: Outcome,
  now: number,
): SkillState {
  const idx = state.reviewQueue.findIndex((r) => r.level === level && r.dueAt <= now);
  if (idx === -1) return state;
  const review = state.reviewQueue[idx]!;
  const rest = state.reviewQueue.filter((_, i) => i !== idx);
  const nextStep = outcome === 'shown' ? 0 : review.step + 1;
  const queue =
    outcome !== 'shown' && nextStep >= REVIEW_INTERVALS_DAYS.length
      ? rest
      : [...rest, scheduleReview(level, nextStep, now)];
  return { ...state, reviewQueue: queue, lastPlayedAt: now };
}

/** Manual level override from the parent panel. Clears the window. */
export function setLevel(state: SkillState, level: number): SkillState {
  const clamped = Math.min(state.maxLevel, Math.max(1, Math.round(level)));
  return { ...state, level: clamped, window: [] };
}
