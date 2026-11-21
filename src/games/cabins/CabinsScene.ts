import Phaser from 'phaser';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { join, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import { button, FONT, H, W } from '../../scenes/ui';
import { beep } from '../common/beep';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { CLUE_WORD, clueParts, generate, holds, MAX_LEVEL, nextLevel, type Clue, type Door, type Plan, type Puzzle, type Who } from './logic';

const KEY = 'cabins-progress';
const PUZZLES = 2;
const DOOR_PAINT: Record<Door, number> = { red: 0xe63946, blue: 0x277da1, green: 0x52b788, yellow: 0xffd166, orange: 0xf4a261, white: 0xf8f9fa };
const tex = (w: Who) => (w === 'strelka' ? 'strelka-4' : `char-${w}`);

/** «Кто в какой каюте?»: settle the crew so every clue is true. Deduction + spatial words. */
export class CabinsScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  private run?: Run;
  private talkToken = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private puzzle?: Puzzle;
  /** Cabin index → who is there (or undefined). */
  private placed: (Who | undefined)[] = [];
  private locked = new Set<number>();
  private selected?: Who;
  private portraits = new Map<Who, Phaser.GameObjects.Image>();
  private home = new Map<Who, { x: number; y: number }>();
  private cabinPos: { x: number; y: number }[] = [];
  private marks: Phaser.GameObjects.Text[] = [];
  private checks = 0;
  private index = 0;
  private clean = 0;
  private t0 = 0;
  private cabinSize = 170;
  private checkBtn?: Phaser.GameObjects.Container;
  private resolveDone?: () => void;

  constructor() {
    super('Cabins');
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
    this.clean = 0;
    const g = this.add.graphics();
    g.fillGradientStyle(0x8ecae6, 0x8ecae6, 0x219ebc, 0x219ebc).fillRect(0, 0, W, H);
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.run = startRun('cabins', { level: this.level });
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
      await voice.idle(12000);
      if (!this.sys.isActive()) return false;
    }
    return token === this.talkToken;
  }

  private line(id: string) {
    return phrase(`kettle.cab.${id}` as PhraseId);
  }

  private clueLine(c: Clue): Utterance {
    return join(...clueParts(c).map((p) => this.line(p)));
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private clear() {
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
    this.portraits.clear();
    this.home.clear();
    this.marks = [];
    this.locked.clear();
    this.selected = undefined;
  }

  private async play() {
    const first = !localStorage.getItem(KEY);
    for (this.index = 0; this.index < PUZZLES; this.index++) {
      const ok = await this.puzzleRound(this.index === 0 ? (first ? 'hello' : 'back') : 'next');
      if (ok === null) return;
    }
    this.finish();
  }

  // ---------- one puzzle ----------

  private async puzzleRound(intro: string): Promise<boolean | null> {
    this.clear();
    const p = generate(this.level, this.rng);
    this.puzzle = p;
    this.placed = Array(p.crew.length).fill(undefined);
    this.checks = 0;
    this.keep(this.add.text(40, 40, `Кто в какой каюте? · уровень ${this.level}`, { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#0b2233', strokeThickness: 6 }).setOrigin(0, 0.5));
    this.drawShip(p);
    this.drawClues(p);
    this.drawCrew(p);
    this.checkBtn = this.keep(button(this, 1100, 640, 'Проверить', () => this.check(), { w: 260, h: 90, color: 0x2a9d8f }).setVisible(false));
    this.t0 = Date.now();
    this.run?.ask(`cabins.${this.level}`, { clues: p.clues.length });
    const done = new Promise<void>((r) => (this.resolveDone = r));
    if (!(await this.talk(this.line(intro), this.line('listen'), ...p.clues.map((c) => this.clueLine(c))))) return null;
    const left = new Promise<null>((r) => this.events.once('shutdown', () => r(null)));
    const res = await Promise.race([done.then(() => true), left]);
    return res;
  }

  private drawShip(p: Puzzle) {
    const { rows, cols } = p.layout;
    const size = Math.min(180, Math.floor(620 / cols), Math.floor(380 / rows));
    this.cabinSize = size;
    const x0 = 860 - (cols * size) / 2;
    const y0 = 110;
    // Hull and deck.
    const g = this.keep(this.add.graphics());
    g.fillStyle(0x7a4a24).fillRoundedRect(x0 - 30, y0 - 20, cols * size + 60, rows * size + 40, 24);
    g.lineStyle(6, 0x3d2b1f).strokeRoundedRect(x0 - 30, y0 - 20, cols * size + 60, rows * size + 40, 24);
    this.cabinPos = [];
    for (let i = 0; i < rows * cols; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = x0 + c * size + size / 2;
      const y = y0 + r * size + size / 2;
      this.cabinPos.push({ x, y });
      const door = p.doors[i]!;
      this.keep(this.add.rectangle(x, y, size - 14, size - 14, 0xfff1d6).setStrokeStyle(10, DOOR_PAINT[door]));
      this.keep(this.add.rectangle(x, y - size / 2 + 14, size - 14, 16, DOOR_PAINT[door]).setStrokeStyle(3, 0x2b2d42));
      const hit = this.keep(this.add.rectangle(x, y, size - 14, size - 14, 0xffffff, 0.001).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => this.tapCabin(i));
    }
  }

  private drawClues(p: Puzzle) {
    const h = Math.min(92, Math.floor(560 / p.clues.length));
    p.clues.forEach((c, k) => {
      const y = 120 + k * h + h / 2;
      const card = this.keep(this.add.rectangle(250, y, 440, h - 10, 0xfffaf0).setStrokeStyle(4, 0x7a4a24).setInteractive({ useHandCursor: true }));
      card.on('pointerup', () => void this.talk(this.clueLine(c)));
      const icon = h - 22;
      this.keep(this.add.image(70, y, tex(c.a)).setDisplaySize(icon, icon));
      const word = CLUE_WORD[c.kind];
      if ('door' in c) {
        this.keep(this.add.text(115, y, word, { fontFamily: FONT, fontSize: '26px', color: '#3d2b1f' }).setOrigin(0, 0.5));
        const sw = this.keep(this.add.rectangle(330, y, icon, icon, DOOR_PAINT[c.door]).setStrokeStyle(4, 0x2b2d42));
        if (c.kind === 'notAt') this.keep(this.add.text(sw.x, y, '✕', { fontFamily: FONT, fontSize: `${icon}px`, color: '#2b2d42' }).setOrigin(0.5));
      } else if ('b' in c) {
        this.keep(this.add.text(115, y, word, { fontFamily: FONT, fontSize: '26px', color: '#3d2b1f' }).setOrigin(0, 0.5));
        this.keep(this.add.image(400, y, tex(c.b)).setDisplaySize(icon, icon));
      } else {
        this.keep(this.add.text(115, y, word, { fontFamily: FONT, fontSize: '26px', color: '#3d2b1f' }).setOrigin(0, 0.5));
      }
      this.marks.push(this.keep(this.add.text(445, y, '', { fontFamily: FONT, fontSize: '40px', color: '#2a9d8f' }).setOrigin(0.5)));
    });
  }

  private drawCrew(p: Puzzle) {
    const n = p.crew.length;
    const step = Math.min(150, 680 / n);
    const size = this.portraitSize;
    p.crew.forEach((w, k) => {
      const x = 860 - ((n - 1) * step) / 2 + k * step;
      const y = 560;
      this.home.set(w, { x, y });
      const img = this.keep(this.add.image(x, y, tex(w)).setDisplaySize(size, size).setInteractive({ useHandCursor: true }).setDepth(5));
      img.on('pointerup', () => this.tapWho(w));
      this.portraits.set(w, img);
    });
  }

  private tapWho(w: Who) {
    const at = this.placed.indexOf(w);
    if (at >= 0 && this.locked.has(at)) return;
    this.selected = this.selected === w ? undefined : w;
    beep(this, [600], 0.05);
    this.paintSelection();
  }

  private paintSelection() {
    for (const [k, img] of this.portraits) {
      const baseSize = this.portraitSize;
      img.setDisplaySize(baseSize * (k === this.selected ? 1.15 : 1), baseSize * (k === this.selected ? 1.15 : 1));
      img.setTint(k === this.selected ? 0xfff3b0 : this.locked.has(this.placed.indexOf(k)) ? 0xb7e4c7 : 0xffffff);
    }
  }

  private tapCabin(i: number) {
    if (this.locked.has(i)) return;
    const w = this.selected;
    if (!w) {
      // Tapping an occupied cabin with nobody selected picks its guest up.
      const there = this.placed[i];
      if (there) this.tapWho(there);
      return;
    }
    const from = this.placed.indexOf(w);
    const there = this.placed[i];
    if (from >= 0) this.placed[from] = undefined;
    // A guest already in the cabin swaps to where the new one came from (or back to the deck).
    if (there && there !== w) {
      if (from >= 0) this.placed[from] = there;
      this.moveTo(there, from >= 0 ? from : -1);
    }
    this.placed[i] = w;
    this.moveTo(w, i);
    this.selected = undefined;
    this.paintSelection();
    this.marks.forEach((m) => m.setText(''));
    beep(this, [700, 880], 0.05);
    this.checkBtn?.setVisible(this.placed.every(Boolean));
  }

  private get portraitSize() {
    const n = this.puzzle?.crew.length ?? 3;
    return Math.min(130, this.cabinSize - 30, Math.min(150, 680 / n) - 12);
  }

  private moveTo(w: Who, cabin: number) {
    const img = this.portraits.get(w)!;
    const to = cabin >= 0 ? this.cabinPos[cabin]! : this.home.get(w)!;
    this.tweens.add({ targets: img, x: to.x, y: to.y + (cabin >= 0 ? 8 : 0), duration: 180 });
  }

  private async check() {
    const p = this.puzzle;
    if (!p || !this.placed.every(Boolean)) return;
    this.checks++;
    const plan = this.placed as Plan;
    const results = p.clues.map((c) => holds(c, plan, p.doors, p.layout));
    results.forEach((ok, k) => this.marks[k]!.setText(ok ? '✓' : '✗').setColor(ok ? '#2a9d8f' : '#e63946'));
    const all = results.every(Boolean);
    this.run?.answer({ item: `cabins.${this.level}`, correct: all, attempt: this.checks, broken: results.filter((r) => !r).length, ms: Date.now() - this.t0, level: this.level, skill: 'deduction' });
    if (all) {
      this.checkBtn?.setVisible(false);
      beep(this, [523, 659, 784, 1046], 0.1);
      if (this.checks === 1) this.clean++;
      const next = nextLevel(this.level, this.checks === 1, this.checks);
      this.level = next;
      try {
        localStorage.setItem(KEY, JSON.stringify({ level: next }));
      } catch {
        /* private mode */
      }
      if (!(await this.talk(this.line('solved')))) return;
      this.resolveDone?.();
      return;
    }
    this.cameras.main.shake(150, 0.004);
    const broken = p.clues.filter((_, k) => !results[k]);
    if (this.checks >= 2) {
      // Help: settle one crew member for good, then repeat what is still wrong.
      const i = p.solution.findIndex((w, k) => this.placed[k] !== w && !this.locked.has(k));
      if (i >= 0) {
        const w = p.solution[i]!;
        const there = this.placed[i];
        const from = this.placed.indexOf(w);
        this.placed[from] = there;
        if (there) this.moveTo(there, from);
        this.placed[i] = w;
        this.moveTo(w, i);
        this.locked.add(i);
        this.portraits.get(w)!.setTint(0xb7e4c7);
        this.run?.event('hint', { who: w });
        await this.talk(this.line('help'));
        return;
      }
    }
    await this.talk(this.line('check'), this.clueLine(broken[0]!));
  }

  private finish() {
    this.clear();
    const stars = this.clean === PUZZLES ? 3 : this.clean > 0 ? 2 : 1;
    this.run?.end({ completed: true, stars, score: this.clean, total: PUZZLES, level: this.level });
    this.run = undefined;
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive());
    this.keep(this.add.rectangle(W / 2, H / 2, 760, 420, 0xfffaf0).setStrokeStyle(8, 0x7a4a24));
    this.keep(this.add.text(W / 2, 200, 'Все довольны!', { fontFamily: FONT, fontSize: '50px', color: '#7a4a24' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) this.keep(this.add.star(W / 2 - 110 + i * 110, 300, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    this.keep(button(this, W / 2 - 170, 440, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    this.keep(button(this, W / 2 + 170, 440, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    this.layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    void this.talk(this.line('end'));
  }
}
