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
  const next: SkillState = { ...state, window, lastPlayedAt: now };

  // Three shown solutions in a row: too hard right now, no need to wait for a full window.
  if (window.length >= EARLY_DOWN_RUN && window.slice(-EARLY_DOWN_RUN).every((o) => o === 'shown') && state.level > 1) {
    return { state: levelDown(next, state), change: 'down' };
  }

  const needed = calibrating ? MIN_SAMPLES_CALIBRATION : MIN_SAMPLES;
  if (window.length < needed) return { state: next, change: 'none' };

  const s = score(window);
  if (s > LEVEL_UP_THRESHOLD && state.level < state.maxLevel) {
    return { state: levelUp(next, state, window, now), change: 'up' };
  }
  if (s < LEVEL_DOWN_THRESHOLD && state.level > 1) {
    return { state: levelDown(next, state), change: 'down' };
  }
  return { state: next, change: 'none' };
}

/** Three shown solutions in a row → one level back at once. */
export const EARLY_DOWN_RUN = 3;

/**
 * Level up. A flawless window (every task first try) right after another
 * flawless level-up means the child is racing through: skip a level instead
 * of walking every step (smart difficulty, 2026-11-21).
 */
function levelUp(next: SkillState, state: SkillState, window: readonly Outcome[], now: number): SkillState {
  const flawless = window.every((o) => o === 'first_try');
  const momentum = state.momentum ?? 0;
  const step = flawless && momentum >= 1 ? 2 : 1;
  const level = Math.min(state.maxLevel, state.level + step);
  return {
    ...next,
    level,
    window: [],
    momentum: flawless ? momentum + 1 : 0,
    reviewQueue: [...next.reviewQueue, scheduleReview(state.level, 0, now)],
  };
}

function levelDown(next: SkillState, state: SkillState): SkillState {
  return { ...next, level: state.level - 1, window: [], momentum: 0 };
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
  return { ...state, level: clamped, window: [], momentum: 0 };
}

/**
 * Faster rule for the short action stages (barrels, gulls, buoys): three clean
 * wins in a row → next level, two shown solutions in a row → one level back.
 * Keeps the child near the ~85 % sweet spot (Wilson et al., 2019) without
 * waiting for a full window of six. Falls back to the usual rule otherwise.
 */
export function recordFastOutcome(
  state: SkillState,
  outcome: Outcome,
  now: number,
  calibrating = false,
): { state: SkillState; change: LevelChange } {
  const window = [...state.window, outcome].slice(-WINDOW_SIZE);
  const next: SkillState = { ...state, window, lastPlayedAt: now };
  const last = window.slice(-3);
  if (last.length === 3 && last.every((o) => o === 'first_try') && state.level < state.maxLevel) {
    return { state: levelUp(next, state, window, now), change: 'up' };
  }
  const two = window.slice(-2);
  if (two.length === 2 && two.every((o) => o === 'shown') && state.level > 1) {
    return { state: levelDown(next, state), change: 'down' };
  }
  return recordOutcome(state, outcome, now, calibrating);
}
