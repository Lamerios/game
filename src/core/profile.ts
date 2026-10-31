import { SKILLS, type Profile, type SkillId, type SkillState } from './types';

/** Number of levels per skill in v0.1 (see SDD, section 3). */
export const MAX_LEVELS: Record<SkillId, number> = {
  reading: 5,
  math: 6,
  algo: 5,
  chess: 5,
  writing: 4,
};

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
    SKILLS.map((s) => [s, newSkill(s, clampLevel(s, startLevels[s] ?? 1))]),
  ) as Record<SkillId, SkillState>;
  return {
    schemaVersion: 1,
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
