import Phaser from 'phaser';
import { phrase } from '../../core/phrases';
import { FONT, H, W } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { MiniGameScene } from '../common/MiniGameScene';
import { generateNote, type NoteObject, type NoteTask } from './generator';

const NOTE_X = 450;

const SLOT_POS: [number, number][] = [
  [260, 380], [640, 380], [1020, 380],
  [260, 590], [640, 590], [1020, 590],
];

export class NoteScene extends MiniGameScene {
  private note!: NoteTask;
  private nextTarget = 0;
  private views = new Map<string, Phaser.GameObjects.Container>();
  private readAloudBtn?: Phaser.GameObjects.Text;

  constructor() {
    super('Note');
  }

  protected instruction() {
    return phrase('note.instruction');
  }

  protected itemId() {
    return this.note.itemId;
  }

  create() {
    this.note = generateNote(this.task.level, this.rng);
    this.nextTarget = 0;
    this.views.clear();
    this.readAloudBtn = undefined;
    this.add.image(W / 2, H / 2, 'bg-beach').setDisplaySize(W, H);
    this.add.image(NOTE_X - 290, 130, 'bottle').setDisplaySize(150, 90).setAngle(-15);

    // The note itself: paper first, text on top.
    const fontSize = this.note.level <= 2 ? 64 : 48;
    const paper = this.add.rectangle(NOTE_X, 130, 360, 120, 0xfff1d0).setStrokeStyle(6, 0x8d5524);
    const text = this.add
      .text(NOTE_X, 130, this.note.text, {
        fontFamily: FONT,
        fontSize: `${fontSize}px`,
        color: '#3d2b1f',
        align: 'center',
        wordWrap: { width: 640 },
      })
      .setOrigin(0.5);
    paper.setSize(Math.max(360, text.width + 80), text.height + 60);

    this.note.objects.forEach((o, i) => this.drawObject(o, SLOT_POS[i]!));
    this.addParrot();
    this.say(this.instruction());
  }

  private drawObject(o: NoteObject, [x, y]: [number, number]) {
    const size = o.size === 'small' ? 110 : o.size === 'big' ? 190 : 160;
    const g = this.add.image(0, o.size === 'small' ? 30 : 0, o.color ? `obj-${o.kind}-${o.color}` : `obj-${o.kind}`).setDisplaySize(size, size);
    const shadow = this.add.ellipse(0, size / 2 - 8 + (o.size === 'small' ? 30 : 0), size * 0.8, 18, 0x000000, 0.15);
    const hit = this.add.rectangle(0, 0, 200, 190, 0xffffff, 0.001);
    const c = this.add.container(x, y, [hit, shadow, g]).setSize(200, 190).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.tap(o.id));
    this.views.set(o.id, c);
  }

  private tap(id: string) {
    if (this.locked) return;
    const expected = this.note.targets[this.nextTarget];
    if (id === expected) {
      this.mark(id);
      this.nextTarget++;
      if (this.nextTarget >= this.note.targets.length) void this.finish();
    } else {
      this.wrong();
    }
  }

  private mark(id: string) {
    const v = this.views.get(id)!;
    v.add(this.add.text(70, -90, '✓', { fontFamily: FONT, fontSize: '64px', color: '#2a9d8f' }));
    this.tweens.add({ targets: v, scale: 1.12, yoyo: true, duration: 180 });
  }

  protected showHint(step: HintStep) {
    if (step === 1) {
      this.say(phrase('note.hint1'));
      return;
    }
    if (step === 2) {
      this.say(phrase('note.hint2'));
      if (!this.readAloudBtn) {
        this.readAloudBtn = this.add
          .text(NOTE_X, 250, 'Прочитай мне', { fontFamily: FONT, fontSize: '32px', color: '#0b2233', backgroundColor: '#ffffff', padding: { x: 12, y: 6 } })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => this.say(phrase('note.read', { t: this.note.text })));
      }
      return;
    }
    const target = this.note.targets[this.nextTarget];
    if (!target) return;
    if (step === 3) {
      this.say(phrase('note.hint3'));
      this.tweens.add({ targets: this.views.get(target)!, alpha: 0.4, yoyo: true, repeat: 3, duration: 250 });
      return;
    }
    // Step 4: show the solution, then move on.
    this.locked = true;
    this.say(phrase('note.solution', { t: this.note.text }));
    const rest = this.note.targets.slice(this.nextTarget);
    rest.forEach((id, i) => this.time.delayedCall(1200 * (i + 1), () => this.mark(id)));
    this.time.delayedCall(1200 * (rest.length + 1), () => void this.finish());
  }
}

