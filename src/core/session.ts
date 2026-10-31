import { dueReviews, score } from './adaptivity';
import type { Profile, SessionState, SessionTask, SkillId } from './types';

/**
 * Skills that appear as island tasks. "algo" is the sea crossing between
 * islands and "writing" is the ship's log at the end, so both run on top of
 * these (SDD section 5).
 */
export const ISLAND_SKILLS: readonly SkillId[] = ['reading', 'math', 'chess'];
export const TASKS_PER_ISLAND = 3;
export const CALIBRATION_SESSIONS = 3;

const HOUR_MS = 60 * 60 * 1000;

/** Builds the task list for the next island. Pure: same input, same output. */
export function buildIsland(profile: Profile, now: number, focus?: SkillId): SessionTask[] {
  const base = buildBase(profile, now);
  if (!focus) return base;
  // "Star" task: the island's main skill one level up, placed before the last
  // (easiest) task so the session still ends on a success.
  const st = profile.skills[focus];
  const star: SessionTask = { skill: focus, level: Math.min(st.maxLevel, st.level + 1), isReview: false, star: true };
  return [...base.slice(0, -1), star, ...base.slice(-1)];
}

function buildBase(profile: Profile, now: number): SessionTask[] {
  const skills = [...ISLAND_SKILLS];
  const count = Math.min(TASKS_PER_ISLAND, skills.length);

  // Longest-unplayed first.
  skills.sort((a, b) => profile.skills[a].lastPlayedAt - profile.skills[b].lastPlayedAt);
  const chosen = skills.slice(0, count);

  // Strongest skill goes last so the session ends on a success.
  const strongest = [...chosen].sort(
    (a, b) => score(profile.skills[b].window) - score(profile.skills[a].window),
  )[0]!;
  const ordered = [...chosen.filter((s) => s !== strongest), strongest];

  // At most one overdue review per island; it replaces that skill's regular task.
  let reviewUsed = false;
  return ordered.map((skill, i): SessionTask => {
    const st = profile.skills[skill];
    if (!reviewUsed) {
      const review = dueReviews(st, now).sort((a, b) => a.dueAt - b.dueAt)[0];
      if (review) {
        reviewUsed = true;
        return { skill, level: review.level, isReview: true };
      }
    }
    // Warm-up: first task one level below current.
    const level = i === 0 ? Math.max(1, st.level - 1) : st.level;
    return { skill, level, isReview: false };
  });
}

export function startSession(profile: Profile, now: number, focus?: SkillId): SessionState {
  return {
    islandIndex: profile.route.islandIndex,
    startedAt: now,
    tasks: buildIsland(profile, now, focus),
    done: 0,
  };
}

function sameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export type Gate =
  | { allowed: true }
  | { allowed: false; reason: 'daily_limit' }
  | { allowed: false; reason: 'cooldown'; availableAt: number };

/** Whether a new session may start now, per the parent's limits. */
export function canStartSession(profile: Profile, now: number): Gate {
  if (profile.currentSession) return { allowed: true }; // resume is always allowed
  const { sessionsPerDay, cooldownHours } = profile.settings;
  const today = profile.sessionLog.filter((t) => sameLocalDay(t, now));
  if (today.length >= sessionsPerDay) return { allowed: false, reason: 'daily_limit' };
  const last = profile.sessionLog.length ? Math.max(...profile.sessionLog) : undefined;
  if (last !== undefined) {
    const availableAt = last + cooldownHours * HOUR_MS;
    if (now < availableAt) return { allowed: false, reason: 'cooldown', availableAt };
  }
  return { allowed: true };
}

/** Whether the session's time budget is used up (finish the current task, then "Night"). */
export function isTimeUp(session: SessionState, profile: Profile, now: number): boolean {
  return now - session.startedAt >= profile.settings.sessionMinutes * 60 * 1000;
}

/** Closes the session: logs it, advances the route, clears calibration. */
export function finishSession(profile: Profile, now: number, islandsInOcean = 5): Profile {
  // Calibration runs for the first three sessions: one session gives too few samples per skill.
  const calibrating = profile.sessionLog.length + 1 < CALIBRATION_SESSIONS;
  return {
    ...profile,
    currentSession: undefined,
    calibrating,
    sessionLog: [...profile.sessionLog, now].slice(-50),
    route: {
      ...profile.route,
      islandIndex: Math.min(profile.route.islandIndex + 1, islandsInOcean),
    },
  };
}
