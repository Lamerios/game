import Phaser from 'phaser';
import { nextPraise, voice } from '../../core/audio';
import { mulberry32, type Rng } from './rng';
import type { SessionTask } from '../../core/types';
import type { GameState } from '../../game-state';
import { Attempt, LOCK_AFTER_FORCED_HINT_MS, type HintStep } from './attempt';
import { blocks, COLORS, FONT, W } from '../../scenes/ui';

const PARROT = ['..RR..', '.RRRY.', '.RRR..', 'RRGG..', '.GGG..', '..YY..'];
const PARROT_PALETTE = { R: 0xd62828, Y: 0xfcbf49, G: 0x2a9d8f };

/**
 * Base for every mini-game: parrot (repeat / help), speech bubble, the hint
 * ladder with input lock, and reporting the outcome back to the session.
 */
export abstract class MiniGameScene extends Phaser.Scene {
  protected state!: GameState;
  protected task!: SessionTask;
  protected attempt!: Attempt;
  protected rng!: Rng;
  protected locked = false;
  private bubble?: Phaser.GameObjects.Container;
  private finished = false;

  /** Spoken instruction for the current task. */
  protected abstract instruction(): string;
  /** Show hint step 1..4. Step 4 must lead to `finish()`. */
  protected abstract showHint(step: HintStep): void;
  protected abstract itemId(): string;

  init(data: { task: SessionTask }) {
    this.state = this.registry.get('state') as GameState;
    this.task = data.task;
    this.attempt = new Attempt(Date.now());
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.locked = false;
    this.finished = false;
    this.bubble = undefined;
  }

  protected addParrot() {
    const g = blocks(this, W - 140, 24, PARROT, 16, PARROT_PALETTE);
    const hit = this.add.rectangle(W - 92, 72, 112, 112, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      if (this.locked || this.finished) return;
      // First tap repeats; later taps climb the ladder.
      if (this.attempt.hint === 0 && !this.repeated) {
        this.repeated = true;
        this.say(this.instruction());
      } else {
        this.showHint(this.attempt.askHelp());
      }
    });
    return g;
  }
  private repeated = false;

  protected say(text: string) {
    voice.say(text);
    this.bubble?.destroy();
    const t = this.add.text(0, 0, text, {
      fontFamily: FONT,
      fontSize: '30px',
      color: '#0b2233',
      wordWrap: { width: 340 },
    });
    const pad = 16;
    const bg = this.add
      .rectangle(-pad, -pad, t.width + pad * 2, t.height + pad * 2, COLORS.white)
      .setOrigin(0)
      .setStrokeStyle(4, 0x0b2233);
    // Under the parrot, at the right edge, so it never covers the task itself.
    this.bubble = this.add.container(W - 40 - pad - t.width, 150, [bg, t]).setDepth(10);
  }

  /** Call on a wrong answer. */
  protected wrong() {
    const { hint, lock } = this.attempt.wrong();
    this.cameras.main.shake(150, 0.004);
    this.showHint(hint);
    if (lock && hint < 4) {
      this.locked = true;
      this.time.delayedCall(LOCK_AFTER_FORCED_HINT_MS, () => (this.locked = false));
    }
  }

  /** Call when solved (or after the solution was shown). */
  protected async finish() {
    if (this.finished) return;
    this.finished = true;
    this.locked = true;
    if (!this.attempt.solutionShown) this.say(nextPraise());
    await this.state.completeTask(
      this.attempt.outcome(),
      this.itemId(),
      this.attempt.hintsUsed,
      Date.now() - this.attempt.startedAt,
    );
    this.time.delayedCall(1200, () => this.scene.start('Island'));
  }
}
