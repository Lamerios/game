import type { Outcome } from '../../core/types';

/** Hint ladder from SDD 3.7: repeat → leading hint → first step → show solution. */
export type HintStep = 0 | 1 | 2 | 3 | 4;

export const LOCK_AFTER_FORCED_HINT_MS = 1500;

/**
 * Tracks one task attempt: mistakes, the hint ladder and the final outcome.
 * Pure state machine so every mini-game scores the same way.
 */
export class Attempt {
  private mistakes = 0;
  private streak = 0;
  hint: HintStep = 0;
  readonly startedAt: number;

  constructor(now: number) {
    this.startedAt = now;
  }

  /** Records a wrong answer. Returns the hint step to show now. */
  wrong(): { hint: HintStep; lock: boolean } {
    this.mistakes++;
    this.streak++;
    const forced = this.streak >= 2;
    if (forced) this.streak = 0;
    this.hint = Math.min(4, this.hint + 1) as HintStep;
    return { hint: this.hint, lock: forced };
  }

  /** The child asked for help (tapped the parrot): climb one step without counting a mistake. */
  askHelp(): HintStep {
    this.hint = Math.min(4, this.hint + 1) as HintStep;
    return this.hint;
  }

  get hintsUsed(): number {
    return this.hint;
  }

  get solutionShown(): boolean {
    return this.hint >= 4;
  }

  outcome(): Outcome {
    if (this.solutionShown) return 'shown';
    if (this.mistakes === 0 && this.hint === 0) return 'first_try';
    return 'with_hint';
  }
}
