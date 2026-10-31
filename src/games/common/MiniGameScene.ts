import Phaser from 'phaser';
import { nextPraise, voice } from '../../core/audio';
import type { Utterance } from '../../core/phrases';
import { mulberry32, type Rng } from './rng';
import type { SessionTask } from '../../core/types';
import type { GameState } from '../../game-state';
import { Attempt, LOCK_AFTER_FORCED_HINT_MS, type HintStep } from './attempt';
import { COLORS, FONT, W } from '../../scenes/ui';


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
  /** Max text width of the parrot's bubble; scenes with a busy right side make it narrower. */
  protected bubbleWidth = 340;
  private finished = false;

  /** Spoken instruction for the current task. */
  protected abstract instruction(): Utterance | string;
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
    this.repeated = false;
    this.instructionOnScreen = false;
  }

  protected addParrot() {
    const g = this.add.image(W - 84, 74, 'char-rumb').setDisplaySize(130, 130).setDepth(9);
    this.tweens.add({ targets: g, angle: 4, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    if (this.task.star) {
      this.add
        .text(20, 680, '★ Задача со звёздочкой', { fontFamily: FONT, fontSize: '26px', color: '#3d2b1f', backgroundColor: '#ffd166', padding: { x: 10, y: 4 } })
        .setDepth(9);
    }
    const hit = this.add.rectangle(W - 84, 74, 130, 130, 0, 0).setInteractive({ useHandCursor: true }).setDepth(9);
    hit.on('pointerup', () => {
      if (this.locked || this.finished) return;
      // First tap repeats; later taps climb the ladder.
      if (this.attempt.hint === 0 && !this.repeated) {
        this.repeated = true;
        this.say(this.instruction(), !this.instructionOnScreen);
      } else {
        this.showHint(this.attempt.askHelp());
      }
    });
    return g;
  }
  private repeated = false;
  /** The instruction is already printed on screen (e.g. a puzzle's question): voice it without a bubble. */
  protected instructionOnScreen = false;

  /** Speaks a line (phrase from content/phrases.json, or plain text) and shows it in the bubble. */
  protected say(line: Utterance | string, withBubble = true) {
    voice.say(line);
    if (!withBubble) return;
    const text = typeof line === 'string' ? line : line.show;
    this.bubble?.destroy();
    const t = this.add.text(0, 0, text, {
      fontFamily: FONT,
      fontSize: '30px',
      color: '#0b2233',
      wordWrap: { width: this.bubbleWidth },
    });
    const pad = 16;
    const bg = this.add
      .rectangle(-pad, -pad, t.width + pad * 2, t.height + pad * 2, COLORS.white)
      .setOrigin(0)
      .setStrokeStyle(4, 0x0b2233);
    // Under the parrot, at the right edge, so it never covers the task itself.
    const bubble = this.add.container(W - 40 - pad - t.width, 150, [bg, t]).setDepth(10);
    this.bubble = bubble;
    // Fade out so the bubble never blocks the board for long; the parrot repeats on tap.
    this.time.delayedCall(Math.max(4000, text.length * 90), () => {
      if (this.bubble === bubble) this.tweens.add({ targets: bubble, alpha: 0, duration: 300, onComplete: () => bubble.destroy() });
    });
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
    await this.report();
    this.time.delayedCall(1200, () => this.scene.start('Island'));
  }

  /** Stores the outcome. Island tasks go to the session; the crossing overrides this. */
  protected async report() {
    await this.state.completeTask(
      this.attempt.outcome(),
      this.itemId(),
      this.attempt.hintsUsed,
      Date.now() - this.attempt.startedAt,
    );
  }
}
