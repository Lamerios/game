import Phaser from 'phaser';
import { MiniGameScene } from '../common/MiniGameScene';
import { W } from '../../scenes/ui';

interface Drifter {
  obj: Phaser.GameObjects.Container;
  speed: number;
  baseY: number;
  phase: number;
  /** Distance to jump back to the right when leaving on the left; undefined = remove. */
  loop?: number;
  onGone?: () => void;
}

const LEFT_EDGE = -130;

/**
 * Base of the action stages: things drift right to left over the waves, bobbing,
 * and the child taps them. A missed object is no failure: it just floats on.
 * Played as the episode's sea stage (variant "sea", reported via completeSea)
 * or as an island task (reported as usual).
 */
export abstract class SeaScene extends MiniGameScene {
  protected drifters: Drifter[] = [];

  override init(data: Parameters<MiniGameScene['init']>[0]) {
    super.init(data);
    this.drifters = [];
  }

  protected addDrifter(obj: Phaser.GameObjects.Container, y: number, crossSec: number, opts: { x?: number; loop?: number; onGone?: () => void } = {}) {
    obj.setPosition(opts.x ?? W + 110, y);
    this.drifters.push({ obj, speed: (W + 240) / crossSec, baseY: y, phase: Math.random() * Math.PI * 2, loop: opts.loop, onGone: opts.onGone });
    return obj;
  }

  /** Stops an object drifting (it was caught); the caller animates or destroys it. */
  protected release(obj: Phaser.GameObjects.Container) {
    this.drifters = this.drifters.filter((d) => d.obj !== obj);
    obj.disableInteractive();
  }

  update(time: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    for (const d of [...this.drifters]) {
      d.obj.x -= d.speed * dt;
      d.obj.y = d.baseY + Math.sin(time / 420 + d.phase) * 9;
      if (d.obj.x < LEFT_EDGE) {
        if (d.loop) {
          d.obj.x += d.loop;
        } else {
          this.drifters = this.drifters.filter((x) => x !== d);
          d.obj.destroy();
          d.onGone?.();
        }
      }
    }
  }

  /** Little white waves so the sea moves under the objects. */
  protected waves(y0: number) {
    for (let i = 0; i < 9; i++) {
      const w = this.add.graphics({ x: Phaser.Math.Between(0, W), y: y0 + Phaser.Math.Between(0, 230) });
      w.lineStyle(4, 0xbde0fe, 0.7).beginPath().arc(0, 0, 24, Math.PI * 0.15, Math.PI * 0.85, false).strokePath();
      this.tweens.add({ targets: w, x: w.x - 60, alpha: 0.2, yoyo: true, repeat: -1, duration: 1600 + i * 120, ease: 'Sine.easeInOut' });
    }
  }

  /** Makes a container tappable over its whole area. */
  protected tappable(c: Phaser.GameObjects.Container, w: number, h: number, onTap: () => void) {
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      if (!this.locked) onTap();
    });
    return c;
  }

  protected blink(obj: Phaser.GameObjects.GameObject) {
    this.tweens.add({ targets: obj, alpha: 0.35, yoyo: true, repeat: 5, duration: 220 });
  }

  protected override async report() {
    if (this.task.variant !== 'sea') return super.report();
    await this.state.completeSea(this.task.skill, this.task.level, this.attempt.outcome(), this.itemId(), this.attempt.hintsUsed, Date.now() - this.attempt.startedAt);
  }
}
