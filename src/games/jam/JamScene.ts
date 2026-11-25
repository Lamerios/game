import Phaser from 'phaser';
import { showProgress } from '../common/progressUi';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, phrase, type Utterance } from '../../core/phrases';
import { button, FONT, H, W } from '../../scenes/ui';
import { beep } from '../common/beep';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { apply, dirWord, EXIT_ROW, generate, MAX_LEVEL, N, nextLevel, range, solve, solved, stars, type Boat, type Puzzle } from './logic';

const KEY = 'jam-progress';
const CELL = 96;
const BX = 330;
const BY = 96;
const PUZZLES = 3;
const BOAT_COLORS = [0x277da1, 0x52b788, 0xffd166, 0x9b5de5, 0xf4a261, 0x4cc9f0, 0x8d99ae, 0xb5651d, 0x43aa8b, 0xf72585, 0x90be6d, 0x577590];

/** «Затор в гавани»: slide the boats so the yacht can sail out. Planning ahead + spatial. */
export class JamScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  /** The level this game started on (the level changes between puzzles). */
  private startLevel = 1;
  private run?: Run;
  private talkToken = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private boats: Boat[] = [];
  private sprites: Phaser.GameObjects.Container[] = [];
  private puzzle?: Puzzle;
  private moves = 0;
  private hints = 0;
  private index = 0;
  private busy = false;
  private t0 = 0;
  private starsTotal = 0;
  private movesText?: Phaser.GameObjects.Text;
  private levelText?: Phaser.GameObjects.Text;
  private hintMark?: Phaser.GameObjects.Rectangle;
  private nudged = false;

  constructor() {
    super('Jam');
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
    this.index = 0;
    this.starsTotal = 0;
    this.drawHarbor();
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    const parrot = this.add.image(1150, 560, 'char-rumb').setDisplaySize(170, 170).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: parrot, angle: 4, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    parrot.on('pointerup', () => this.hint());
    this.add.text(1150, 660, 'Подсказка', { fontFamily: FONT, fontSize: '24px', color: '#fff', stroke: '#0b2233', strokeThickness: 5 }).setOrigin(0.5);
    this.levelText = this.add.text(40, 40, '', { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#0b2233', strokeThickness: 6 }).setOrigin(0, 0.5);
    this.movesText = this.add.text(1060, 160, '', { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#0b2233', strokeThickness: 6, align: 'center' }).setOrigin(0.5, 0);
    this.run = startRun('jam', { level: this.level });
    this.startLevel = this.level;
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false });
    });
    this.time.delayedCall(0, () => void this.start(true));
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

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private clear() {
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
    this.sprites = [];
    this.hintMark = undefined;
  }

  private drawHarbor() {
    const g = this.add.graphics();
    g.fillStyle(0x1b4965).fillRect(0, 0, W, H);
    // Stone pier around the berths, the open sea behind the exit.
    g.fillStyle(0x8d99ae).fillRoundedRect(BX - 26, BY - 26, N * CELL + 52, N * CELL + 52, 18);
    g.fillStyle(0x48cae4).fillRect(BX, BY, N * CELL, N * CELL);
    for (let i = 1; i < N; i++) {
      g.lineStyle(2, 0xffffff, 0.25).lineBetween(BX + i * CELL, BY, BX + i * CELL, BY + N * CELL);
      g.lineBetween(BX, BY + i * CELL, BX + N * CELL, BY + i * CELL);
    }
    // The gap in the pier: the way out.
    const ey = BY + EXIT_ROW * CELL;
    g.fillStyle(0x48cae4).fillRect(BX + N * CELL, ey, 40, CELL);
    g.fillStyle(0x0096c7).fillRect(BX + N * CELL + 26, ey - 60, 120, CELL + 120);
    this.add.text(BX + N * CELL + 92, ey + CELL / 2, '➜', { fontFamily: FONT, fontSize: '64px', color: '#ffd166' }).setOrigin(0.5);
    this.add.text(BX + N * CELL + 92, ey - 30, 'Выход', { fontFamily: FONT, fontSize: '24px', color: '#fff' }).setOrigin(0.5);
  }

  private async start(first: boolean) {
    this.clear();
    this.levelText?.setText(`Затор в гавани · уровень ${this.level} · гавань ${this.index + 1} из ${PUZZLES}`);
    const wait = this.keep(this.add.text(BX + (N * CELL) / 2, BY + (N * CELL) / 2, 'Расставляю лодки…', { fontFamily: FONT, fontSize: '36px', color: '#fff' }).setOrigin(0.5));
    await new Promise((r) => this.time.delayedCall(30, r));
    if (!this.sys.isActive()) return;
    wait.destroy();
    this.puzzle = generate(this.level, this.rng);
    this.boats = this.puzzle.boats.map((b) => ({ ...b }));
    this.moves = 0;
    this.hints = 0;
    this.nudged = false;
    this.busy = false;
    this.boats.forEach((b, i) => this.sprites.push(this.boatSprite(b, i)));
    this.updateMoves();
    this.t0 = Date.now();
    this.run?.ask(`jam.${this.level}`, { min: this.puzzle.min, boats: this.boats.length });
    const firstTime = first && !localStorage.getItem(KEY);
    await this.talk(phrase(first ? (firstTime ? 'rumb.jam.hello' : 'rumb.jam.back') : 'rumb.jam.again'));
  }

  private updateMoves() {
    this.movesText?.setText(`Ходов: ${this.moves}\nМожно за: ${this.puzzle?.min ?? 0}`);
  }

  private pos(b: Boat) {
    const w = b.dir === 'h' ? b.len * CELL : CELL;
    const h = b.dir === 'v' ? b.len * CELL : CELL;
    return { x: BX + b.x * CELL + w / 2, y: BY + b.y * CELL + h / 2, w, h };
  }

  private boatSprite(b: Boat, i: number): Phaser.GameObjects.Container {
    const p = this.pos(b);
    const w = p.w - 12;
    const h = p.h - 12;
    const g = this.add.graphics();
    const color = i === 0 ? 0xe63946 : BOAT_COLORS[(i - 1) % BOAT_COLORS.length]!;
    // Hull with a pointed bow: to the right for horizontal boats, up for vertical ones.
    const hull = (inset: number, fill: number) => {
      g.fillStyle(fill);
      const x0 = -w / 2 + inset;
      const y0 = -h / 2 + inset;
      const x1 = w / 2 - inset;
      const y1 = h / 2 - inset;
      const pts =
        b.dir === 'h'
          ? [x0, y0, x1 - 30, y0, x1, 0, x1 - 30, y1, x0, y1]
          : [x0, y1, x0, y0 + 30, 0, y0, x1, y0 + 30, x1, y1];
      const v: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < pts.length; k += 2) v.push(new Phaser.Math.Vector2(pts[k]!, pts[k + 1]!));
      g.fillPoints(v, true);
    };
    hull(0, 0x2b2d42);
    hull(5, color);
    hull(18, 0xf1faee);
    if (i === 0) {
      // The yacht: a mast and a sail.
      g.fillStyle(0xffd166).fillTriangle(-34, -24, -34, 24, 22, 0);
      g.lineStyle(5, 0x2b2d42).strokeTriangle(-34, -24, -34, 24, 22, 0);
    } else {
      for (let k = 0; k < b.len; k++) {
        const c = (k - (b.len - 1) / 2) * CELL;
        g.fillStyle(0x6c4a2f).fillCircle(b.dir === 'h' ? c : 0, b.dir === 'v' ? c : 0, 10);
      }
    }
    const box = this.keep(this.add.container(p.x, p.y, [g]).setSize(w, h).setInteractive({ useHandCursor: true, draggable: true }));
    let lo = 0;
    let hi = 0;
    let startX = 0;
    let startY = 0;
    box.on('dragstart', () => {
      if (this.busy) return;
      [lo, hi] = range(this.boats, i);
      startX = box.x;
      startY = box.y;
      box.setScale(1.03);
    });
    box.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      if (this.busy) return;
      const b2 = this.boats[i]!;
      if (b2.dir === 'h') box.x = Phaser.Math.Clamp(dx, startX + lo * CELL, startX + hi * CELL);
      else box.y = Phaser.Math.Clamp(dy, startY + lo * CELL, startY + hi * CELL);
    });
    box.on('dragend', () => {
      box.setScale(1);
      if (this.busy) return;
      const b2 = this.boats[i]!;
      const delta = Math.round(b2.dir === 'h' ? (box.x - startX) / CELL : (box.y - startY) / CELL);
      this.commit(i, delta);
    });
    return box;
  }

  private commit(i: number, delta: number) {
    const b = this.boats[i]!;
    if (delta !== 0) {
      this.boats = apply(this.boats, { boat: i, delta });
      this.moves++;
      this.updateMoves();
      this.hintMark?.destroy();
      this.hintMark = undefined;
      voice.say(english(dirWord(b, delta)));
      beep(this, [520, 660], 0.06);
      this.run?.event('move', { boat: i, delta, moves: this.moves });
    }
    const p = this.pos(this.boats[i]!);
    this.tweens.add({ targets: this.sprites[i], x: p.x, y: p.y, duration: 120 });
    if (solved(this.boats)) return void this.win();
    // Lots of moves without progress: one calm reminder to look at what blocks the yacht.
    if (!this.nudged && this.puzzle && this.moves >= this.puzzle.min * 3 + 4) {
      this.nudged = true;
      void this.talk(phrase('rumb.jam.stuck'));
    }
  }

  /** Parrot: first tap shows which boat to move next, the next tap makes that move. */
  private hint() {
    if (this.busy || !this.puzzle) return;
    const sol = solve(this.boats);
    if (!sol || !sol.length) return;
    const m = sol[0]!;
    this.hints++;
    this.run?.event('hint', { step: this.hints, moves: this.moves });
    if (!this.hintMark) {
      const s = this.sprites[m.boat]!;
      const p = this.pos(this.boats[m.boat]!);
      this.hintMark = this.keep(this.add.rectangle(s.x, s.y, p.w, p.h).setStrokeStyle(8, 0xff006e));
      this.tweens.add({ targets: this.hintMark, alpha: 0.2, yoyo: true, repeat: -1, duration: 300 });
      void this.talk(phrase('rumb.jam.think'));
      return;
    }
    this.hintMark.destroy();
    this.hintMark = undefined;
    void this.talk(phrase('rumb.jam.show'));
    this.busy = true;
    this.time.delayedCall(700, () => {
      this.busy = false;
      if (this.sys.isActive()) this.commit(m.boat, m.delta);
    });
  }

  private async win() {
    this.busy = true;
    const min = this.puzzle!.min;
    const s = stars(this.moves, min, this.hints);
    this.starsTotal += s;
    this.run?.answer({ item: `jam.${this.level}`, correct: this.hints < 2, ms: Date.now() - this.t0, level: this.level, moves: this.moves, min, hints: this.hints, stars: s, skill: 'planning' });
    const yacht = this.sprites[0]!;
    beep(this, [523, 659, 784, 1046], 0.1);
    this.tweens.add({ targets: yacht, x: yacht.x + 3 * CELL, alpha: 0, duration: 900, ease: 'Sine.easeIn' });
    const next = nextLevel(this.level, s);
    try {
      localStorage.setItem(KEY, JSON.stringify({ level: next }));
    } catch {
      /* private mode */
    }
    this.level = next;
    if (!(await this.talk(phrase(this.moves <= min ? 'rumb.jam.best' : 'rumb.jam.ok')))) return;
    this.index++;
    if (this.index < PUZZLES) return void this.start(false);
    this.finish();
  }

  private finish() {
    this.clear();
    const stars = Math.round(this.starsTotal / PUZZLES);
    this.run?.end({ completed: true, stars, level: this.level });
    this.run = undefined;
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive());
    this.keep(this.add.rectangle(W / 2, H / 2, 760, 420, 0xfffaf0).setStrokeStyle(8, 0x1b4965));
    this.keep(this.add.text(W / 2, 200, 'Гавань свободна!', { fontFamily: FONT, fontSize: '50px', color: '#1b4965' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) this.keep(this.add.star(W / 2 - 110 + i * 110, 300, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    this.keep(button(this, W / 2 - 170, 440, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    this.keep(button(this, W / 2 + 170, 440, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    this.layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    showProgress(this, { game: 'jam', level: this.startLevel, stars, next: this.level });
    void this.talk(phrase('rumb.jam.end'));
  }
}
