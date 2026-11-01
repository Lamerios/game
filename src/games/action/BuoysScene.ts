import Phaser from 'phaser';
import { phrase } from '../../core/phrases';
import { FONT, W } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { generateBuoys, type Buoy, type BuoysTask, type PatternRound } from './generators';
import { SeaScene } from './SeaScene';

const ROW_Y = 200;
const SIZE = 104;
const SPACING = 520;
const OPT_Y = 540;

/**
 * "Буи-узоры" (logic): a row of buoys follows a rule; the "?" spot needs the
 * buoy that continues it. Three candidates float by in a loop; catch the right one.
 */
export class BuoysScene extends SeaScene {
  private t!: BuoysTask;
  private round = 0;
  private rowLayer?: Phaser.GameObjects.Container;
  private gapPos: [number, number] = [0, 0];
  private slotX: number[] = [];
  /** The buoy caught into the gap; it goes with its row. */
  private placed?: Phaser.GameObjects.Container;

  constructor() {
    super('Buoys');
  }

  protected override bubbleWidth = 300;

  private get r(): PatternRound {
    return this.t.rounds[this.round]!;
  }

  protected itemId() {
    return this.t.itemId;
  }

  protected instruction() {
    return this.round === 0 ? phrase('buoys.intro') : phrase('buoys.next');
  }

  create() {
    this.t = generateBuoys(this.task.level, this.rng);
    this.round = 0;
    this.placed = undefined;
    this.add.image(W / 2, 360, 'bg-sea').setDisplaySize(W, 720);
    this.waves(420);
    this.showRound();
    this.addParrot();
    this.say(this.instruction());
  }

  private buoy(b: Buoy, size = SIZE) {
    const img = this.add.image(0, 0, `buoy-${b.color}-${b.shape}`).setDisplaySize(size, size * 1.08);
    const items: Phaser.GameObjects.GameObject[] = [img];
    if (b.dots) {
      const n = b.dots;
      const cols = Math.min(n, 3);
      for (let i = 0; i < n; i++) {
        const cx = ((i % cols) - (cols - 1) / 2) * 15;
        const cy = (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 15 - 4;
        items.push(this.add.circle(cx * (size / SIZE), cy * (size / SIZE), 5.5 * (size / SIZE), 0x0b2233).setStrokeStyle(2, 0xffffff));
      }
    }
    return this.add.container(0, 0, items);
  }

  private showRound() {
    this.rowLayer?.destroy();
    this.placed?.destroy();
    this.placed = undefined;
    for (const d of [...this.drifters]) {
      this.release(d.obj);
      d.obj.destroy();
    }
    const r = this.r;
    const n = r.row.length;
    const step = Math.min(110, 760 / (n - 1));
    // Left part of the screen: the parrot's bubble lives on the right.
    const x0 = 110;
    const items: Phaser.GameObjects.GameObject[] = [];
    // A rope with the buoys hanging on it.
    items.push(this.add.rectangle(x0 - 70, ROW_Y - 90, step * (n - 1) + 140, 190, 0x0b2233, 0.45).setOrigin(0).setStrokeStyle(4, 0xffd166));
    this.slotX = [];
    r.row.forEach((b, i) => {
      const x = x0 + i * step;
      this.slotX.push(x);
      if (i === r.gap) {
        this.gapPos = [x, ROW_Y];
        items.push(this.add.rectangle(x, ROW_Y, step - 14, SIZE + 10, 0xffffff, 0.25).setStrokeStyle(4, 0xffffff));
        items.push(this.add.text(x, ROW_Y, '?', { fontFamily: FONT, fontSize: '72px', color: '#ffffff' }).setOrigin(0.5));
        return;
      }
      const c = this.buoy(b, step - 14);
      c.setPosition(x, ROW_Y);
      items.push(c);
    });
    this.rowLayer = this.add.container(0, 0, items);

    // Candidates float by in a loop.
    r.options.forEach((b, i) => {
      const c = this.buoy(b, 130);
      c.setData('i', i);
      this.tappable(c, 150, 160, () => this.catch(c));
      this.addDrifter(c, OPT_Y + (i % 2) * 40, this.t.crossSec, { x: W - 150 + i * SPACING, loop: SPACING * 3 });
    });
  }

  private catch(c: Phaser.GameObjects.Container) {
    if (c.getData('i') !== this.r.answer) {
      this.tweens.add({ targets: c, angle: 14, yoyo: true, repeat: 2, duration: 90 });
      this.wrong();
      return;
    }
    this.place(c);
  }

  private place(c: Phaser.GameObjects.Container) {
    this.locked = true;
    this.release(c);
    this.placed = c;
    const [x, y] = this.gapPos;
    this.tweens.add({ targets: c, x, y, scale: 0.8, duration: 450, ease: 'Back.easeOut' });
    this.time.delayedCall(900, () => this.roundDone());
  }

  private roundDone() {
    if (!this.sys.isActive()) return;
    if (this.attempt.solutionShown || this.round + 1 >= this.t.rounds.length) {
      void this.finish();
      return;
    }
    this.round++;
    this.locked = false;
    this.showRound();
    this.say(this.instruction());
  }

  protected showHint(step: HintStep) {
    const r = this.r;
    if (step === 1) return this.say(r.unit ? phrase('buoys.hint.1') : phrase('buoys.hint.grow'));
    if (step === 2) {
      if (!r.unit) {
        // Growing: write the count under each buoy.
        r.row.forEach((b, i) => {
          if (i !== r.gap && b.dots) this.rowLayer?.add(this.add.text(this.slotX[i]!, ROW_Y + 70, String(b.dots), { fontFamily: FONT, fontSize: '30px', color: '#ffd166' }).setOrigin(0.5));
        });
        return this.say(phrase('buoys.hint.2grow'));
      }
      // Frame the first repeating unit.
      const a = this.slotX[0]!;
      const b = this.slotX[r.unit - 1]!;
      const frame = this.add.rectangle((a + b) / 2, ROW_Y, b - a + 110, 150).setStrokeStyle(6, 0xffd166);
      this.rowLayer?.add(frame);
      this.blink(frame);
      return this.say(phrase('buoys.hint.2'));
    }
    const right = this.drifters.find((d) => d.obj.getData('i') === r.answer);
    if (step === 3) {
      this.say(phrase('buoys.hint.3'));
      if (right) this.blink(right.obj);
      return;
    }
    this.say(phrase('buoys.solution'));
    if (right) this.place(right.obj);
    else void this.finish();
  }
}
