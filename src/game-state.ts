import { recordOutcome, recordReview } from './core/adaptivity';
import { createProfile } from './core/profile';
import { canStartSession, finishSession, isTimeUp, startSession, type Gate } from './core/session';
import { Storage } from './core/storage';
import type { Outcome, Profile, SessionTask } from './core/types';

/** Thin stateful wrapper the scenes talk to. All rules live in core/. */
export class GameState {
  private constructor(
    private readonly storage: Storage,
    public profile: Profile,
  ) {}

  static async load(storage = new Storage()): Promise<GameState> {
    const profile = (await storage.loadProfile()) ?? createProfile('Юнга');
    return new GameState(storage, profile);
  }

  private save() {
    return this.storage.saveProfile(this.profile);
  }

  gate(now = Date.now()): Gate {
    return canStartSession(this.profile, now);
  }

  async beginOrResume(now = Date.now()) {
    if (!this.profile.currentSession) {
      this.profile = { ...this.profile, currentSession: startSession(this.profile, now) };
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
    const nextSkill = task.isReview
      ? recordReview(skillState, task.level, outcome, now)
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

  timeUp(now = Date.now()) {
    const s = this.profile.currentSession;
    return s ? isTimeUp(s, this.profile, now) : false;
  }

  async finish(now = Date.now()) {
    this.profile = finishSession(this.profile, now);
    await this.save();
  }
}
