import Phaser from 'phaser';
import { phrase } from '../../core/phrases';
import { button, COLORS, FONT, H, W } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { MiniGameScene } from '../common/MiniGameScene';
import { generateHold, solve, type HoldTask } from './generator';

const CELL = 40;
const GRID_X = 120;
const GRID_Y = 210;

/** A cargo piece: n blocks with its number. Tap moves it between dock and hold. */
interface Piece {
  value: number;
  inHold: boolean;
  view: Phaser.GameObjects.Container;
}

export class HoldScene extends MiniGameScene {
  private hold!: HoldTask;
  private pieces: Piece[] = [];
  private gridCells: Phaser.GameObjects.Rectangle[] = [];
  private counter?: Phaser.GameObjects.Text;

  constructor() {
    super('Hold');
  }

  protected itemId() {
    return this.hold.itemId;
  }

  protected instruction() {
    const t = this.hold;
    if (t.kind === 'load') return phrase('hold.load', { n: t.target });
    if (t.kind === 'unload') return phrase('hold.unload', { n: t.leave });
    return phrase('hold.missing', { a: t.was, b: t.became });
  }

  create() {
    this.hold = generateHold(this.task.level, this.rng);
    this.pieces = [];
    this.gridCells = [];
    this.counter = undefined;
    this.cameras.main.setBackgroundColor(COLORS.seaLight);
    this.add.rectangle(W / 2, H - 110, W, 220, COLORS.wood); // dock

    const t = this.hold;
    this.add
      .text(60, 60, this.goalText(), { fontFamily: FONT, fontSize: '56px', color: '#0b2233' })
      .setOrigin(0, 0.5);

    if (t.kind === 'missing') {
      this.createMissing(t);
    } else {
      this.drawGrid(t.capacity);
      const values = t.kind === 'load' ? t.cargo : t.start;
      values.forEach((v) => this.addPiece(v, t.kind === 'unload'));
      if (t.showCounter) {
        this.counter = this.add.text(GRID_X + 10 * CELL + 40, GRID_Y + 20, '', { fontFamily: FONT, fontSize: '56px', color: '#0b2233' });
      }
      this.refresh();
      button(this, W - 230, H - 110, 'Отчаливаем!', () => this.check(), { w: 380, color: COLORS.leaf });
    }
    this.addParrot();
    this.say(this.instruction());
  }

  private goalText() {
    const t = this.hold;
    if (t.kind === 'load') return `Нужно: ${t.target}`;
    if (t.kind === 'unload') return `Оставить: ${t.leave}`;
    return `Было ${t.was}, стало ${t.became}`;
  }

  private drawGrid(capacity: number) {
    for (let i = 0; i < capacity; i++) {
      const col = i % 10;
      const row = Math.floor(i / 10);
      this.gridCells.push(
        this.add
          .rectangle(GRID_X + col * CELL, GRID_Y + row * (CELL + 12), CELL - 4, CELL - 4, 0x3d2b1f, 0.35)
          .setOrigin(0)
          .setStrokeStyle(2, 0x3d2b1f),
      );
    }
  }

  private addPiece(value: number, inHold: boolean) {
    const w = Math.min(value, 5) * 22 + 20;
    const rows = Math.ceil(value / 5);
    const g = this.add.graphics();
    for (let i = 0; i < value; i++) {
      g.fillStyle(0xb5651d).fillRect(-w / 2 + 10 + (i % 5) * 22, -rows * 11 + Math.floor(i / 5) * 22, 20, 20);
    }
    const label = this.add.text(0, rows * 11 + 26, String(value), { fontFamily: FONT, fontSize: '40px', color: '#ffffff' }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 20, Math.max(w, 110), 150, 0xffffff, 0.001);
    const view = this.add.container(0, 0, [hit, g, label]).setSize(Math.max(w, 110), 150).setInteractive({ useHandCursor: true });
    const piece: Piece = { value, inHold, view };
    view.on('pointerup', () => {
      if (this.locked) return;
      piece.inHold = !piece.inHold;
      this.refresh();
    });
    this.pieces.push(piece);
  }

  /** Lays out pieces. Each piece keeps its own spot on the dock, so nothing jumps around. */
  private refresh() {
    let deckX = GRID_X + 60;
    this.pieces.forEach((p, i) => {
      if (p.inHold) {
        p.view.setPosition(deckX, GRID_Y + 2 * (CELL + 12) + 80);
        deckX += 150;
      } else {
        p.view.setPosition(140 + i * 160, H - 120);
      }
    });
    const loaded = this.loaded();
    this.gridCells.forEach((c, i) => c.setFillStyle(i < loaded ? 0xb5651d : 0x3d2b1f, i < loaded ? 1 : 0.35));
    this.counter?.setText(String(loaded));
  }

  private loaded() {
    return this.pieces.filter((p) => p.inHold).reduce((s, p) => s + p.value, 0);
  }

  private target() {
    const t = this.hold;
    return t.kind === 'load' ? t.target : t.kind === 'unload' ? t.leave : t.answer;
  }

  private check() {
    if (this.locked) return;
    const loaded = this.loaded();
    if (loaded === this.target()) {
      this.tweens.add({ targets: this.pieces.filter((p) => p.inHold).map((p) => p.view), y: '-=20', yoyo: true, duration: 200 });
      void this.finish();
      return;
    }
    if (loaded > this.target()) this.say(phrase('hold.overload'));
    this.wrong();
  }

  private createMissing(t: Extract<HoldTask, { kind: 'missing' }>) {
    if (t.showGrid) {
      this.drawGrid(20);
      this.gridCells.forEach((c, i) => {
        if (i < t.was) c.setFillStyle(0xb5651d, 1);
        else if (i < t.became) c.setFillStyle(0xfcbf49, 1);
      });
    }
    t.options.forEach((v, i) =>
      button(this, 260 + i * 380, H - 110, String(v), () => {
        if (this.locked) return;
        if (v === t.answer) void this.finish();
        else this.wrong();
      }, { w: 220 }),
    );
  }

  protected showHint(step: HintStep) {
    const t = this.hold;
    if (step === 1) {
      this.say(this.instruction());
      return;
    }
    if (step === 2) {
      if (t.kind === 'missing') this.say(phrase('hold.hint.count', { a: t.was, b: t.became }));
      else this.say(phrase('hold.hint.now', { a: this.loaded(), b: this.target() }));
      return;
    }
    if (step === 3) {
      if (t.kind === 'missing') {
        this.say(phrase('hold.hint.more', { a: t.was, b: t.became }));
        return;
      }
      const sol = this.solution();
      const first =
        t.kind === 'load'
          ? this.pieces.find((p, i) => sol.includes(i) && !p.inHold)
          : this.pieces.find((p, i) => !sol.includes(i) && p.inHold);
      this.say(phrase(t.kind === 'load' ? 'hold.hint.load' : 'hold.hint.unload'));
      if (first) this.tweens.add({ targets: first.view, alpha: 0.4, yoyo: true, repeat: 3, duration: 250 });
      return;
    }
    // Step 4: show the solution.
    this.locked = true;
    if (t.kind === 'missing') {
      this.say(phrase('hold.solution.missing', { a: t.was, b: t.became, c: t.answer }));
    } else {
      const sol = this.solution();
      this.pieces.forEach((p, i) => (p.inHold = sol.includes(i)));
      this.refresh();
      this.say(phrase('hold.solution', { n: this.target() }));
    }
    this.time.delayedCall(2500, () => void this.finish());
  }

  /** Indices of pieces that should end up in the hold. */
  private solution(): number[] {
    const values = this.pieces.map((p) => p.value);
    return solve(values, this.target()) ?? [];
  }
}
