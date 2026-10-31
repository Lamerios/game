import { SKILLS, type Profile, type SkillId, type SkillState } from './types';

/** Number of levels per skill in v0.1 (see SDD, section 3). */
export const MAX_LEVELS: Record<SkillId, number> = {
  reading: 7,
  math: 7,
  algo: 6,
  chess: 5,
  writing: 4,
};

/**
 * Where a new captain starts (v0.2). The playtest showed level 1 is far too easy
 * for a child who already reads and counts; calibration moves on from here.
 */
export const START_LEVELS: Record<SkillId, number> = {
  reading: 4,
  math: 3,
  algo: 3,
  chess: 2,
  writing: 1,
};

export const DEFAULT_CHILD_NAME = 'Артемий';

export const DEFAULT_SETTINGS = {
  sessionMinutes: 15,
  sessionsPerDay: 2,
  cooldownHours: 2,
  sound: true,
} as const;

function newSkill(skill: SkillId, level = 1): SkillState {
  return { level, maxLevel: MAX_LEVELS[skill], window: [], reviewQueue: [], lastPlayedAt: 0 };
}

export function createProfile(
  childName: string,
  startLevels: Partial<Record<SkillId, number>> = {},
): Profile {
  const skills = Object.fromEntries(
    SKILLS.map((s) => [s, newSkill(s, clampLevel(s, startLevels[s] ?? START_LEVELS[s]))]),
  ) as Record<SkillId, SkillState>;
  return {
    schemaVersion: 2,
    childName,
    avatar: { look: 'default', sailColor: 'white' },
    skills,
    route: { ocean: 'atlantic', islandIndex: 0, branchChoices: [] },
    inventory: {},
    sessionLog: [],
    settings: { ...DEFAULT_SETTINGS },
    calibrating: true,
  };
}

export function clampLevel(skill: SkillId, level: number): number {
  return Math.min(MAX_LEVELS[skill], Math.max(1, Math.round(level)));
}
