import Phaser from 'phaser';
import { phrase } from '../core/phrases';
import type { HintStep } from '../games/common/attempt';
import { MiniGameScene } from '../games/common/MiniGameScene';
import type { SessionTask } from '../core/types';
import { LETTERS, SECRET_WORD } from '../story/script';
import { FONT, H, W } from './ui';

const SLOT_X = (i: number) => W / 2 - 165 + i * 110;
const SLOT_Y = 300;

/**
 * Finale of the season: the chest's letter lock. The child builds the secret
 * word from the four letters found on the islands (writing skill).
 */
export class LockScene extends MiniGameScene {
  private slots: (string | undefined)[] = [];
  private slotText: Phaser.GameObjects.Text[] = [];
  private tiles = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super('Lock');
  }

  init() {
    const task: SessionTask = { skill: 'writing', level: 1, isReview: false };
    super.init({ task });
    this.slots = [undefined, undefined, undefined, undefined];
    this.slotText = [];
    this.tiles.clear();
  }

  protected instruction() {
    return phrase('rumb.chestlock');
  }

  protected itemId() {
    return `lock-${SECRET_WORD}`;
  }

  create() {
    this.add.image(W / 2, H / 2, 'bg-beach').setDisplaySize(W, H);
    this.add.image(W / 2, 330, 'obj-chest-red').setDisplaySize(620, 620).setAlpha(0.95);
    this.add.rectangle(W / 2, SLOT_Y, 470, 120, 0x3d2b1f, 0.85).setStrokeStyle(6, 0xffd166);
    for (let i = 0; i < 4; i++) {
      const box = this.add.rectangle(SLOT_X(i), SLOT_Y, 90, 96, 0xfff1d0).setStrokeStyle(4, 0x8d5524).setInteractive({ useHandCursor: true });
      box.on('pointerup', () => this.unplace(i));
      this.slotText.push(this.add.text(SLOT_X(i), SLOT_Y, '', { fontFamily: FONT, fontSize: '64px', color: '#3d2b1f' }).setOrigin(0.5));
    }
    LETTERS.forEach((l, i) => {
      const x = W / 2 - 240 + i * 160;
      const bg = this.add.rectangle(0, 0, 120, 120, 0xffd166).setStrokeStyle(6, 0x2b2d42);
      const t = this.add.text(0, 0, l, { fontFamily: FONT, fontSize: '72px', color: '#2b2d42' }).setOrigin(0.5);
      const c = this.add.container(x, 600, [bg, t]).setSize(120, 120).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => this.place(l));
      this.tiles.set(l, c);
    });
    this.addParrot();
    this.say(this.instruction());
  }

  private place(letter: string) {
    if (this.locked) return;
    const i = this.slots.indexOf(undefined);
    if (i < 0 || this.slots.includes(letter)) return;
    this.slots[i] = letter;
    this.slotText[i]!.setText(letter);
    this.tiles.get(letter)!.setAlpha(0.3);
    if (!this.slots.includes(undefined)) this.check();
  }

  private unplace(i: number) {
    if (this.locked) return;
    const l = this.slots[i];
    if (!l) return;
    this.slots[i] = undefined;
    this.slotText[i]!.setText('');
    this.tiles.get(l)!.setAlpha(1);
  }

  private check() {
    if (this.slots.join('') === SECRET_WORD) {
      this.slotText.forEach((t) => t.setColor('#2a9d8f'));
      void this.finish();
      return;
    }
    this.wrong();
    this.time.delayedCall(700, () => [0, 1, 2, 3].forEach((i) => this.unplace(i)));
  }

  protected showHint(step: HintStep) {
    if (step === 1) this.say('Подумай: кем стали тебе Румб, Болтик и Пыхтелкин?');
    else if (step === 2) this.say('Это слово начинается на Д.');
    else if (step === 3) this.say('Д, потом Р. А дальше?');
    else {
      this.locked = true;
      this.say(`Здесь написано: ${SECRET_WORD}.`);
      [...SECRET_WORD].forEach((l, i) => {
        this.slots[i] = l;
        this.slotText[i]!.setText(l);
      });
      this.time.delayedCall(1500, () => void this.finish());
    }
  }

  protected async report() {
    await this.state.recordExtra('writing', 1, this.attempt.outcome(), this.itemId(), this.attempt.hintsUsed, Date.now() - this.attempt.startedAt);
    await this.state.markSeen('chest');
  }
}
