import Phaser from 'phaser';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, phrase, type Utterance } from '../../core/phrases';
import { recordWord } from '../../core/wordLog';
import { button, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import {
  BLOCKS, checkOrder, COLS, compare, emptyGrid, MAX_LEVEL, nextLevel, orderLine, PAINT, pickBlueprint, planOrders, ROWS, type Block, type Grid, type Order,
} from './logic';

const KEY = 'shipyard-progress';
const CELL = 76;
const GX = 520;
const GY = 130;
const CARGO = 6;

/** «Верфь»: copy a boat from a blueprint, block by block, then load it by the shipwright's English orders. */
export class ShipyardScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  private run?: Run;
  private talkToken = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private brush: Block = 'red';
  private brushMarks = new Map<Block, Phaser.GameObjects.Rectangle>();
  private checks = 0;
  private ordersRight = 0;
  private ordersTotal = 0;
  /** Current blueprint and order, kept for play-through tests. */
  protected target?: Grid;
  protected current?: Order;

  constructor() {
    super('Shipyard');
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    try {
      const v = Number(JSON.parse(localStorage.getItem(KEY) ?? '{}').level);
      this.level = v >= 1 && v <= MAX_LEVEL ? v : 1;
    } catch {
      this.level = 1;
    }
    this.layer = [];
    this.checks = 0;
    this.ordersRight = 0;
    this.ordersTotal = 0;
    this.drawYard();
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.run = startRun('shipyard', { level: this.level });
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false });
    });
    this.time.delayedCall(0, () => void this.play());
  }

  private leave() {
    this.run?.end({ completed: false });
    goHome(this);
  }

  private drawYard() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x8ecae6, 0x8ecae6, 0xcaf0f8, 0xcaf0f8).fillRect(0, 0, W, 470);
    g.fillStyle(0x219ebc).fillRect(0, 470, W, 250);
    // Wooden slipway planks.
    for (let x = 0; x < W; x += 90) g.fillStyle(x % 180 ? 0xb5651d : 0xa5683a).fillRect(x, 560, 90, 160);
    g.lineStyle(3, 0x7a4a24).lineBetween(0, 560, W, 560);
    this.add.image(100, 470, 'char-raccoon').setDisplaySize(170, 170);
    this.add.text(40, 40, `Верфь · уровень ${this.level}`, { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#0b2233', strokeThickness: 6 }).setOrigin(0, 0.5);
  }

  private clear() {
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
    this.brushMarks.clear();
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private async talk(...lines: Utterance[]): Promise<boolean> {
    const token = ++this.talkToken;
    for (const u of lines) {
      if (token !== this.talkToken) return false;
      voice.say(u);
      await voice.idle(9000);
      if (!this.sys.isActive()) return false;
    }
    return token === this.talkToken;
  }

  private async play() {
    const first = !localStorage.getItem(KEY);
    if (!(await this.talk(phrase(first ? 'raccoon.ship.hello' : 'raccoon.ship.again')))) return;
    const built = await this.blueprint();
    if (!built) return;
    const orders = planOrders(this.level, this.rng);
    if (orders.length) {
      if (!(await this.talk(phrase('raccoon.ship.cargo')))) return;
      for (const o of orders) if (!(await this.order(o, built))) return;
    }
    this.finish();
  }

  /** The palette: tapping a colour picks it and says its English name. */
  private palette(y: number) {
    BLOCKS.forEach((b, i) => {
      const x = W / 2 - 2 * 130 + i * 130 + 40;
      const mark = this.keep(this.add.rectangle(x, y, 112, 112, 0xffffff, 0).setStrokeStyle(8, 0xffffff));
      const r = this.keep(this.add.rectangle(x, y, 92, 92, PAINT[b]).setStrokeStyle(4, 0x2b2d42).setInteractive({ useHandCursor: true }));
      r.on('pointerup', () => {
        this.setBrush(b);
        voice.say(english(`c-${b}`));
      });
      this.brushMarks.set(b, mark);
    });
    this.setBrush(this.brush);
  }

  private setBrush(b: Block) {
    this.brush = b;
    for (const [k, m] of this.brushMarks) m.setStrokeStyle(8, 0xffffff, k === b ? 1 : 0);
  }

  private drawCell(x: number, y: number, size: number, b: Block | null, empty = 0.25) {
    const r = this.add.rectangle(x, y, size - 4, size - 4, b ? PAINT[b] : 0xffffff, b ? 1 : empty).setStrokeStyle(b ? 3 : 2, 0x2b2d42, b ? 1 : 0.35);
    return r;
  }

  // ---------- 1. copy the blueprint ----------

  private async blueprint(): Promise<Grid | null> {
    this.clear();
    const target = pickBlueprint(this.level, this.rng);
    const built = emptyGrid();
    this.target = target;
    // Blueprint card, top left.
    const bx = 240;
    const by = 200;
    const s = 30;
    this.keep(this.add.rectangle(bx, by, COLS * s + 30, ROWS * s + 60, 0x1d3557).setStrokeStyle(4, 0xf1faee));
    this.keep(this.add.text(bx, by - (ROWS * s) / 2 - 16, 'Чертёж', { fontFamily: FONT, fontSize: '20px', color: '#f1faee' }).setOrigin(0.5));
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) this.keep(this.drawCell(bx - (COLS * s) / 2 + x * s + s / 2, by - (ROWS * s) / 2 + 12 + y * s + s / 2, s, target[y]![x] ?? null, 0.07));
    // The build grid.
    const cells: Phaser.GameObjects.Rectangle[][] = [];
    const flash: Phaser.GameObjects.Rectangle[] = [];
    for (let y = 0; y < ROWS; y++) {
      cells.push([]);
      for (let x = 0; x < COLS; x++) {
        const c = this.keep(this.drawCell(GX + x * CELL + CELL / 2, GY + y * CELL + CELL / 2, CELL, null).setInteractive({ useHandCursor: true }));
        c.on('pointerup', () => {
          flash.forEach((f) => f.destroy());
          flash.length = 0;
          const now = built[y]![x];
          const next = now === this.brush ? null : this.brush;
          built[y]![x] = next;
          c.setFillStyle(next ? PAINT[next] : 0xffffff, next ? 1 : 0.25).setStrokeStyle(next ? 3 : 2, 0x2b2d42, next ? 1 : 0.35);
          if (next) this.tweens.add({ targets: c, scale: { from: 1.2, to: 1 }, duration: 120 });
        });
        cells[y]!.push(c);
      }
    }
    this.palette(640);
    const t0 = Date.now();
    let attempts = 0;
    const ok = await new Promise<boolean>((resolve) => {
      this.keep(button(this, 1150, 470, 'Готово', () => {
        attempts++;
        this.checks++;
        const r = compare(target, built);
        this.run?.answer({ item: 'blueprint', correct: r.ok, ms: Date.now() - t0, attempt: attempts, missing: r.missing, extra: r.extra, wrong: r.wrong, skill: 'spatial' });
        if (r.ok) return resolve(true);
        // Show where it differs.
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < COLS; x++)
            if ((target[y]![x] ?? null) !== built[y]![x]) {
              const f = this.keep(this.add.rectangle(cells[y]![x]!.x, cells[y]![x]!.y, CELL - 2, CELL - 2).setStrokeStyle(6, 0xff006e));
              this.tweens.add({ targets: f, alpha: 0.2, yoyo: true, repeat: -1, duration: 300 });
              flash.push(f);
            }
        void this.talk(phrase('raccoon.ship.fix'));
      }, { w: 200, h: 90, color: 0x2a9d8f }));
      this.events.once('shutdown', () => resolve(false));
    });
    if (!ok || !this.sys.isActive()) return null;
    // The boat slides down the slipway.
    if (!(await this.talk(phrase('raccoon.ship.built')))) return null;
    return built;
  }

  // ---------- 2. English orders ----------

  private async order(o: Order, boat: Grid): Promise<boolean> {
    this.clear();
    this.current = o;
    // The finished boat, small, on the left; the cargo deck in the middle.
    const s = 34;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const b = boat[y]![x];
        if (b) this.keep(this.drawCell(150 + x * s, 120 + y * s, s, b));
      }
    this.keep(this.add.text(W / 2 + 40, 130, '♪ ♪ ♪', { fontFamily: FONT, fontSize: '56px', color: '#1d3557' }).setOrigin(0.5));
    const deck: (Block | null)[] = Array(CARGO).fill(null);
    const x0 = W / 2 + 40 - (CARGO * 100) / 2 + 50;
    this.keep(this.add.rectangle(W / 2 + 40, 330, CARGO * 100 + 40, 140, 0x7a4a24).setStrokeStyle(6, 0x3d2b1f));
    const cells = deck.map((_, i) => {
      const c = this.keep(this.add.rectangle(x0 + i * 100, 330, 90, 90, 0xffffff, 0.25).setStrokeStyle(2, 0xffffff, 0.6).setInteractive({ useHandCursor: true }));
      c.on('pointerup', () => {
        deck[i] = deck[i] === this.brush ? null : this.brush;
        const b = deck[i];
        c.setFillStyle(b ? PAINT[b] : 0xffffff, b ? 1 : 0.25).setStrokeStyle(b ? 4 : 2, b ? 0x2b2d42 : 0xffffff, b ? 1 : 0.6);
      });
      return c;
    });
    void cells;
    this.palette(640);
    const say = () => voice.say(english(orderLine(o)));
    this.keep(button(this, 1150, 130, 'Повтори', () => {
      replays++;
      say();
    }, { w: 200, h: 80, color: 0x457b9d }));
    let replays = 0;
    let tries = 0;
    const t0 = Date.now();
    if (!(await this.talk(english(orderLine(o))))) return false;
    for (;;) {
      const done = await new Promise<boolean>((resolve) => {
        const b = this.keep(button(this, 1150, 470, 'Готово', () => {
          b.destroy();
          resolve(true);
        }, { w: 200, h: 90, color: 0x2a9d8f }));
        this.events.once('shutdown', () => resolve(false));
      });
      if (!done || !this.sys.isActive()) return false;
      tries++;
      const r = checkOrder(o, deck);
      this.run?.answer({ item: orderLine(o), correct: r.ok, ms: Date.now() - t0, attempt: tries, got: r.got, others: r.others, replays, skill: 'listening' });
      if (tries === 1) {
        recordWord(`c-${o.color}`, (deck.includes(o.color) && r.others === 0) || r.ok, 'shipyard');
        recordWord(`n${o.count}`, r.got === o.count, 'shipyard');
      }
      if (r.ok) {
        this.ordersTotal++;
        if (tries === 1) this.ordersRight++;
        return this.talk(phrase('raccoon.ship.ok'));
      }
      // A hint that grows: first again in English, then a picture of the order.
      const hint: Utterance[] = [phrase(r.others ? 'raccoon.ship.color' : 'raccoon.ship.count'), english(orderLine(o))];
      if (tries >= 2)
        for (let i = 0; i < o.count; i++) this.keep(this.drawCell(W / 2 + 40 - ((o.count - 1) * 50) / 2 + i * 50, 210, 46, o.color));
      if (!(await this.talk(...hint))) return false;
    }
  }

  private finish() {
    this.clear();
    const clean = this.checks === 1 && this.ordersRight === this.ordersTotal;
    const poor = this.checks > 3 || (this.ordersTotal > 0 && this.ordersRight === 0);
    const next = nextLevel(this.level, clean, poor);
    try {
      localStorage.setItem(KEY, JSON.stringify({ level: next }));
    } catch {
      /* private mode */
    }
    const stars = clean ? 3 : poor ? 1 : 2;
    this.run?.end({ completed: true, stars, checks: this.checks, score: this.ordersRight, total: this.ordersTotal, levelChange: next - this.level });
    this.run = undefined;
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive());
    this.keep(this.add.rectangle(W / 2, H / 2, 760, 420, 0xfffaf0).setStrokeStyle(8, 0x7a4a24));
    this.keep(this.add.text(W / 2, 200, 'Корабль на воде!', { fontFamily: FONT, fontSize: '50px', color: '#7a4a24' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) this.keep(this.add.star(W / 2 - 110 + i * 110, 300, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    this.keep(button(this, W / 2 - 170, 440, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    this.keep(button(this, W / 2 + 170, 440, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    this.layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    void this.talk(phrase('raccoon.ship.end'));
  }
}
