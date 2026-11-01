import Phaser from 'phaser';
import { phrase } from '../../core/phrases';
import { FONT, W } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { pick } from '../common/rng';
import { generateBarrels, nextBarrel, type BarrelsTask } from './generators';
import { SeaScene } from './SeaScene';

const LANES = [450, 590];
const CELL = 54;
const FRAME_X = 60;
const FRAME_Y = 90;

/**
 * "Бочки за бортом" (math): load exactly N. The hold is a ten-frame (two for
 * N > 10); barrels with 1–9 (dots on low levels) float by; a barrel that would
 * overload the hold does not fit.
 */
export class BarrelsScene extends SeaScene {
  private b!: BarrelsTask;
  private round = 0;
  private loaded = 0;
  private cells: Phaser.GameObjects.Rectangle[] = [];
  private hold?: Phaser.GameObjects.Container;
  private counter?: Phaser.GameObjects.Text;
  private lane = 0;
  private spawner?: Phaser.Time.TimerEvent;

  constructor() {
    super('Barrels');
  }

  protected override bubbleWidth = 300;

  private get target() {
    return this.b.targets[this.round]!;
  }

  protected itemId() {
    return this.b.itemId;
  }

  protected instruction() {
    if (this.round === 0) return phrase('barrels.intro', { n: this.target });
    return phrase('barrels.next', { n: this.target });
  }

  create() {
    this.b = generateBarrels(this.task.level, this.rng);
    this.round = 0;
    this.lane = 0;
    this.add.image(W / 2, 360, 'bg-sea').setDisplaySize(W, 720);
    this.waves(380);
    this.drawHold();
    this.spawner = this.time.addEvent({ delay: (this.b.crossSec * 1000) / 3.6, loop: true, callback: () => this.spawn() });
    this.spawn();
    this.addParrot();
    this.say(this.instruction());
  }

  /** Ten-frame hold. Up to level 4 only the N cells to fill are drawn; later the child works out the rest. */
  private drawHold() {
    this.hold?.destroy();
    this.loaded = 0;
    this.cells = [];
    const n = this.target;
    const frames = n > 10 ? 2 : 1;
    const shown = this.b.level <= 4 ? n : frames * 10;
    const items: Phaser.GameObjects.GameObject[] = [];
    const w = frames * (5 * CELL + 24) + 40;
    items.push(this.add.rectangle(FRAME_X - 20, FRAME_Y - 60, w + 200, 2 * CELL + 100, 0x5c3317, 0.92).setOrigin(0).setStrokeStyle(6, 0x2b2d42));
    items.push(
      this.add.text(FRAME_X, FRAME_Y - 45, `Нужно: ${n}`, { fontFamily: FONT, fontSize: '34px', color: '#ffd166' }),
    );
    for (let i = 0; i < shown; i++) {
      const f = Math.floor(i / 10);
      const k = i % 10;
      const x = FRAME_X + f * (5 * CELL + 24) + (k % 5) * CELL + CELL / 2;
      const y = FRAME_Y + 10 + Math.floor(k / 5) * CELL + CELL / 2;
      const cell = this.add.rectangle(x, y, CELL - 6, CELL - 6, 0x8d5524).setStrokeStyle(3, 0xffd166);
      this.cells.push(cell);
      items.push(cell);
    }
    this.counter = this.add
      .text(FRAME_X + w + 60, FRAME_Y + CELL + 10, '0', { fontFamily: FONT, fontSize: '72px', color: '#ffffff', stroke: '#0b2233', strokeThickness: 8 })
      .setOrigin(0.5);
    items.push(this.counter);
    this.hold = this.add.container(0, 0, items);
  }

  private inAir(): number[] {
    return this.drifters.map((d) => d.obj.getData('value') as number);
  }

  private spawn() {
    if (this.locked) return;
    if (this.drifters.length >= 4) return;
    const left = this.target - this.loaded;
    if (left <= 0) return;
    const v = nextBarrel(this.rng, this.b, left, this.inAir());
    this.addDrifter(this.barrel(v), LANES[this.lane++ % LANES.length]!, this.b.crossSec);
  }

  private barrel(v: number) {
    const color = pick(this.rng, ['red', 'blue', 'green']);
    const img = this.add.image(0, 0, `obj-barrel-${color}`).setDisplaySize(120, 120);
    const label = this.add.circle(0, 0, 36, 0xfff1d0).setStrokeStyle(4, 0x2b2d42);
    const items: Phaser.GameObjects.GameObject[] = [img, label];
    if (this.b.dots) {
      // Dice-like dot patterns: 1–3 can be seen at a glance (subitising).
      const spots: Record<number, [number, number][]> = { 1: [[0, 0]], 2: [[-12, -12], [12, 12]], 3: [[-14, -14], [0, 0], [14, 14]] };
      for (const [dx, dy] of spots[v] ?? []) items.push(this.add.circle(dx, dy, 8, 0x2b2d42));
    } else {
      items.push(this.add.text(0, 2, String(v), { fontFamily: FONT, fontSize: '48px', color: '#2b2d42' }).setOrigin(0.5));
    }
    const c = this.add.container(0, 0, items);
    c.setData('value', v);
    this.tappable(c, 130, 130, () => this.catch(c));
    return c;
  }

  private catch(c: Phaser.GameObjects.Container) {
    const v = c.getData('value') as number;
    const left = this.target - this.loaded;
    if (v > left) {
      // Does not fit: it bounces off the hold.
      this.tweens.add({ targets: c, angle: 14, yoyo: true, repeat: 2, duration: 90 });
      this.wrong();
      return;
    }
    this.release(c);
    const from = this.loaded;
    this.loaded += v;
    const dest = this.cells[Math.min(this.loaded, this.cells.length) - 1]!;
    this.tweens.add({
      targets: c,
      x: dest.x,
      y: dest.y,
      scale: 0.4,
      alpha: 0,
      duration: 420,
      onComplete: () => {
        c.destroy();
        this.fill(from, this.loaded);
      },
    });
    if (this.loaded === this.target) {
      this.locked = true;
      this.time.delayedCall(700, () => this.roundDone());
    }
  }

  private fill(from: number, to: number) {
    for (let i = from; i < to && i < this.cells.length; i++) {
      const cell = this.cells[i]!;
      this.time.delayedCall((i - from) * 90, () => {
        cell.setFillStyle(0xffd166);
        this.tweens.add({ targets: cell, scale: 1.2, yoyo: true, duration: 120 });
      });
    }
    this.counter?.setText(String(to));
  }

  private roundDone() {
    if (!this.sys.isActive()) return;
    // Barrels still afloat sink away for the next round.
    for (const d of [...this.drifters]) {
      this.release(d.obj);
      this.tweens.add({ targets: d.obj, alpha: 0, duration: 300, onComplete: () => d.obj.destroy() });
    }
    if (this.round + 1 >= this.b.targets.length) {
      this.spawner?.remove();
      void this.finish();
      return;
    }
    this.round++;
    this.locked = false;
    this.drawHold();
    this.say(this.instruction());
    this.time.delayedCall(400, () => this.spawn());
  }

  protected showHint(step: HintStep) {
    const left = this.target - this.loaded;
    if (step === 1) return this.say(phrase('hold.hint.now', { a: this.loaded, b: this.target }));
    if (step === 2) {
      return this.say(this.b.level <= 4 ? phrase('barrels.hint.2') : phrase('barrels.hint.2b', { b: this.target }));
    }
    if (step === 3) {
      this.say(phrase('barrels.hint.3'));
      const air = this.drifters.filter((d) => (d.obj.getData('value') as number) <= left);
      const best = air.find((d) => d.obj.getData('value') === left) ?? air[0];
      if (best) this.blink(best.obj);
      return;
    }
    // Step 4: load the rest and move on.
    this.locked = true;
    this.spawner?.remove();
    this.fill(this.loaded, this.target);
    this.loaded = this.target;
    this.say(phrase('hold.solution', { n: this.target }));
    void this.afterSpeech(900).then(() => this.finish());
  }
}
