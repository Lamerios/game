import Phaser from 'phaser';
import { join, phrase } from '../../core/phrases';
import { FONT, W } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { generateGulls, nextGullLetter, type GullsTask } from './generators';
import { SeaScene } from './SeaScene';

const LANES = [390, 500, 610];
const BOX = 84;
const BOX_Y = 150;
const COLORED = ['chest', 'barrel', 'boat', 'flag'];

/**
 * "Чайки с буквами" (reading): a picture and empty boxes, one per sound; gulls
 * fly by with letters and the child catches the next letter of the word.
 */
export class GullsScene extends SeaScene {
  private g!: GullsTask;
  private wordIdx = 0;
  private pos = 0;
  private boxes: Phaser.GameObjects.Text[] = [];
  private top?: Phaser.GameObjects.Container;
  private lane = 0;
  private spawner?: Phaser.Time.TimerEvent;

  constructor() {
    super('Gulls');
  }

  protected override bubbleWidth = 300;

  private get word() {
    return this.g.words[this.wordIdx]!;
  }

  protected itemId() {
    return this.g.itemId;
  }

  protected instruction() {
    const w = this.word.word.toLowerCase();
    const ask = this.g.sayWord ? phrase('gulls.word', { w }) : phrase('gulls.picture');
    return this.wordIdx === 0 && !this.repeatedOnce ? join(phrase('gulls.intro'), ask) : ask;
  }
  private repeatedOnce = false;

  create() {
    this.g = generateGulls(this.task.level, this.rng);
    this.wordIdx = 0;
    this.lane = 0;
    this.repeatedOnce = false;
    this.add.image(W / 2, 360, 'bg-sea').setDisplaySize(W, 720);
    this.waves(280);
    this.showWord();
    this.spawner = this.time.addEvent({ delay: (this.g.crossSec * 1000) / 4.2, loop: true, callback: () => this.spawn() });
    this.spawn();
    this.addParrot();
    this.say(this.instruction());
    this.repeatedOnce = true;
  }

  /** Picture + boxes for the current word. */
  private showWord() {
    this.top?.destroy();
    this.boxes = [];
    this.pos = this.g.prefilled;
    const { id, word } = this.word;
    const letters = [...word];
    const x0 = 240;
    const items: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(30, 40, x0 + letters.length * BOX + 30, 220, 0xfff1d0, 0.95).setOrigin(0).setStrokeStyle(6, 0x8d5524),
      this.add.image(130, BOX_Y, COLORED.includes(id) ? `obj-${id}-red` : `obj-${id}`).setDisplaySize(170, 170),
    ];
    letters.forEach((l, i) => {
      const x = x0 + i * BOX + BOX / 2;
      items.push(this.add.rectangle(x, BOX_Y, BOX - 10, BOX + 10, 0xffffff).setStrokeStyle(5, 0x2b2d42));
      const t = this.add.text(x, BOX_Y, i < this.pos ? l : '', { fontFamily: FONT, fontSize: '64px', color: '#3d2b1f' }).setOrigin(0.5);
      this.boxes.push(t);
      items.push(t);
    });
    this.top = this.add.container(0, 0, items);
  }

  private neededInAir(): boolean {
    const need = this.word.word[this.pos];
    return this.drifters.some((d) => d.obj.getData('letter') === need);
  }

  private spawn() {
    if (this.locked || this.pos >= this.word.word.length) return;
    if (this.drifters.length >= 5) return;
    const letter = nextGullLetter(this.rng, this.word.word, this.pos, this.g.distractors[this.wordIdx]!, this.neededInAir());
    const y = LANES[this.lane++ % LANES.length]!;
    const bird = this.add.image(0, -46, 'gull').setDisplaySize(180, 124);
    this.tweens.add({ targets: bird, scaleY: bird.scaleY * 0.8, yoyo: true, repeat: -1, duration: 260 });
    const sign = this.add.circle(0, 40, 44, 0xffffff).setStrokeStyle(5, 0x2b2d42);
    const string = this.add.line(0, 0, 0, -20, 0, 10, 0x2b2d42).setLineWidth(3);
    const t = this.add.text(0, 40, letter, { fontFamily: FONT, fontSize: '56px', color: '#0b2233' }).setOrigin(0.5);
    const c = this.add.container(0, 0, [string, bird, sign, t]);
    c.setData('letter', letter);
    this.tappable(c, 150, 190, () => this.catch(c));
    this.addDrifter(c, y, this.g.crossSec);
  }

  private catch(c: Phaser.GameObjects.Container) {
    const letter = c.getData('letter') as string;
    const need = this.word.word[this.pos];
    if (letter !== need) {
      this.release(c);
      this.tweens.add({ targets: c, y: -150, x: c.x - 200, duration: 600, onComplete: () => c.destroy() });
      this.wrong();
      return;
    }
    this.release(c);
    const box = this.boxes[this.pos]!;
    this.pos++;
    this.tweens.add({
      targets: c,
      x: box.x,
      y: box.y,
      scale: 0.5,
      alpha: 0,
      duration: 380,
      onComplete: () => {
        c.destroy();
        box.setText(letter);
        this.tweens.add({ targets: box, scale: 1.25, yoyo: true, duration: 150 });
      },
    });
    if (this.pos >= this.word.word.length) {
      this.locked = true;
      this.time.delayedCall(500, () => this.wordDone());
    }
  }

  private wordDone() {
    this.say(phrase('gulls.solution', { w: this.word.word.toLowerCase() }));
    if (this.wordIdx + 1 >= this.g.words.length) {
      this.spawner?.remove();
      void this.afterSpeech(600).then(() => this.finish());
      return;
    }
    void this.afterSpeech(600).then(() => {
      if (!this.sys.isActive()) return;
      this.wordIdx++;
      this.locked = false;
      this.showWord();
      this.say(this.instruction());
    });
  }

  protected showHint(step: HintStep) {
    const w = this.word.word.toLowerCase();
    const need = this.word.word[this.pos];
    if (step === 1) return this.say(phrase('gulls.hint.1'));
    if (step === 2) return this.say(phrase('gulls.hint.2', { w }));
    if (step === 3 && need) {
      this.say(phrase('gulls.hint.3', { l: need }));
      for (const d of this.drifters) if (d.obj.getData('letter') === need) this.blink(d.obj);
      return;
    }
    // Step 4: fill the word in, then move on.
    this.locked = true;
    this.spawner?.remove();
    [...this.word.word].forEach((l, i) => {
      if (i >= this.pos) this.time.delayedCall(350 * (i - this.pos + 1), () => this.boxes[i]!.setText(l).setColor('#2a9d8f'));
    });
    this.time.delayedCall(350 * (this.word.word.length - this.pos + 1), () => {
      this.say(phrase('gulls.solution', { w }));
      void this.afterSpeech(800).then(() => this.finish());
    });
  }
}
