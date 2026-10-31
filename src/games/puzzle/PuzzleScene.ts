import Phaser from 'phaser';
import { free } from '../../core/phrases';
import { FONT, H, W } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { MiniGameScene } from '../common/MiniGameScene';
import { generateMathPuzzle, generateReadingPuzzle, type Puzzle, type Visual } from './generator';

const OPT_Y = 610;

/**
 * Story puzzles with three answers (scenario v0.2). Math questions are read
 * aloud; reading questions are for the child to read, with "Прочитай мне" as a hint.
 */
export class PuzzleScene extends MiniGameScene {
  private puzzle!: Puzzle;
  private optionViews: Phaser.GameObjects.Container[] = [];
  private readBtn?: Phaser.GameObjects.Text;
  private paperBottom = 0;

  constructor() {
    super('Puzzle');
  }

  protected override bubbleWidth = 300;

  protected itemId() {
    return this.puzzle.itemId;
  }

  protected instruction() {
    if (this.puzzle.skill === 'math') return free(this.puzzle.text);
    return 'Прочитай записку сам и выбери ответ.';
  }

  create() {
    this.puzzle = this.task.skill === 'math' ? generateMathPuzzle(this.task.level, this.rng) : generateReadingPuzzle(this.task.level, this.rng);
    this.optionViews = [];
    this.readBtn = undefined;
    const p = this.puzzle;
    this.add.image(W / 2, H / 2, p.skill === 'math' ? 'bg-harbor' : 'bg-beach').setDisplaySize(W, H);

    // The question on a sheet of paper.
    const q = this.add.text(70, 50, p.text, {
      fontFamily: FONT,
      fontSize: p.skill === 'reading' ? '40px' : '34px',
      color: '#3d2b1f',
      wordWrap: { width: 960 },
      lineSpacing: 8,
    });
    this.add.rectangle(46, 30, 1010, q.height + 40, 0xfff1d0).setOrigin(0).setStrokeStyle(6, 0x8d5524);
    q.setDepth(1);
    const top = 30 + q.height + 60;
    this.paperBottom = 30 + q.height + 40;

    this.drawVisual(p.visual, top);
    this.drawOptions();
    this.instructionOnScreen = p.skill === 'math';
    this.addParrot();
    this.say(this.instruction(), !this.instructionOnScreen);
  }

  private drawVisual(v: Visual, top: number) {
    const cy = Math.max(top + 110, 380);
    switch (v.type) {
      case 'scales': {
        const g = this.add.graphics();
        g.fillStyle(0x7a4a24).fillTriangle(640, cy - 40, 600, cy + 150, 680, cy + 150);
        g.lineStyle(14, 0x2b2d42).lineBetween(380, cy - 40, 900, cy - 40);
        g.lineStyle(8, 0xa5683a).lineBetween(380, cy - 40, 900, cy - 40);
        for (const x of [440, 840]) {
          g.lineStyle(4, 0x2b2d42).lineBetween(x - 90, cy + 50, x, cy - 40).lineBetween(x + 90, cy + 50, x, cy - 40);
          g.fillStyle(0xced4da).fillEllipse(x, cy + 56, 220, 30);
          g.lineStyle(5, 0x2b2d42).strokeEllipse(x, cy + 56, 220, 30);
        }
        this.labelled(385, cy - 10, 'crate', 110, String(v.known));
        this.labelled(500, cy - 10, 'crate', 110, '?', '#e63946');
        const wgt = this.add.graphics();
        wgt.fillStyle(0x4a4e69).fillRoundedRect(775, cy - 60, 130, 110, 16);
        wgt.lineStyle(5, 0x2b2d42).strokeRoundedRect(775, cy - 60, 130, 110, 16);
        this.add.text(840, cy - 5, String(v.total), { fontFamily: FONT, fontSize: '56px', color: '#ffffff' }).setOrigin(0.5);
        return;
      }
      case 'trade': {
        this.add.rectangle(330, cy - 20, 360, 120, 0xffffff, 0.85).setStrokeStyle(4, 0x2b2d42);
        this.add.image(210, cy - 20, 'obj-barrel').setDisplaySize(90, 90);
        this.add.text(270, cy - 20, '=', { fontFamily: FONT, fontSize: '56px', color: '#2b2d42' }).setOrigin(0.5);
        for (let i = 0; i < v.price; i++) this.add.image(320 + i * 50, cy - 20, 'coin').setDisplaySize(46, 46);
        for (let i = 0; i < v.items; i++) this.add.image(640 + i * 110, cy - 20, 'obj-barrel').setDisplaySize(110, 110);
        return;
      }
      case 'octopus': {
        this.add.image(330, cy, 'char-blot').setDisplaySize(250, 230);
        if (v.rest === 0) {
          // Eight tentacle tips, some with our coins.
          for (let i = 0; i < 8; i++) {
            const x = 560 + i * 72;
            this.add.circle(x, cy + 20, 30, 0x7b2cbf).setStrokeStyle(4, 0x2b2d42);
            if (i < v.holding) this.add.image(x, cy + 20, 'coin').setDisplaySize(40, 40);
          }
        }
        return;
      }
      case 'share': {
        for (let i = 0; i < v.coins; i++) this.add.image(200 + (i % 5) * 52, cy - 50 + Math.floor(i / 5) * 52, 'coin').setDisplaySize(48, 48);
        ['char-rumb', 'char-raccoon', 'char-kettle'].slice(0, v.crew).forEach((k, i) => this.add.image(640 + i * 190, cy, k).setDisplaySize(170, 170));
        return;
      }
      case 'lock': {
        this.add.image(W / 2, cy + 10, 'obj-chest-red').setDisplaySize(260, 260);
        return;
      }
      case 'note': {
        const size = 96;
        const letters = [...v.text];
        const x0 = W / 2 - (letters.length * size) / 2 + size / 2;
        this.add.rectangle(W / 2, cy, letters.length * size + 60, 170, 0xfff1d0).setStrokeStyle(6, 0x8d5524);
        letters.forEach((l, i) => {
          if (i === v.blot) {
            this.add.circle(x0 + i * size, cy, 44, 0x3c096c);
            this.add.circle(x0 + i * size + 30, cy - 30, 14, 0x3c096c);
            this.add.circle(x0 + i * size - 32, cy + 28, 10, 0x3c096c);
          } else {
            this.add.text(x0 + i * size, cy, l, { fontFamily: FONT, fontSize: '88px', color: '#3d2b1f' }).setOrigin(0.5);
          }
        });
        return;
      }
      default:
        return;
    }
  }

  private labelled(x: number, y: number, key: string, size: number, label: string, color = '#ffffff') {
    this.add.image(x, y, key).setDisplaySize(size, size);
    this.add.text(x, y, label, { fontFamily: FONT, fontSize: '40px', color, stroke: '#2b2d42', strokeThickness: 6 }).setOrigin(0.5);
  }

  private drawOptions() {
    const p = this.puzzle;
    const pictures = p.options.some((o) => o.key);
    const n = p.options.length;
    const gap = pictures ? 300 : 260;
    p.options.forEach((o, i) => {
      const x = W / 2 - ((n - 1) * gap) / 2 + i * gap;
      const y = pictures ? (p.visual.type === 'none' ? 470 : OPT_Y - 20) : OPT_Y;
      const size = pictures ? 230 : 150;
      const bg = this.add.rectangle(0, 0, size, size, 0xffffff, 0.92).setStrokeStyle(6, 0x2b2d42);
      const items: Phaser.GameObjects.GameObject[] = [bg];
      if (o.key) items.push(this.add.image(0, 0, o.key).setDisplaySize(size - 30, size - 30));
      if (o.label) items.push(this.add.text(0, 0, o.label, { fontFamily: FONT, fontSize: '72px', color: '#2b2d42' }).setOrigin(0.5));
      const c = this.add.container(x, y, items).setSize(size, size).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => this.choose(i));
      this.optionViews.push(c);
    });
  }

  private choose(i: number) {
    if (this.locked) return;
    if (i === this.puzzle.answer) {
      this.mark(i);
      void this.finish();
    } else {
      const v = this.optionViews[i]!;
      this.tweens.add({ targets: v, x: v.x + 12, yoyo: true, repeat: 2, duration: 60 });
      this.wrong();
    }
  }

  private mark(i: number) {
    const v = this.optionViews[i]!;
    (v.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(10, 0x2a9d8f);
    this.tweens.add({ targets: v, scale: 1.12, yoyo: true, duration: 200 });
  }

  protected showHint(step: HintStep) {
    const p = this.puzzle;
    if (step <= 3) {
      this.say(p.hints[step - 1 as 0 | 1 | 2] ?? p.hints[0]);
      if (step >= 2 && p.skill === 'reading' && !this.readBtn) {
        this.readBtn = this.add
          .text(60, this.paperBottom + 8, 'Прочитай мне', { fontFamily: FONT, fontSize: '28px', color: '#0b2233', backgroundColor: '#ffffff', padding: { x: 12, y: 6 } })
          .setDepth(5)
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => this.say(free(p.text)));
      }
      if (step === 3) this.tweens.add({ targets: this.optionViews[p.answer]!, alpha: 0.4, yoyo: true, repeat: 3, duration: 250 });
      return;
    }
    this.locked = true;
    this.mark(p.answer);
    const a = p.options[p.answer]!;
    this.say(a.label ? `Ответ: ${a.label}.` : 'Вот правильный ответ.');
    this.time.delayedCall(1800, () => void this.finish());
  }
}
