import { recordOutcome, recordReview } from './core/adaptivity';
import { createProfile, DEFAULT_CHILD_NAME } from './core/profile';
import { canStartSession, finishSession, isTimeUp, startSession, type Gate } from './core/session';
import { Storage } from './core/storage';
import { setChildName } from './core/phrases';
import { EPISODES, ISLAND_FOCUS, islandOf } from './story/script';
import type { Outcome, Profile, SessionTask, SkillId } from './core/types';

const PARENT_GRANT = 'parentGrant';

/** Thin stateful wrapper the scenes talk to. All rules live in core/. */
export class GameState {
  private constructor(
    private readonly storage: Storage,
    public profile: Profile,
  ) {}

  static async load(storage = new Storage()): Promise<GameState> {
    const profile = (await storage.loadProfile()) ?? createProfile(DEFAULT_CHILD_NAME);
    setChildName(profile.childName);
    return new GameState(storage, profile);
  }

  private save() {
    return this.storage.saveProfile(this.profile);
  }

  gate(now = Date.now()): Gate {
    if (this.seen(PARENT_GRANT)) return { allowed: true };
    return canStartSession(this.profile, now);
  }

  /** A parent let the child play one more session despite the daily limit or the break. */
  async grantSession() {
    await this.markSeen(PARENT_GRANT);
  }

  /** Wipes all progress (parent menu): the season starts again from the prologue. */
  async reset() {
    await this.storage.resetProfile();
    this.profile = createProfile(this.profile.childName);
    await this.save();
  }

  async beginOrResume(now = Date.now()) {
    if (!this.profile.currentSession) {
      const inventory = { ...this.profile.inventory, [PARENT_GRANT]: 0 };
      this.profile = {
        ...this.profile,
        inventory,
        currentSession: startSession(this.profile, now, ISLAND_FOCUS[islandOf(this.profile.route.islandIndex)]),
      };
      await this.save();
    }
    return this.profile.currentSession!;
  }

  currentTask(): SessionTask | undefined {
    const s = this.profile.currentSession;
    return s ? s.tasks[s.done] : undefined;
  }

  async completeTask(outcome: Outcome, itemId: string, hintsUsed: number, durationMs: number, now = Date.now()) {
    const session = this.profile.currentSession;
    const task = this.currentTask();
    if (!session || !task) return;
    const skillState = this.profile.skills[task.skill];
    // A star task is a stretch: success counts towards levelling up, a miss is not held against the level.
    const nextSkill = task.isReview
      ? recordReview(skillState, task.level, outcome, now)
      : task.star && outcome !== 'first_try'
        ? { ...skillState, lastPlayedAt: now }
        : recordOutcome(skillState, outcome, now, this.profile.calibrating).state;
    this.profile = {
      ...this.profile,
      skills: { ...this.profile.skills, [task.skill]: nextSkill },
      currentSession: { ...session, done: session.done + 1 },
    };
    await this.storage.logAttempt({ ts: now, skill: task.skill, level: task.level, itemId, outcome, hintsUsed, durationMs });
    await this.save();
  }

  /** Records the sea crossing (algo skill), which runs on top of the island's tasks. */
  async completeCrossing(outcome: Outcome, itemId: string, hintsUsed: number, durationMs: number, now = Date.now()) {
    const session = this.profile.currentSession;
    if (!session) return;
    const st = this.profile.skills.algo;
    this.profile = {
      ...this.profile,
      skills: { ...this.profile.skills, algo: recordOutcome(st, outcome, now, this.profile.calibrating).state },
      currentSession: { ...session, crossingDone: true },
    };
    await this.storage.logAttempt({ ts: now, skill: 'algo', level: st.level, itemId, outcome, hintsUsed, durationMs });
    await this.save();
  }

  /** Records the action stage on the way (its own skill), which runs on top of the island's tasks. */
  async completeSea(skill: SkillId, level: number, outcome: Outcome, itemId: string, hintsUsed: number, durationMs: number, now = Date.now()) {
    const session = this.profile.currentSession;
    if (!session) return;
    const st = this.profile.skills[skill];
    this.profile = {
      ...this.profile,
      skills: { ...this.profile.skills, [skill]: recordOutcome(st, outcome, now, this.profile.calibrating).state },
      currentSession: { ...session, seaDone: true },
    };
    await this.storage.logAttempt({ ts: now, skill, level, itemId, outcome, hintsUsed, durationMs });
    await this.save();
  }

  /** A task outside the island's list (the chest lock): only the skill's record is updated. */
  async recordExtra(skill: SkillId, level: number, outcome: Outcome, itemId: string, hintsUsed: number, durationMs: number, now = Date.now()) {
    const st = this.profile.skills[skill];
    this.profile = {
      ...this.profile,
      skills: { ...this.profile.skills, [skill]: recordOutcome(st, outcome, now, this.profile.calibrating).state },
    };
    await this.storage.logAttempt({ ts: now, skill, level, itemId, outcome, hintsUsed, durationMs });
    await this.save();
  }

  timeUp(now = Date.now()) {
    const s = this.profile.currentSession;
    return s ? isTimeUp(s, this.profile, now) : false;
  }

  async finish(now = Date.now()) {
    this.profile = finishSession(this.profile, now, EPISODES);
    await this.save();
  }

  /** One-time story beats (the prologue) are remembered in the inventory. */
  seen(key: string): boolean {
    return (this.profile.inventory[key] ?? 0) > 0;
  }

  async markSeen(key: string) {
    this.profile = { ...this.profile, inventory: { ...this.profile.inventory, [key]: 1 } };
    await this.save();
  }

  /** Finished episodes of the season = position on the route. */
  get episode(): number {
    return this.profile.route.islandIndex;
  }
}
