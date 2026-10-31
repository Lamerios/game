export type SkillId = 'reading' | 'math' | 'algo' | 'chess' | 'writing';

export const SKILLS: readonly SkillId[] = ['reading', 'math', 'algo', 'chess', 'writing'];

/** Result of one task. Weighted 1 / 0.5 / 0 by the adaptivity engine. */
export type Outcome = 'first_try' | 'with_hint' | 'shown';

export interface Review {
  level: number;
  /** Epoch ms when this review becomes due. */
  dueAt: number;
  /** Index into REVIEW_INTERVALS_DAYS. */
  step: number;
}

export interface SkillState {
  level: number;
  maxLevel: number;
  window: Outcome[];
  reviewQueue: Review[];
  /** Epoch ms of the last task in this skill, 0 if never played. */
  lastPlayedAt: number;
}

export interface Settings {
  sessionMinutes: number;
  sessionsPerDay: number;
  cooldownHours: number;
  sound: boolean;
}

export interface SessionTask {
  skill: SkillId;
  level: number;
  isReview: boolean;
}

export interface SessionState {
  islandIndex: number;
  startedAt: number;
  tasks: SessionTask[];
  /** How many tasks from `tasks` are done. */
  done: number;
}

export interface Profile {
  schemaVersion: 1;
  childName: string;
  avatar: { look: string; sailColor: string };
  skills: Record<SkillId, SkillState>;
  route: { ocean: 'atlantic'; islandIndex: number; branchChoices: string[] };
  inventory: Record<string, number>;
  /** Epoch ms of finished sessions, used for the daily limit and cooldown. */
  sessionLog: number[];
  settings: Settings;
  currentSession?: SessionState;
  /** True until the first (calibration) session is finished. */
  calibrating: boolean;
}

export interface AttemptLog {
  ts: number;
  skill: SkillId;
  level: number;
  itemId: string;
  outcome: Outcome;
  hintsUsed: number;
  durationMs: number;
}
