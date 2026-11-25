import Phaser from 'phaser';
import { showProgress } from '../common/progressUi';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import { button, FONT, H, W } from '../../scenes/ui';
import { beep, bell } from '../common/beep';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { copy, CUP_COLORS, CUP_PAINT, drop, MAX_LEVEL, nextLevel, planRounds, turn, type Board, type Cell, type Round, type Step } from './logic';

const KEY = 'machine-progress';
const CX = 600;
const TOP = 165;

/** «Машина Болтика»: predict where the ball lands, then check; later work backwards to ring the bell. */
export class MachineScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  /** The level this game started on (the level changes between puzzles). */
  private startLevel = 1;
  private run?: Run;
  private talkToken = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private board: Board = [];
  private cellObjs: Phaser.GameObjects.Container[][] = [];
  private cell = 100;
  private right = 0;
  private total = 0;
  private flipperTold = false;
  /** Resolves the current tap question (cup / chute index, or 'go' for Пуск). */
  private onPick?: (v: number) => void;

  constructor() {
    super('Machine');
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    let saved: { level?: number; flipper?: boolean } = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    } catch {
      saved = {};
    }
    const v = Number(saved.level);
    this.level = v >= 1 && v <= MAX_LEVEL ? v : 1;
    this.flipperTold = !!saved.flipper;
    this.layer = [];
    this.right = 0;
    this.total = 0;
    const g = this.add.graphics();
    g.fillGradientStyle(0xf4e1b5, 0xf4e1b5, 0xe9c46a, 0xe9c46a).fillRect(0, 0, W, H);
    this.add.image(1110, 560, 'char-raccoon').setDisplaySize(200, 200);
    this.add.text(40, 40, `Машина Болтика · уровень ${this.level}`, { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#3d2b1f', strokeThickness: 6 }).setOrigin(0, 0.5);
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.run = startRun('machine', { level: this.level });
    this.startLevel = this.level;
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

  private line(id: string) {
    return phrase(`raccoon.machine.${id}` as PhraseId);
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private clear() {
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
    this.cellObjs = [];
    this.onPick = undefined;
  }

  private wait(ms: number) {
    return new Promise<boolean>((r) => this.time.delayedCall(ms, () => r(this.sys.isActive())));
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ level: this.level, flipper: this.flipperTold }));
    } catch {
      /* private mode */
    }
  }

  // ---------- geometry ----------

  private get cols() {
    return this.board[0]!.length;
  }
  private get rows() {
    return this.board.length;
  }
  private x(col: number) {
    return CX - (this.cols * this.cell) / 2 + col * this.cell + this.cell / 2;
  }
  private y(row: number) {
    return TOP + row * this.cell + this.cell / 2;
  }
  private get cupY() {
    return TOP + this.rows * this.cell + 50;
  }

  // ---------- drawing ----------

  private drawPiece(c: Cell, s: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const h = s * 0.36;
    if (c === '<' || c === '>') {
      // A plank sloping down towards where it sends the ball.
      const dir = c === '<' ? -1 : 1;
      g.lineStyle(16, 0x2b2d42).lineBetween(-dir * h, -h * 0.6, dir * h, h * 0.6);
      g.lineStyle(10, 0xb5651d).lineBetween(-dir * h, -h * 0.6, dir * h, h * 0.6);
      g.fillStyle(0x2b2d42).fillCircle(dir * h, h * 0.6 + 2, 5);
    } else if (c === 'a' || c === 'b') {
      // A flipper: a paddle on a pin, tilted to the side it pushes to now.
      const dir = c === 'a' ? -1 : 1;
      g.lineStyle(14, 0x2b2d42).lineBetween(-dir * h, -h * 0.7, dir * h * 0.7, h * 0.5);
      g.lineStyle(8, 0xf4a261).lineBetween(-dir * h, -h * 0.7, dir * h * 0.7, h * 0.5);
      g.fillStyle(0xf72585).fillCircle(0, 0, 11).lineStyle(4, 0x2b2d42).strokeCircle(0, 0, 11);
    } else if (c === '#') {
      g.fillStyle(0x6c757d).fillRoundedRect(-h, -h * 0.4, h * 2, h * 0.9, 8).lineStyle(4, 0x2b2d42).strokeRoundedRect(-h, -h * 0.4, h * 2, h * 0.9, 8);
      g.lineStyle(5, 0xffffff).lineBetween(-h * 0.4, -h * 0.1, h * 0.4, h * 0.3).lineBetween(h * 0.4, -h * 0.1, -h * 0.4, h * 0.3);
    }
    return g;
  }

  private drawBoard(bellCup: number | null) {
    const s = this.cell;
    const w = this.cols * s;
    const hgt = this.rows * s;
    this.keep(this.add.rectangle(CX, TOP + hgt / 2, w + 30, hgt + 20, 0x7a4a24).setStrokeStyle(6, 0x3d2b1f));
    for (let r = 0; r < this.rows; r++) {
      this.cellObjs.push([]);
      for (let c = 0; c < this.cols; c++) {
        // Pegboard holes.
        this.keep(this.add.circle(this.x(c) - s / 2 + 8, this.y(r) - s / 2 + 8, 3, 0x3d2b1f, 0.6));
        const box = this.keep(this.add.container(this.x(c), this.y(r), [this.drawPiece(this.board[r]![c]!, s)]));
        this.cellObjs[r]!.push(box);
      }
    }
    // Chutes on top, cups below.
    for (let c = 0; c < this.cols; c++) {
      const fx = this.x(c);
      // Graphics, not a Triangle shape: Phaser centres a Triangle on its bounding box, which shifts it sideways.
      const fun = this.keep(this.add.graphics({ x: fx, y: TOP - 40 }));
      fun.fillStyle(0x8d99ae).fillTriangle(-s * 0.35, -22, s * 0.35, -22, 0, 22).lineStyle(4, 0x2b2d42).strokeTriangle(-s * 0.35, -22, s * 0.35, -22, 0, 22);
      const color = CUP_COLORS[c % CUP_COLORS.length]!;
      const cup = this.keep(this.add.rectangle(fx, this.cupY, s * 0.78, 64, CUP_PAINT[color]).setStrokeStyle(5, 0x2b2d42));
      cup.setData('cup', c);
      if (c === bellCup) {
        const b = this.keep(this.add.text(fx, this.cupY + 2, '🔔', { fontSize: '40px' }).setOrigin(0.5));
        this.tweens.add({ targets: b, angle: 12, yoyo: true, repeat: -1, duration: 300 });
      }
    }
  }

  private setCell(st: Step, c: Cell) {
    this.board[st.row]![st.col] = c;
    const box = this.cellObjs[st.row]![st.col]!;
    box.removeAll(true);
    box.add(this.drawPiece(c, this.cell));
    this.tweens.add({ targets: box, scale: { from: 1.25, to: 1 }, duration: 200 });
  }

  /** Taps on cups or chutes resolve `onPick`. */
  private makeTargets(kind: 'cup' | 'chute') {
    for (let c = 0; c < this.cols; c++) {
      const y = kind === 'cup' ? this.cupY : TOP - 40;
      const hit = this.keep(this.add.rectangle(this.x(c), y, this.cell * 0.9, 90, 0xffffff, 0.001).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => this.onPick?.(c));
    }
  }

  private ask(): Promise<number> {
    return new Promise((resolve) => {
      this.onPick = (v) => {
        this.onPick = undefined;
        resolve(v);
      };
      this.events.once('shutdown', () => resolve(-2));
    });
  }

  private mark(col: number, kind: 'cup' | 'chute', color = 0x2b2d42) {
    const y = kind === 'cup' ? this.cupY + 56 : TOP - 85;
    return this.keep(this.add.text(this.x(col), y, kind === 'cup' ? '▲' : '▼', { fontFamily: FONT, fontSize: '40px', color: `#${color.toString(16).padStart(6, '0')}` }).setOrigin(0.5));
  }

  /** Rolls a ball and animates it; flippers on the way turn over. Returns the cup (-1: stopper). */
  private async roll(chute: number, slow = false): Promise<number | null> {
    const d = drop(this.board, chute);
    const ball = this.keep(this.add.circle(this.x(chute), TOP - 40, this.cell * 0.17, 0xadb5bd).setStrokeStyle(4, 0x2b2d42).setDepth(5));
    const step = slow ? 420 : 260;
    const pts = d.path.map((p) => ({ x: this.x(p.col), y: p.row < this.rows ? this.y(p.row) : this.cupY - 10 }));
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      await new Promise<void>((r) => this.tweens.add({ targets: ball, x: p.x, y: p.y, duration: step, ease: i === 0 ? 'Quad.easeIn' : 'Linear', onComplete: () => r() }));
      if (!this.sys.isActive()) return null;
      if (slow) this.keep(this.add.circle(p.x, p.y, 6, 0xff006e));
      const at = d.path[i]!;
      if (at.row >= this.rows) break;
      const c = this.board[at.row]![at.col]!;
      if (c !== '.') beep(this, [c === '#' ? 180 : 700 + at.row * 60], 0.05);
      if (c === 'a' || c === 'b') this.setCell(at, d.after[at.row]![at.col]!);
    }
    if (d.cup < 0) {
      beep(this, [220, 160], 0.12, 'square', 0.08);
      await this.talk(this.line('stopper'));
    } else {
      beep(this, [880], 0.08);
      voice.say(english(`c-${CUP_COLORS[d.cup % CUP_COLORS.length]}`));
      await this.wait(600);
    }
    this.tweens.add({ targets: ball, alpha: 0, delay: 300, duration: 300 });
    return d.cup;
  }

  // ---------- rounds ----------

  private async play() {
    const first = !localStorage.getItem(KEY);
    if (!(await this.talk(this.line(first ? 'hello' : 'back')))) return;
    const rounds = planRounds(this.level, this.rng);
    for (const r of rounds) {
      const ok = await this.round(r);
      if (ok === null) return;
      this.total++;
      if (ok) this.right++;
    }
    this.finish();
  }

  private setup(r: Round, bellCup: number | null) {
    this.clear();
    this.board = copy(r.board);
    this.cell = Math.min(112, Math.floor(420 / this.rows), Math.floor(760 / this.cols));
    this.drawBoard(bellCup);
  }

  private async explainFlippers(): Promise<boolean> {
    if (this.flipperTold || !this.board.some((row) => row.some((c) => c === 'a' || c === 'b'))) return true;
    this.flipperTold = true;
    this.save();
    return this.talk(this.line('flipper'));
  }

  /** true: right first time; false: needed more; null: left the scene. */
  private async round(r: Round): Promise<boolean | null> {
    if (r.kind === 'predict' || r.kind === 'twice') {
      this.setup(r, null);
      this.mark(r.chute, 'chute', 0xe63946);
      this.makeTargets('cup');
      if (!(await this.explainFlippers())) return null;
      const balls = r.kind === 'twice' ? 2 : 1;
      let all = true;
      for (let k = 0; k < balls; k++) {
        if (!(await this.talk(this.line(k === 0 ? 'predict' : 'second')))) return null;
        const t0 = Date.now();
        const pick = await this.ask();
        if (pick < -1) return null;
        const m = this.mark(pick, 'cup');
        const cup = await this.roll(r.chute);
        if (cup === null) return null;
        const ok = cup === pick;
        this.run?.answer({ item: `${r.kind}.${k + 1}`, correct: ok, chosen: String(pick), ms: Date.now() - t0, level: this.level, skill: 'causal' });
        m.destroy();
        if (ok) {
          if (!(await this.talk(this.line('right')))) return null;
        } else {
          all = false;
          if (!(await this.talk(this.line('wrong')))) return null;
          // Replay slowly with a trail, from the same board as before this ball.
          const after = copy(this.board);
          this.restore(k === 0 ? r.board : this.boardBefore);
          if ((await this.roll(r.chute, true)) === null) return null;
          this.restore(after);
        }
        this.boardBefore = copy(this.board);
      }
      return all;
    }
    if (r.kind === 'chute') {
      this.setup(r, r.bell);
      this.makeTargets('chute');
      if (!(await this.explainFlippers())) return null;
      if (!(await this.talk(this.line('chute')))) return null;
      return this.untilBell(r.bell, async (tries) => {
        if (tries === 2) {
          const want = Array.from({ length: this.cols }, (_, c) => c).find((c) => drop(r.board, c).cup === r.bell)!;
          this.mark(want, 'chute', 0xff006e);
          void this.talk(this.line('helpchute'));
        }
        const c = await this.ask();
        if (c < -1) return null;
        const m = this.mark(c, 'chute');
        const got = await this.roll(c);
        m.destroy();
        this.board = copy(r.board);
        this.redraw();
        return got;
      });
    }
    // fix
    this.setup(r, r.bell);
    this.mark(r.chute, 'chute', 0xe63946);
    const frames = r.turnable.map((t) => {
      const f = this.keep(this.add.rectangle(this.x(t.col), this.y(t.row), this.cell - 6, this.cell - 6, 0xffffff, 0.15).setStrokeStyle(6, 0xff006e).setInteractive({ useHandCursor: true }));
      f.on('pointerup', () => {
        if (this.rolling) return;
        this.setCell(t, turn(this.board[t.row]![t.col]!));
        beep(this, [600], 0.05);
        this.turns++;
      });
      return f;
    });
    void frames;
    this.turns = 0;
    this.keep(button(this, 1110, 330, 'Пуск', () => !this.rolling && this.onPick?.(0), { w: 200, h: 90, color: 0x2a9d8f }));
    if (!(await this.explainFlippers())) return null;
    if (!(await this.talk(this.line('fix')))) return null;
    return this.untilBell(r.bell, async (tries) => {
      if (tries === 2) {
        // Point at one ramp that is set wrong in the only solution.
        const wrong = r.turnable.find((t) => {
          const b = copy(this.board);
          b[t.row]![t.col] = turn(b[t.row]![t.col]!);
          return drop(b, r.chute).cup === r.bell;
        }) ?? r.turnable[0]!;
        const h = this.keep(this.add.rectangle(this.x(wrong.col), this.y(wrong.row), this.cell + 8, this.cell + 8).setStrokeStyle(8, 0xffd166));
        this.tweens.add({ targets: h, alpha: 0.2, yoyo: true, repeat: 5, duration: 300 });
        void this.talk(this.line('helpfix'));
      }
      if ((await this.ask()) < -1) return null;
      this.rolling = true;
      const before = copy(this.board);
      const got = await this.roll(r.chute);
      this.rolling = false;
      this.restore(before);
      return got;
    });
  }

  private rolling = false;
  private turns = 0;
  private boardBefore: Board = [];

  private restore(b: Board) {
    this.board = copy(b);
    this.redraw();
  }

  private redraw() {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const box = this.cellObjs[r]![c]!;
        box.removeAll(true);
        box.add(this.drawPiece(this.board[r]![c]!, this.cell));
      }
  }

  /** Repeats a try until the ball rings the bell. */
  private async untilBell(bellCup: number, attempt: (tries: number) => Promise<number | null>): Promise<boolean | null> {
    const t0 = Date.now();
    for (let tries = 0; ; tries++) {
      const got = await attempt(tries);
      if (got === null) return null;
      const ok = got === bellCup;
      this.run?.answer({ item: 'bell', correct: ok, ms: Date.now() - t0, attempt: tries + 1, level: this.level, turns: this.turns, skill: 'causal' });
      if (ok) {
        bell(this);
        if (!(await this.talk(this.line('ring')))) return null;
        return tries === 0;
      }
      if (!(await this.talk(this.line('again')))) return null;
    }
  }

  private finish() {
    this.clear();
    const next = nextLevel(this.level, this.right, this.total);
    const stars = this.right === this.total ? 3 : this.right * 2 >= this.total ? 2 : 1;
    this.run?.end({ completed: true, stars, score: this.right, total: this.total, levelChange: next - this.level });
    this.run = undefined;
    this.level = next;
    this.save();
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive());
    this.keep(this.add.rectangle(W / 2, H / 2, 760, 420, 0xfffaf0).setStrokeStyle(8, 0x7a4a24));
    this.keep(this.add.text(W / 2, 200, 'Машина работает!', { fontFamily: FONT, fontSize: '50px', color: '#7a4a24' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) this.keep(this.add.star(W / 2 - 110 + i * 110, 300, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    this.keep(button(this, W / 2 - 170, 440, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    this.keep(button(this, W / 2 + 170, 440, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    this.layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    showProgress(this, { game: 'machine', level: this.startLevel, stars, next: this.level });
    void this.talk(this.line('end'));
  }
}
