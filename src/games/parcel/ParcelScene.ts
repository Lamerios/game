import Phaser from 'phaser';
import { showProgress } from '../common/progressUi';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, ENGLISH, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import { levelLog, levelNote, longestStreak, nextLevelSmart } from '../../core/smartLevel';
import { recordWord } from '../../core/wordLog';
import { button, COLORS, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import {
  ANIMALS, LEVEL_KEY, magpieSteal, makePuzzle, MAX_LEVEL, nextHint, parseLevel, ROUTE_VEHICLES, runPlan, townsOf,
  type Puzzle, type Terrain, type Vehicle,
} from './route';

/** Deliveries in one game. */
const ROUNDS = 4;
const INTRO_KEY = 'parcel-route-intro';
const RULE_KEY = 'parcel-route-rule';
const TRAY_Y = 650;
const BADGE_R = 34;
const TOKEN = 96;

const TERRAIN_COLOR: Record<Terrain, number> = {
  sea: 0x4ea8de, road: 0x6c757d, rails: 0xb08968, sand: 0xe9c46a, snow: 0xf8f9fa, mountains: 0x8d99ae, air: 0xbde0fe,
};

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

interface Token {
  v: Vehicle;
  img: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  /** Way it is laid on, or -1 while in the garage. */
  way: number;
  /** Taken by the magpie. */
  gone: boolean;
}

/**
 * «Посылка», механика «Штурман маршрута». The dispatcher names an animal in
 * English; the child finds it on the map, then lays vehicles from a small
 * garage on the ways to build a whole route from the harbour and presses
 * «Поехали!». The plan runs and stops where it breaks (a boat on sand gets
 * stuck…) or where the laid ways end. From level 2 the obvious way is a trap:
 * the garage can't drive it, so the child has to look for another route.
 * Four deliveries per game; the level (map size, trap, mountains, air ways, the
 * magpie stealing a vehicle) comes from the shared smart level (core/smartLevel).
 */
export class ParcelScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  private round = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private run?: Run;
  private talking = false;
  private talkToken = 0;
  private lastSpoken = 0;
  private repeats = 0;
  private cue?: Utterance;
  private rumb?: Phaser.GameObjects.Image;
  private bubble?: Phaser.GameObjects.Text;
  private puzzle!: Puzzle;
  private tokens: Token[] = [];
  private badges: { disc: Phaser.GameObjects.Arc; c: Phaser.GameObjects.Container }[] = [];
  private selected = -1;
  private busy = false;
  private phase: 'find' | 'plan' | 'done' = 'find';
  private runs = 0;
  private hints = 0;
  private planStart = 0;
  private goBtn?: Phaser.GameObjects.Container;
  private hintBtn?: Phaser.GameObjects.Container;
  private parcel?: Phaser.GameObjects.Image;
  private animalImgs = new Map<number, Phaser.GameObjects.Image>();
  // This game, for the smart level.
  private right = 0;
  private total = 0;
  private planMs: number[] = [];
  private firstOks: boolean[] = [];

  constructor() {
    super('Parcel');
  }

  preload() {
    const base = import.meta.env.BASE_URL;
    for (const id of [...ROUTE_VEHICLES, 'package', 'hut', 'cactus', 'fir', 'mountain', 'cloud']) {
      if (!this.textures.exists(`parcel-${id}`)) this.load.image(`parcel-${id}`, `${base}parcel/${id}.webp`);
    }
    for (const a of ANIMALS) if (!this.textures.exists(`snake-${a}`)) this.load.image(`snake-${a}`, `${base}snake/${a}.webp`);
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.level = parseLevel(readStore<unknown>(LEVEL_KEY, null));
    this.round = 0;
    this.right = 0;
    this.total = 0;
    this.planMs = [];
    this.firstOks = [];
    this.layer = [];
    this.run = startRun('parcel', { level: this.level, mode: 'route' });
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false });
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') this.repeatCue();
    });
    void this.startRound();
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private clear() {
    this.tweens.killAll();
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
    this.tokens = [];
    this.badges = [];
    this.animalImgs.clear();
    this.selected = -1;
    this.cue = undefined;
  }

  // ---------- voice ----------

  private async talk(...lines: Utterance[]): Promise<boolean> {
    const token = ++this.talkToken;
    this.talking = true;
    for (const u of lines) {
      if (token !== this.talkToken) return false;
      const who = !u.lang && u.speaker !== 'magpie' ? this.rumb : undefined;
      const y0 = who?.y ?? 0;
      const bob = who ? this.tweens.add({ targets: who, y: y0 - 10, yoyo: true, repeat: -1, duration: 180 }) : undefined;
      voice.say(u);
      await voice.idle(7000);
      bob?.stop();
      if (who) who.y = y0;
    }
    if (token !== this.talkToken || !this.sys.isActive()) return false;
    this.talking = false;
    this.lastSpoken = this.time.now;
    return true;
  }

  private repeatCue() {
    if (this.talking || !this.cue) return;
    this.lastSpoken = this.time.now;
    voice.say(this.cue);
  }

  private wait(ms: number) {
    return new Promise<boolean>((r) => this.time.delayedCall(ms, () => r(this.sys.isActive())));
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((r) => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  update(time: number) {
    // Nobody found yet: say who gets the parcel again (twice at most).
    if (this.phase === 'find' && this.cue && !this.talking && !this.busy && this.repeats < 2 && time - this.lastSpoken > 10000) {
      this.repeats++;
      this.repeatCue();
    }
  }

  // ---------- one delivery ----------

  private async startRound() {
    this.clear();
    this.puzzle = makePuzzle(this.level, this.rng);
    // Lets the automated play-through read the map (only under a test driver).
    if (navigator.webdriver) (window as unknown as { __parcel: unknown }).__parcel = { ...this.puzzle, tokens: () => this.tokens.map((t) => ({ v: t.v, x: t.home.x, y: t.home.y, gone: t.gone })) };
    this.phase = 'find';
    this.runs = 0;
    this.hints = 0;
    this.busy = true;
    this.repeats = 0;
    this.drawBackground();
    this.drawTopBar();
    this.drawMap();
    this.drawTray();

    const lines: Utterance[] = [];
    if (this.round === 0) {
      if (!readStore(INTRO_KEY, false)) {
        writeStore(INTRO_KEY, true);
        lines.push(phrase('rumb.route.hello'), phrase('rumb.route.how'));
      } else {
        lines.push(phrase('rumb.route.again'));
      }
    }
    this.cue = english(`to.${this.puzzle.target}`);
    this.run?.ask(this.puzzle.target, { skill: 'english' });
    if (!(await this.talk(...lines, this.cue))) return;
    this.busy = false;
  }

  private drawBackground() {
    const g = this.keep(this.add.graphics());
    g.fillGradientStyle(0xa9def9, 0xa9def9, 0xd8f3dc, 0xd8f3dc, 1).fillRect(0, 0, W, H);
    // Soft land patches so it reads as a map, not a diagram.
    g.fillStyle(0xb7e4c7, 0.8);
    for (let k = 0; k < 7; k++) g.fillEllipse(120 + k * 190, 300 + ((k * 97) % 160), 360, 240);
    g.fillStyle(0x8d5524).fillRect(0, TRAY_Y - 60, W, H - TRAY_Y + 60);
    g.lineStyle(4, 0x5c3317);
    for (let y = TRAY_Y - 60; y < H; y += 40) g.lineBetween(0, y, W, y);
  }

  private drawTopBar() {
    const radio = this.keep(this.add.graphics({ x: 56, y: 56 }));
    radio.fillStyle(0x2b2d42).fillRoundedRect(-34, -28, 68, 56, 12);
    radio.fillStyle(0x52b788).fillCircle(-12, 0, 11);
    radio.fillStyle(0xffd166).fillRect(6, -14, 18, 6).fillRect(6, -2, 18, 6).fillRect(6, 10, 18, 6);
    radio.lineStyle(5, 0x2b2d42).lineBetween(18, -28, 32, -48);
    const bg = this.keep(this.add.rectangle(400, 56, 600, 80, 0xfffaf0).setStrokeStyle(5, 0x2b2d42));
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.repeatCue());
    this.bubble = this.keep(this.add.text(400, 56, '?', { fontFamily: FONT, fontSize: '36px', color: '#277da1', fontStyle: 'bold' }).setOrigin(0.5));
    const listen = this.keep(button(this, 860, 56, '     Ещё раз', () => this.repeatCue(), { w: 240, h: 76, color: COLORS.leaf }));
    const icon = this.add.graphics({ x: -80, y: 0 });
    icon.fillStyle(0xffffff).fillRect(-20, -11, 13, 22).fillTriangle(-9, -11, 9, -26, 9, 26).fillTriangle(-9, 11, 9, -26, 9, 26);
    listen.add(icon);
    this.keep(button(this, 1180, 56, 'Домой', () => goHome(this), { w: 160, h: 64, color: 0x6c757d }));
    for (let i = 0; i < ROUNDS; i++) {
      this.keep(this.add.image(1010 + i * 34, 116, 'parcel-package').setDisplaySize(30, 30).setAlpha(i < this.round ? 1 : 0.3));
    }
    this.keep(this.add.text(1180, 116, `Уровень ${this.level}`, { fontFamily: FONT, fontSize: '20px', color: '#2b2d42' }).setOrigin(0.5));
  }

  private mid(i: number) {
    const w = this.puzzle.ways[i]!;
    const a = this.puzzle.towns[w.a]!;
    const b = this.puzzle.towns[w.b]!;
    const lift = w.terrain === 'air' ? 110 : 0;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - lift };
  }

  private drawMap() {
    const p = this.puzzle;
    const g = this.keep(this.add.graphics());
    p.ways.forEach((w, i) => {
      const a = p.towns[w.a]!;
      const b = p.towns[w.b]!;
      if (w.terrain === 'air') {
        // A dotted arc through the sky, passing the badge.
        const m = this.mid(i);
        const ctrl = { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 };
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2(ctrl.x, ctrl.y), new Phaser.Math.Vector2(b.x, b.y));
        curve.getPoints(30).forEach((pt, k) => {
          if (k % 2 === 0) g.fillStyle(0xffffff).fillCircle(pt.x, pt.y, 7).lineStyle(3, 0x4ea8de).strokeCircle(pt.x, pt.y, 7);
        });
        return;
      }
      this.drawBand(g, a, b, w.terrain);
    });
    // Badges: the tap target on each way, with a sign of its terrain.
    p.ways.forEach((w, i) => {
      const m = this.mid(i);
      const disc = this.add.circle(0, 0, BADGE_R, 0xfffaf0).setStrokeStyle(4, 0x2b2d42);
      const c = this.keep(this.add.container(m.x, m.y, [disc, this.terrainSign(w.terrain)]).setSize(BADGE_R * 2 + 12, BADGE_R * 2 + 12).setDepth(3));
      c.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tapWay(i));
      this.badges.push({ disc, c });
    });
    p.towns.forEach((t, i) => {
      this.keep(this.add.circle(t.x, t.y, 42, 0xfff1d0).setStrokeStyle(5, 0x2b2d42).setDepth(2));
      const animal = p.animals[i];
      if (i === p.start) {
        this.keep(this.add.image(t.x, t.y, 'parcel-hut').setDisplaySize(64, 64).setDepth(2));
      } else if (animal) {
        const img = this.keep(this.add.image(t.x, t.y, `snake-${animal}`).setDisplaySize(70, 70).setDepth(2));
        img.setInteractive({ useHandCursor: true }).on('pointerup', () => void this.tapAnimal(i));
        this.animalImgs.set(i, img);
      } else {
        const h = this.keep(this.add.graphics({ x: t.x, y: t.y }).setDepth(2));
        h.fillStyle(0xe76f51).fillTriangle(-24, -2, 0, -24, 24, -2).fillStyle(0xf4f1de).fillRect(-18, -2, 36, 26);
        h.fillStyle(0x264653).fillRect(-6, 8, 12, 16).lineStyle(3, 0x2b2d42).strokeRect(-18, -2, 36, 26);
      }
      if (t.airport) {
        this.keep(this.add.circle(t.x + 36, t.y + 32, 20, 0xffffff).setStrokeStyle(3, 0x4ea8de).setDepth(3));
        this.keep(this.add.image(t.x + 36, t.y + 32, 'parcel-plane').setDisplaySize(30, 30).setDepth(3));
      }
    });
    const s = p.towns[p.start]!;
    this.parcel = this.keep(this.add.image(s.x + 30, s.y - 40, 'parcel-package').setDisplaySize(52, 52).setDepth(6));
    this.rumb = this.keep(this.add.image(60, 548, 'char-rumb').setDisplaySize(96, 96).setDepth(7));
  }

  private drawBand(g: Phaser.GameObjects.Graphics, a: { x: number; y: number }, b: { x: number; y: number }, t: Terrain) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const along = (d: number, off = 0) => ({ x: a.x + ux * d - uy * off, y: a.y + uy * d + ux * off });
    g.lineStyle(40, 0x2b2d42, 0.9).lineBetween(a.x, a.y, b.x, b.y);
    g.lineStyle(34, TERRAIN_COLOR[t]).lineBetween(a.x, a.y, b.x, b.y);
    const from = 50;
    const to = len - 50;
    if (t === 'road') {
      g.lineStyle(4, 0xffffff);
      for (let d = from; d < to; d += 36) {
        const p = along(d);
        const q = along(Math.min(d + 18, to));
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
    } else if (t === 'rails') {
      g.lineStyle(5, 0x5c3317);
      for (let d = from; d < to; d += 18) {
        const p = along(d, -15);
        const q = along(d, 15);
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
      g.lineStyle(4, 0x343a40);
      for (const off of [-8, 8]) {
        const p = along(from, off);
        const q = along(to, off);
        g.lineBetween(p.x, p.y, q.x, q.y);
      }
    } else if (t === 'sea') {
      g.lineStyle(3, 0xffffff, 0.9);
      for (let d = from, k = 0; d < to; d += 28, k++) {
        const p = along(d, k % 2 ? -7 : 7);
        g.beginPath().arc(p.x, p.y, 7, Math.PI * 1.1, Math.PI * 1.9).strokePath();
      }
    } else if (t === 'sand') {
      g.fillStyle(0xbc8a5f);
      for (let d = from, k = 0; d < to; d += 20, k++) {
        const p = along(d, ((k * 7) % 22) - 11);
        g.fillCircle(p.x, p.y, 3);
      }
    } else if (t === 'snow') {
      g.fillStyle(0x9aa5b1);
      for (let d = from, k = 0; d < to; d += 24, k++) {
        const p = along(d, ((k * 5) % 20) - 10);
        g.fillCircle(p.x, p.y, 2.5);
      }
    } else if (t === 'mountains') {
      for (let d = from + 6; d < to - 6; d += 40) {
        const p = along(d);
        g.fillStyle(0x495057).lineStyle(3, 0x2b2d42);
        g.fillTriangle(p.x - 14, p.y + 10, p.x, p.y - 14, p.x + 14, p.y + 10).strokeTriangle(p.x - 14, p.y + 10, p.x, p.y - 14, p.x + 14, p.y + 10);
        g.fillStyle(0xffffff).fillTriangle(p.x - 5, p.y - 5, p.x, p.y - 14, p.x + 5, p.y - 5);
      }
    }
  }

  /** A small sign of the terrain for the badge (never a vehicle: that would give the answer away). */
  private terrainSign(t: Terrain): Phaser.GameObjects.GameObject {
    const pic: Partial<Record<Terrain, string>> = { sand: 'parcel-cactus', snow: 'parcel-fir', mountains: 'parcel-mountain', air: 'parcel-cloud' };
    if (pic[t]) return this.add.image(0, 0, pic[t]!).setDisplaySize(46, 46);
    const g = this.add.graphics();
    if (t === 'sea') {
      g.lineStyle(6, 0x4ea8de);
      for (const y of [-12, 2, 16]) {
        g.beginPath().arc(-11, y + 8, 10, Math.PI * 1.15, Math.PI * 1.85).strokePath();
        g.beginPath().arc(10, y + 8, 10, Math.PI * 1.15, Math.PI * 1.85).strokePath();
      }
    } else if (t === 'road') {
      g.fillStyle(0x6c757d).fillPoints([{ x: -7, y: -26 }, { x: 7, y: -26 }, { x: 24, y: 26 }, { x: -24, y: 26 }] as Phaser.Types.Math.Vector2Like[], true);
      g.fillStyle(0xffffff).fillRect(-2, -18, 4, 9).fillRect(-2, -3, 4, 10).fillRect(-2, 13, 4, 10);
    } else {
      g.lineStyle(5, 0x8d5524);
      for (const y of [-18, -6, 6, 18]) g.lineBetween(-20, y, 20, y);
      g.lineStyle(5, 0x343a40).lineBetween(-9, -26, -9, 26).lineBetween(9, -26, 9, 26);
    }
    return g;
  }

  private drawTray() {
    this.keep(this.add.text(24, TRAY_Y - 52, 'Гараж', { fontFamily: FONT, fontSize: '28px', color: '#ffd166' }));
    const n = this.puzzle.garage.length;
    const step = Math.min(112, 700 / n);
    this.tokens = this.puzzle.garage.map((v, k) => {
      const home = { x: 170 + k * step, y: TRAY_Y + 4 };
      const img = this.keep(this.add.image(home.x, home.y, `parcel-${v}`).setDisplaySize(TOKEN, TOKEN).setDepth(5));
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tapToken(k));
      return { v, img, home, way: -1, gone: false };
    });
    this.goBtn = this.keep(button(this, 1160, TRAY_Y + 8, 'Поехали!', () => void this.go(), { w: 210, h: 96, color: COLORS.leaf }).setDepth(6));
    this.goBtn.setAlpha(0.4);
    this.hintBtn = this.keep(button(this, 960, TRAY_Y + 8, '?', () => void this.hint(), { w: 96, h: 96, color: 0xe09f3e }).setDepth(6));
    this.hintBtn.setVisible(false);
  }

  // ---------- finding the animal (English) ----------

  private async tapAnimal(town: number) {
    const animal = this.puzzle.animals[town]!;
    if (this.busy || this.talking) return;
    const img = this.animalImgs.get(town)!;
    this.tweens.add({ targets: img, scale: img.scale * 1.15, yoyo: true, duration: 150 });
    if (this.phase !== 'find') {
      voice.say(english(animal));
      return;
    }
    const ok = town === this.puzzle.goal;
    this.run?.answer({ item: this.puzzle.target, correct: ok, chosen: ok ? undefined : animal, skill: 'english', level: this.level });
    recordWord(this.puzzle.target, ok, 'parcel', Date.now(), ok ? undefined : [animal]);
    this.busy = true;
    if (!ok) {
      this.tweens.add({ targets: img, angle: { from: -10, to: 10 }, yoyo: true, repeat: 2, duration: 80, onComplete: () => img.setAngle(0) });
      await this.talk(english(animal), english('notme'), this.cue!);
      this.busy = false;
      return;
    }
    this.phase = 'plan';
    this.bubble?.setText(ENGLISH[`to.${this.puzzle.target}`]!).setColor('#1b4332');
    const t = this.puzzle.towns[town]!;
    const flag = this.keep(this.add.graphics({ x: t.x + 30, y: t.y - 40 }).setDepth(4));
    flag.lineStyle(4, 0x2b2d42).lineBetween(0, 0, 0, -44).fillStyle(0xe63946).fillTriangle(0, -44, 30, -36, 0, -28);
    const lines: Utterance[] = [english(this.puzzle.target)];
    if (!readStore(RULE_KEY, false)) {
      writeStore(RULE_KEY, true);
      lines.push(phrase('rumb.route.rule'));
    }
    if (!(await this.talk(...lines))) return;
    // From level 3 the magpie may steal a spare vehicle: the plan has to work without it.
    if (this.level >= 3 && this.rng() < 0.5) await this.magpie();
    if (!this.sys.isActive()) return;
    this.planStart = Date.now();
    this.run?.ask(`route-L${this.level}`, { skill: 'planning' });
    this.busy = false;
  }

  private async magpie() {
    const k = magpieSteal(this.puzzle, this.rng);
    if (k < 0) return;
    const tok = this.tokens[k]!;
    const m = this.keep(this.add.image(W + 100, 200, 'char-magpie').setDisplaySize(120, 120).setDepth(9));
    void this.talk(phrase('magpie.steal'));
    await this.tween({ targets: m, x: tok.img.x, y: tok.img.y - 50, duration: 1000, ease: 'Sine.easeInOut' });
    tok.gone = true;
    tok.img.disableInteractive();
    this.tweens.add({ targets: tok.img, x: W + 100, y: -60, duration: 900, ease: 'Sine.easeIn' });
    await this.tween({ targets: m, x: W + 100, y: -110, duration: 900, ease: 'Sine.easeIn' });
    await this.talk(phrase('rumb.route.magpie'));
  }

  // ---------- laying vehicles ----------

  private tapToken(k: number) {
    if (this.busy || this.talking) return;
    const t = this.tokens[k]!;
    voice.say(english(t.v));
    if (this.phase !== 'plan') return;
    if (t.way >= 0) {
      this.toGarage(t);
      return;
    }
    this.select(this.selected === k ? -1 : k);
  }

  private toGarage(t: Token) {
    t.way = -1;
    this.tweens.killTweensOf(t.img);
    this.tweens.add({ targets: t.img, x: t.home.x, y: t.home.y, displayWidth: TOKEN, displayHeight: TOKEN, duration: 300, ease: 'Quad.easeOut' });
    this.refreshGo();
  }

  private select(k: number) {
    if (this.selected >= 0) {
      const old = this.tokens[this.selected]!;
      this.tweens.killTweensOf(old.img);
      if (old.way < 0) old.img.setPosition(old.home.x, old.home.y);
    }
    this.selected = k;
    if (k < 0) return;
    const t = this.tokens[k]!;
    t.img.setPosition(t.home.x, t.home.y - 22);
    this.tweens.add({ targets: t.img, y: t.home.y - 32, yoyo: true, repeat: -1, duration: 300 });
  }

  private tapWay(i: number) {
    if (this.busy || this.talking || this.phase !== 'plan') return;
    const onIt = this.tokens.find((t) => t.way === i);
    if (this.selected < 0) {
      // Tapping a laid vehicle's way takes it back to the garage.
      if (onIt) this.toGarage(onIt);
      return;
    }
    if (onIt) this.toGarage(onIt);
    const t = this.tokens[this.selected]!;
    this.tweens.killTweensOf(t.img);
    this.selected = -1;
    t.way = i;
    const m = this.mid(i);
    this.tweens.add({ targets: t.img, x: m.x, y: m.y, displayWidth: 70, displayHeight: 70, duration: 350, ease: 'Back.easeOut' });
    this.refreshGo();
  }

  private refreshGo() {
    this.goBtn?.setAlpha(this.tokens.some((t) => t.way >= 0) ? 1 : 0.4);
  }

  private plan(): Map<number, Vehicle> {
    return new Map(this.tokens.filter((t) => t.way >= 0 && !t.gone).map((t) => [t.way, t.v]));
  }

  // ---------- running the plan ----------

  private async go() {
    if (this.busy || this.talking || this.phase !== 'plan') return;
    const plan = this.plan();
    if (!plan.size) return;
    this.select(-1);
    this.busy = true;
    this.runs++;
    this.badges.forEach((b) => b.disc.setStrokeStyle(4, 0x2b2d42));
    const p = this.puzzle;
    const res = runPlan(p, plan);
    const towns = townsOf(p.ways, res.route, p.start);
    const parcel = this.parcel!;
    const s = p.towns[p.start]!;
    for (let k = 0; k < res.route.length; k++) {
      const way = res.route[k]!;
      const tok = this.tokens.find((t) => t.way === way)!;
      await this.ride(tok, parcel, p.towns[towns[k + 1]!]!, way);
      if (!this.sys.isActive()) return;
    }
    if (res.ok) return this.delivered();
    this.cameras.main.shake(140, 0.004);
    if (res.why === 'wrong') {
      const tok = this.tokens.find((t) => t.way === res.way)!;
      await this.fail(tok, res.way, parcel);
      if (!this.sys.isActive()) return;
      this.badges[res.way]!.disc.setStrokeStyle(7, 0xe63946);
      await this.talk(english(res.vehicle), phrase(`rumb.route.bad.${p.ways[res.way]!.terrain}` as PhraseId), phrase('rumb.route.tryagain'));
    } else {
      this.tweens.add({ targets: parcel, angle: { from: -12, to: 12 }, yoyo: true, repeat: 3, duration: 90, onComplete: () => parcel.setAngle(0) });
      const decoy = p.animals[towns.at(-1)!];
      await this.talk(...(decoy ? [english(decoy), english('notme')] : []), phrase('rumb.route.gap'));
    }
    if (!this.sys.isActive()) return;
    // Back to the harbour; the plan stays on the map to be fixed.
    await this.tween({ targets: parcel, x: s.x + 30, y: s.y - 40, duration: 500 });
    this.tokens.forEach((t) => !t.gone && t.img.setAlpha(1));
    this.hintBtn?.setVisible(true);
    this.busy = false;
  }

  /** The vehicle carries the parcel along its way to the next town. */
  private async ride(tok: Token, parcel: Phaser.GameObjects.Image, to: { x: number; y: number }, way: number) {
    const m = this.mid(way);
    const from = { x: parcel.x - 30, y: parcel.y + 40 };
    const car = this.keep(this.add.image(from.x, from.y, `parcel-${tok.v}`).setDisplaySize(84, 84).setDepth(7));
    if (to.x > from.x && tok.v !== 'plane') car.setFlipX(true);
    tok.img.setAlpha(0.35);
    parcel.setDepth(8);
    // Through the badge's point: a quadratic curve whose middle is the badge.
    const ctrl = { x: 2 * m.x - (from.x + to.x) / 2, y: 2 * m.y - (from.y + to.y) / 2 };
    const t = { k: 0 };
    await this.tween({
      targets: t, k: 1, duration: 1100, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const u = t.k;
        const x = (1 - u) * (1 - u) * from.x + 2 * u * (1 - u) * ctrl.x + u * u * to.x;
        const y = (1 - u) * (1 - u) * from.y + 2 * u * (1 - u) * ctrl.y + u * u * to.y;
        car.setPosition(x, y);
        parcel.setPosition(x + 30, y - 40);
      },
    });
    car.destroy();
  }

  /** The wrong vehicle tries its way and fails in the terrain's own way. */
  private async fail(tok: Token, way: number, parcel: Phaser.GameObjects.Image) {
    const m = this.mid(way);
    const terrain = this.puzzle.ways[way]!.terrain;
    const car = this.keep(this.add.image(parcel.x - 30, parcel.y + 40, `parcel-${tok.v}`).setDisplaySize(84, 84).setDepth(7));
    tok.img.setAlpha(0.35);
    const ride = { x: car.x, y: car.y };
    await this.tween({
      targets: ride, x: m.x - 10, y: m.y + 6, duration: 700, ease: 'Quad.easeIn',
      onUpdate: () => {
        car.setPosition(ride.x, ride.y);
        parcel.setPosition(ride.x + 30, ride.y - 40);
      },
    });
    if (terrain === 'sea') {
      for (let k = 0; k < 6; k++) {
        const b = this.keep(this.add.circle(m.x + (this.rng() - 0.5) * 60, m.y + 20, 5 + this.rng() * 6).setStrokeStyle(3, 0xffffff).setDepth(8));
        this.tweens.add({ targets: b, y: b.y - 80, alpha: 0, delay: k * 80, duration: 800 });
      }
      await this.tween({ targets: car, y: car.y + 40, angle: 25, alpha: 0, duration: 900 });
    } else if (terrain === 'mountains' || terrain === 'air') {
      for (let k = 0; k < 6; k++) {
        const st = this.keep(this.add.star(m.x, m.y - 30, 5, 5, 12, 0xffd166).setDepth(8));
        const a = (k / 6) * Math.PI * 2;
        this.tweens.add({ targets: st, x: st.x + Math.cos(a) * 60, y: st.y + Math.sin(a) * 60, alpha: 0, duration: 600 });
      }
      await this.tween({ targets: car, angle: -360, x: car.x - 60, alpha: 0, duration: 900 });
    } else {
      const dust = terrain === 'snow' ? 0xffffff : terrain === 'sand' ? 0xf4d58d : 0xced4da;
      for (let k = 0; k < 8; k++) {
        const d = this.keep(this.add.circle(m.x - 30 + this.rng() * 60, m.y + 20, 8 + this.rng() * 8, dust).setDepth(8));
        this.tweens.add({ targets: d, y: d.y - 50, x: d.x - 30, alpha: 0, delay: k * 70, duration: 700 });
      }
      this.tweens.add({ targets: car, x: car.x + 8, yoyo: true, repeat: 6, duration: 60 });
      await this.wait(800);
      await this.tween({ targets: car, alpha: 0, duration: 300 });
    }
    car.destroy();
  }

  private async hint() {
    if (this.busy || this.talking || this.phase !== 'plan') return;
    const h = nextHint(this.puzzle, this.plan());
    if (!h) return;
    this.hints++;
    this.run?.event('hint', { item: `route-L${this.level}`, hints: this.hints });
    const badge = this.badges[h.way]!.c;
    const ring = this.keep(this.add.circle(badge.x, badge.y, BADGE_R + 12).setStrokeStyle(8, 0xffd166).setDepth(4));
    this.tweens.add({ targets: ring, scale: 1.25, alpha: 0.3, yoyo: true, repeat: 5, duration: 300, onComplete: () => ring.destroy() });
    const tok = this.tokens.find((t) => t.v === h.vehicle && t.way < 0 && !t.gone) ?? this.tokens.find((t) => t.v === h.vehicle && !t.gone);
    if (tok) this.tweens.add({ targets: tok.img, angle: { from: -12, to: 12 }, yoyo: true, repeat: 5, duration: 120, onComplete: () => tok.img.setAngle(0) });
    await this.talk(phrase('rumb.route.hint'), english(h.vehicle));
  }

  private async delivered() {
    this.phase = 'done';
    const p = this.puzzle;
    const ms = Date.now() - this.planStart;
    // Counts as right only when the first plan worked without hints.
    const ok = this.runs === 1 && this.hints === 0;
    this.total++;
    if (ok) this.right++;
    this.planMs.push(ms);
    this.firstOks.push(ok);
    this.run?.answer({ item: `route-L${this.level}`, correct: ok, firstTry: ok, ms, level: this.level, skill: 'planning', hints: this.hints, runs: this.runs });
    const img = this.animalImgs.get(p.goal);
    if (img) this.tweens.add({ targets: img, y: img.y - 24, yoyo: true, repeat: 2, duration: 200 });
    const t = p.towns[p.goal]!;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const s = this.keep(this.add.star(t.x, t.y, 5, 6, 14, k % 2 ? 0xffd166 : 0xffffff).setDepth(9));
      this.tweens.add({ targets: s, x: t.x + Math.cos(a) * 100, y: t.y + Math.sin(a) * 100, alpha: 0, duration: 800 });
    }
    const yes = phrase(`rumb.route.yes.${Math.floor(this.rng() * 3)}` as PhraseId);
    if (!(await this.talk(english('thanks'), yes))) return;
    if (!(await this.wait(400))) return;
    this.round++;
    if (this.round >= ROUNDS) this.finish();
    else void this.startRound();
  }

  private finish() {
    this.clear();
    const d = nextLevelSmart(
      'parcel',
      this.level,
      { right: this.right, total: this.total, ms: this.planMs, streak: longestStreak(this.firstOks) },
      // Four deliveries a game: 3 of 4 first-time plans is a good game, 1 of 4 is too hard.
      { maxLevel: MAX_LEVEL, up: 0.75, down: 0.5, drop: 0.25, shaky: 0.5, skipStreak: ROUNDS },
    );
    writeStore(LEVEL_KEY, { level: d.level });
    const acc = this.total ? this.right / this.total : 0;
    const stars = acc >= 0.75 ? 3 : acc >= 0.5 ? 2 : 1;
    this.run?.end({ completed: true, stars, score: this.right, total: this.total, ...levelLog(d) });
    this.run = undefined;
    this.drawBackground();
    this.keep(this.add.rectangle(W / 2, 320, 820, 460, 0xfffaf0).setStrokeStyle(8, 0x7a4a24));
    this.keep(this.add.text(W / 2, 150, 'Все посылки доставлены!', { fontFamily: FONT, fontSize: '50px', color: '#1b4965' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) this.keep(this.add.star(W / 2 - 110 + i * 110, 260, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    const note = levelNote(this.level, d) || `Уровень ${d.level}`;
    this.keep(this.add.text(W / 2, 350, note, { fontFamily: FONT, fontSize: '32px', color: d.change > 0 ? '#2a9d8f' : '#7a4a24' }).setOrigin(0.5));
    this.rumb = this.keep(this.add.image(W / 2 - 330, 300, 'char-rumb').setDisplaySize(130, 130));
    this.keep(button(this, W / 2 - 170, 470, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: COLORS.leaf }));
    this.keep(button(this, W / 2 + 170, 470, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    showProgress(this, { game: 'parcel', level: this.level, stars, next: d.level });
    void this.talk(phrase('rumb.route.end'));
  }
}
