import Phaser from 'phaser';
import { blocks, COLORS, FONT, W } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { MiniGameScene } from '../common/MiniGameScene';
import { generateNote, type NoteObject, type NoteTask } from './generator';

const COLOR_HEX = { red: 0xd62828, blue: 0x277da1, green: 0x43aa8b } as const;

/** 6×6 block sprites per kind; '#' takes the object's own colour. */
const SPRITES: Record<string, { rows: string[]; palette: Record<string, number> }> = {
  palm: { rows: ['GGGGG.', 'GG.GGG', '..B...', '..B...', '..B...', '.BBB..'], palette: { G: 0x2a9d8f, B: 0x8d5524 } },
  stone: { rows: ['......', '..SS..', '.SSSS.', 'SSSSSS', 'SSSSSS', '.SSSS.'], palette: { S: 0x8d99ae } },
  chest: { rows: ['......', '.####.', '#YYYY#', '######', '#Y##Y#', '######'], palette: { Y: 0xfcbf49 } },
  turtle: { rows: ['......', '..GGG.', '.GgGgG', 'HGGGGG', '.L..L.', '......'], palette: { G: 0x2d6a4f, g: 0x52b788, H: 0x95d5b2, L: 0x95d5b2 } },
  barrel: { rows: ['.####.', '#BBBB#', '######', '######', '#BBBB#', '.####.'], palette: { B: 0x5c3317 } },
  crab: { rows: ['C....C', 'CC..CC', '.CCCC.', 'CCCCCC', '.C..C.', 'C....C'], palette: { C: 0xe76f51 } },
  boat: { rows: ['......', '...W..', '...WW.', '...M..', '######', '.####.'], palette: { W: 0xffffff, M: 0x8d5524 } },
  anchor: { rows: ['..AA..', '..AA..', 'AAAAAA', '..AA..', 'A.AA.A', '.AAAA.'], palette: { A: 0x495057 } },
  flag: { rows: ['P####.', 'P#####', 'P####.', 'P.....', 'P.....', 'PP....'], palette: { P: 0x5c3317 } },
  cannon: { rows: ['......', '.KKKKK', 'KKKKKK', '.KKK..', 'WW.WW.', 'WW.WW.'], palette: { K: 0x212529, W: 0x8d5524 } },
};

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
    return 'Прочитай записку из бутылки и сделай, что там написано.';
  }

  protected itemId() {
    return this.note.itemId;
  }

  create() {
    this.note = generateNote(this.task.level, this.rng);
    this.nextTarget = 0;
    this.views.clear();
    this.readAloudBtn = undefined;
    this.cameras.main.setBackgroundColor(COLORS.sand);
    this.add.rectangle(W / 2, 130, W, 260, COLORS.seaLight);

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
    const sprite = SPRITES[o.kind]!;
    const scale = o.size === 'small' ? 14 : o.size === 'big' ? 26 : 20;
    const palette = { ...sprite.palette, '#': o.color ? COLOR_HEX[o.color] : 0x9c6644 };
    const g = blocks(this, (-6 * scale) / 2, (-6 * scale) / 2, sprite.rows, scale, palette);
    const hit = this.add.rectangle(0, 0, 200, 190, 0xffffff, 0.001);
    const c = this.add.container(x, y, [hit, g]).setSize(200, 190).setInteractive({ useHandCursor: true });
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
      this.say('Посмотри на записку ещё раз. Читай по слогам.');
      return;
    }
    if (step === 2) {
      this.say('Нажми на записку — я прочитаю её с тобой.');
      if (!this.readAloudBtn) {
        this.readAloudBtn = this.add
          .text(NOTE_X, 250, 'Прочитай мне', { fontFamily: FONT, fontSize: '32px', color: '#0b2233', backgroundColor: '#ffffff', padding: { x: 12, y: 6 } })
          .setOrigin(0.5)
          .setInteractive({ useHandCursor: true })
          .on('pointerup', () => this.say(this.note.text));
      }
      return;
    }
    const target = this.note.targets[this.nextTarget];
    if (!target) return;
    if (step === 3) {
      this.say('Вот подсказка. Куда нужно идти сейчас?');
      this.tweens.add({ targets: this.views.get(target)!, alpha: 0.4, yoyo: true, repeat: 3, duration: 250 });
      return;
    }
    // Step 4: show the solution, then move on.
    this.locked = true;
    this.say(`Здесь написано: ${this.note.text} Смотри.`);
    const rest = this.note.targets.slice(this.nextTarget);
    rest.forEach((id, i) => this.time.delayedCall(1200 * (i + 1), () => this.mark(id)));
    this.time.delayedCall(1200 * (rest.length + 1), () => void this.finish());
  }
}

