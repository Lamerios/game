import Phaser from 'phaser';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { dueWords, recordWord } from '../../core/wordLog';
import { goHome } from '../common/home';
import { english, ENGLISH, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import type { GameState } from '../../game-state';
import { button, COLORS, FONT, H, W } from '../../scenes/ui';
import { mulberry32, shuffle, type Rng } from '../common/rng';
import {
  COLORS as PAINTS, DIRS, distractors, itemsForRound, moveSnake, numberOf, OPPOSITE, placeItems, planGame, planRules, planSounds, WORDS, wordById,
  type Cell, type Dir, type Mode, type MultiRound,
} from './logic';

const CELL = 60;
const COLS = 14;
const ROWS = 10;
const X0 = 30;
const Y0 = 100;
const ROUNDS = 10;
const ITEM_SIZE = 86;
const STATS_KEY = 'snake-words';
const INTRO_KEY = 'snake-intro';
const YES_COUNT = 5;

const NUMBER_PAINT = ['#e63946', '#f77f00', '#2a9d8f', '#277da1', '#7b2cbf', '#43aa8b', '#d62828', '#3a86ff'];

/** A number card: a bright rounded tile with the digits, drawn instead of a picture. */
function numberSvg(n: number): string {
  const text = String(n);
  const size = text.length === 1 ? 150 : text.length === 2 ? 118 : 86;
  const fill = NUMBER_PAINT[n % NUMBER_PAINT.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
    <rect x="10" y="14" width="172" height="172" rx="34" fill="#00000033"/>
    <rect x="10" y="6" width="172" height="172" rx="34" fill="${fill}" stroke="#2b2d42" stroke-width="6"/>
    <path d="M30 40 C40 22 70 18 96 18" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="10" stroke-linecap="round"/>
    <text x="96" y="${92 + size * 0.36}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900"
      font-size="${size}" fill="#ffffff" stroke="#2b2d42" stroke-width="7" paint-order="stroke">${text}</text></svg>`;
}

/** A colour card: a round paint blob with drips, so it reads as "this colour", not as a thing. */
function colorSvg(paint: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
    <path d="M96 22 C132 18 168 44 170 84 C172 112 156 128 150 146 C146 160 136 170 126 160 C118 152 120 140 108 142
      C98 144 100 168 86 170 C72 172 74 150 62 146 C44 140 22 128 22 92 C22 54 58 24 96 22Z"
      fill="${paint}" stroke="#2b2d42" stroke-width="7" stroke-linejoin="round"/>
    <ellipse cx="72" cy="62" rx="22" ry="12" transform="rotate(-25 72 62)" fill="#ffffff" fill-opacity=".45"/></svg>`;
}

/** Queues the pictures of these words (texture `snake-<id>`): photos, drawn colours and numbers. Shared with other word games. */
export function preloadWordPictures(scene: Phaser.Scene, ids: readonly string[]) {
  for (const id of ids) {
    if (scene.textures.exists(`snake-${id}`)) continue;
    const n = numberOf(id);
    const paint = PAINTS.find((c) => c.id === id)?.paint;
    if (paint) scene.load.svg(`snake-${id}`, `data:image/svg+xml;base64,${btoa(colorSvg(paint))}`);
    else if (n === undefined) scene.load.image(`snake-${id}`, `${import.meta.env.BASE_URL}snake/${id}.webp`);
    else scene.load.svg(`snake-${id}`, `data:image/svg+xml;base64,${btoa(numberSvg(n))}`);
  }
}

/** English as shown on screen ("seven", "apple"). */
const en = (id: string) => ENGLISH[id] ?? id;

const px = (c: Cell) => ({ x: X0 + c.x * CELL + CELL / 2, y: Y0 + c.y * CELL + CELL / 2 });

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
    /* private mode: progress just isn't remembered */
  }
}

interface Item {
  id: string;
  cell: Cell;
  img: Phaser.GameObjects.Image;
}

/**
 * Snake «Шуша» learns English: the voice says a word ("apple"), the child steers
 * the snake to that picture. Arrows / WASD, swipes or a tap on the board, or the
 * on-screen pad. No way to lose: the board wraps, the snake can cross itself, and
 * a wrong picture is named in English and taken away.
 */
export class SnakeScene extends Phaser.Scene {
  private rng!: Rng;
  private body: Cell[] = [];
  private prev: Cell[] = [];
  private dir: Dir = 'right';
  private queue: Dir[] = [];
  private moving = false;
  private paused = true;
  private acc = 0;
  private grow = 0;
  private items: Item[] = [];
  private words: string[] = [];
  /** Rule / sound rounds: several right pictures per round. Empty in the word modes. */
  private multi: MultiRound[] = [];
  private need = new Set<string>();
  private run?: Run;
  private askedAt = 0;
  private mode?: Mode;
  private round = 0;
  private target = '';
  private firstTry = true;
  private eaten: string[] = [];
  private talking = false;
  private talkToken = 0;
  private lastSpoken = 0;
  private repeats = 0;
  private stats: Record<string, number> = {};
  private snake!: Phaser.GameObjects.Graphics;
  private slots: Phaser.GameObjects.GameObject[] = [];
  private card!: Phaser.GameObjects.Container;
  private pad: Phaser.GameObjects.Container[] = [];
  private padPulse?: Phaser.Tweens.Tween;

  constructor() {
    super('Snake');
  }

  init(data: { mode?: Mode }) {
    this.mode = data?.mode;
  }

  preload() {
    preloadWordPictures(this, WORDS.map((w) => w.id));
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.stats = readStore<Record<string, number>>(STATS_KEY, {});
    this.body = [{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }];
    this.prev = this.body.map((c) => ({ ...c }));
    this.dir = 'right';
    this.queue = [];
    this.moving = false;
    this.paused = true;
    this.acc = 0;
    this.grow = 0;
    this.items = [];
    this.round = 0;
    this.eaten = [];
    this.talking = false;
    this.slots = [];
    this.pad = [];

    this.drawBoard();
    this.snake = this.add.graphics().setDepth(5);
    const mask = this.make.graphics({}, false).fillRect(X0, Y0, COLS * CELL, ROWS * CELL);
    this.snake.setMask(mask.createGeometryMask());
    this.drawPanel();
    this.bindInput();
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false, score: this.eaten.length });
      this.run = undefined;
    });
    this.render(1);
    if (this.mode) this.begin(this.mode);
    else this.chooseMode();
  }

  /** Words, numbers, or both: big buttons over the board. */
  private chooseMode() {
    const layer: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(X0 + (COLS * CELL) / 2, Y0 + (ROWS * CELL) / 2, COLS * CELL, ROWS * CELL, 0x1b4332, 0.35).setInteractive(),
    ];
    const cx = X0 + (COLS * CELL) / 2;
    const options: [Mode, string, string[]][] = [
      ['words', 'Слова', ['snake-apple', 'snake-cat']],
      ['numbers', 'Числа', ['snake-n3', 'snake-n15']],
      ['mix', 'Всё вместе', ['snake-banana', 'snake-n7']],
      ['rules', 'Правило', ['snake-lion', 'snake-car']],
      ['sounds', 'Первый звук', ['snake-ball', 'snake-bus']],
    ];
    options.forEach(([mode, label, icons], i) => {
      const b = button(this, cx, 190 + i * 112, `          ${label}`, () => {
        layer.forEach((o) => o.destroy());
        this.begin(mode);
      }, { w: 520, h: 100, color: [0x40916c, 0x277da1, 0x8d5524, 0x9b5de5, 0xe76f51][i] });
      icons.forEach((key, j) => b.add(this.add.image(-200 + j * 70, 0, key).setDisplaySize(80, 80)));
      layer.push(b);
    });
    layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(15));
    void this.talk(phrase('snake.choose'));
  }

  private begin(mode: Mode) {
    this.mode = mode;
    this.run = startRun('snake', { mode });
    if (mode === 'rules') this.multi = planRules(this.rng, ROUNDS / 2);
    else if (mode === 'sounds') this.multi = planSounds(this.rng, ROUNDS);
    else this.multi = [];
    this.words = this.multi.length ? [] : planGame(mode, this.stats, ROUNDS, this.rng, dueWords());
    void this.startRound();
  }

  // ---------- layout ----------

  private drawBoard() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x74c69d);
    const g = this.add.graphics();
    g.fillStyle(0x8d5524).fillRoundedRect(X0 - 14, Y0 - 14, COLS * CELL + 28, ROWS * CELL + 28, 18);
    g.lineStyle(6, 0x5c3317).strokeRoundedRect(X0 - 14, Y0 - 14, COLS * CELL + 28, ROWS * CELL + 28, 18);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) g.fillStyle((x + y) % 2 ? 0xa7d676 : 0xb5e083).fillRect(X0 + x * CELL, Y0 + y * CELL, CELL, CELL);
    }
    const name = (this.registry.get('state') as GameState | undefined)?.profile.childName ?? 'Капитан';
    this.add
      .text(X0, 46, `${name} и змейка Шуша`, { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#1b4332', strokeThickness: 8 })
      .setOrigin(0, 0.5);
    // Ten slots that fill up with the eaten pictures.
    for (let i = 0; i < ROUNDS; i++) {
      this.add.circle(this.slotX(i), 46, 22, 0xffffff, 0.35).setStrokeStyle(3, 0x1b4332, 0.6);
    }
  }

  private slotX(i: number) {
    return 520 + i * 44;
  }

  private drawPanel() {
    button(this, 1170, 46, 'Домой', () => goHome(this), { w: 170, h: 64, color: 0x6c757d });
    const listen = button(this, 1080, 160, '     Ещё раз', () => this.repeatWord(), { w: 340, h: 100, color: COLORS.leaf });
    const icon = this.add.graphics({ x: -110, y: 0 });
    icon.fillStyle(0xffffff).fillRect(-22, -12, 14, 24).fillTriangle(-10, -12, 10, -28, 10, 28).fillTriangle(-10, 12, 10, -28, 10, 28);
    icon.lineStyle(5, 0xffffff).beginPath().arc(14, 0, 14, -0.9, 0.9).strokePath().beginPath().arc(14, 0, 26, -0.9, 0.9).strokePath();
    listen.add(icon);

    this.card = this.add.container(1080, 330);
    this.showCard();

    const at: Record<Dir, [number, number]> = { up: [1080, 498], down: [1080, 662], left: [996, 580], right: [1164, 580] };
    for (const d of Object.keys(at) as Dir[]) {
      const [x, y] = at[d];
      const bg = this.add.circle(0, 0, 40, 0xffd166).setStrokeStyle(5, 0x5c3317);
      const v = DIRS[d];
      const tri = this.add.triangle(0, 0, 18, 0, 36, 30, 0, 30, 0x5c3317).setAngle(v.x * 90 + (v.y > 0 ? 180 : 0));
      const c = this.add.container(x, y, [bg, tri]).setSize(84, 84).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => {
        c.setScale(0.9);
        this.turn(d);
      });
      c.on('pointerup', () => c.setScale(1));
      c.on('pointerout', () => c.setScale(1));
      this.pad.push(c);
    }
    this.padPulse = this.tweens.add({ targets: this.pad, scale: 1.12, yoyo: true, repeat: -1, duration: 500 });
  }

  /** The word card: "?" while the child is listening, the word once it is found. */
  private showCard(id?: string) {
    this.card.removeAll(true);
    this.card.add(this.add.rectangle(0, 0, 340, 200, 0xfffaf0).setStrokeStyle(5, 0x1b4332));
    if (!id) {
      this.card.add(this.add.text(0, -20, '?', { fontFamily: FONT, fontSize: '96px', color: '#2a9d8f' }).setOrigin(0.5));
      this.card.add(this.add.text(0, 66, 'Слушай слово', { fontFamily: FONT, fontSize: '28px', color: '#1b4332' }).setOrigin(0.5));
      return;
    }
    const w = wordById(id);
    this.card.add(this.add.image(-95, 0, `snake-${id}`).setDisplaySize(130, 130));
    const word = en(id);
    this.card.add(
      this.add.text(70, -22, word, { fontFamily: FONT, fontSize: word.length > 9 ? '30px' : word.length > 7 ? '36px' : '48px', color: '#1b4332', fontStyle: 'bold' }).setOrigin(0.5),
    );
    this.card.add(this.add.text(70, 36, w.ru, { fontFamily: FONT, fontSize: w.ru.length > 10 ? '22px' : '28px', color: '#6c757d' }).setOrigin(0.5));
    this.tweens.add({ targets: this.card, scale: { from: 0.8, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  }

  // ---------- input ----------

  private bindInput() {
    const keys: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    };
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const d = keys[e.code];
      if (d) {
        e.preventDefault();
        this.turn(d);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        this.repeatWord();
      }
    });
    // Swipe anywhere on the board, or tap where the snake should go.
    const zone = this.add.zone(X0, Y0, COLS * CELL, ROWS * CELL).setOrigin(0).setInteractive();
    let start: { x: number; y: number } | undefined;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (start = { x: p.x, y: p.y }));
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!start) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      start = undefined;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
        this.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
        return;
      }
      // A tap: head towards it along the longer way, never straight back.
      const head = px(this.body[0]!);
      const tx = p.x - head.x;
      const ty = p.y - head.y;
      const horiz: Dir = tx > 0 ? 'right' : 'left';
      const vert: Dir = ty > 0 ? 'down' : 'up';
      const [first, second] = Math.abs(tx) > Math.abs(ty) ? [horiz, vert] : [vert, horiz];
      const cur = this.queue.at(-1) ?? this.dir;
      this.turn(this.moving && first === OPPOSITE[cur] ? second : first);
    });
  }

  private turn(d: Dir) {
    if (!this.moving) {
      // Standing still: any way goes; backwards just turns the snake around.
      if (d === OPPOSITE[this.dir]) {
        this.body.reverse();
        this.prev = this.body.map((c) => ({ ...c }));
      }
      this.dir = d;
      this.queue = [];
      this.moving = true;
      this.padPulse?.stop();
      this.pad.forEach((c) => c.setScale(1));
      return;
    }
    const last = this.queue.at(-1) ?? this.dir;
    if (d === last || d === OPPOSITE[last] || this.queue.length >= 2) return;
    this.queue.push(d);
  }

  // ---------- rounds ----------

  private async talk(...lines: Utterance[]): Promise<boolean> {
    const token = ++this.talkToken;
    this.talking = true;
    for (const u of lines) {
      if (token !== this.talkToken) return false;
      voice.say(u);
      await voice.idle(6000);
    }
    if (token !== this.talkToken || !this.sys.isActive()) return false;
    this.talking = false;
    this.lastSpoken = this.time.now;
    return true;
  }

  private repeatWord() {
    if (this.talking || !this.target) return;
    this.lastSpoken = this.time.now;
    this.run?.event('repeat', { item: this.target });
    voice.say(english(this.target));
  }

  private async startRound() {
    if (this.multi.length) return this.startMultiRound();
    if (this.round >= ROUNDS) return this.win();
    this.target = this.words[this.round]!;
    this.firstTry = true;
    this.repeats = 0;
    this.showCard();
    const ids = [this.target, ...distractors(this.target, itemsForRound(this.round) - 1, this.round, this.rng)];
    this.spawnItems(ids);
    this.askedAt = Date.now();

    this.paused = true;
    const lines: Utterance[] = [];
    if (this.round === 0) {
      if (readStore(INTRO_KEY, false)) {
        lines.push(phrase('snake.again'));
      } else {
        writeStore(INTRO_KEY, true);
        lines.push(phrase('snake.intro'), phrase('snake.controls'));
      }
    }
    lines.push(english(this.target));
    if (await this.talk(...lines)) {
      this.paused = false;
      this.run?.ask(this.target, { round: this.round, options: ids.length });
    }
  }

  /** "Only animals!" / "Find a word that starts like ball!": every right picture is eaten, the others are left. */
  private async startMultiRound() {
    if (this.round >= this.multi.length) return this.win();
    const r = this.multi[this.round]!;
    const prev = this.multi[this.round - 1];
    this.target = r.line;
    this.need = new Set(r.ok);
    this.firstTry = true;
    this.repeats = 0;
    this.showRuleCard(r);
    this.spawnItems(shuffle(this.rng, [...r.ok, ...r.avoid]));
    this.askedAt = Date.now();
    this.paused = true;
    const lines: Utterance[] = [];
    const rules = this.mode === 'rules';
    if (this.round === 0) lines.push(phrase(rules ? 'snake.rules.intro' : 'snake.sounds.intro'));
    else if (rules && prev && prev.line !== r.line) {
      lines.push(phrase('snake.rules.switch'));
      this.run?.event('rule_switch', { from: prev.line, to: r.line });
    }
    lines.push(english(r.line));
    if (!rules) lines.push(english(r.cue));
    if (await this.talk(...lines)) {
      this.paused = false;
      this.run?.ask(r.line, { round: this.round, options: r.ok.length + r.avoid.length });
    }
  }

  private showRuleCard(r: MultiRound) {
    this.card.removeAll(true);
    this.card.add(this.add.rectangle(0, 0, 340, 200, 0xfffaf0).setStrokeStyle(5, 0x1b4332));
    this.card.add(this.add.image(-100, -10, `snake-${r.cue}`).setDisplaySize(110, 110));
    const text = ENGLISH[r.line] ?? r.line;
    this.card.add(this.add.text(55, -10, text, { fontFamily: FONT, fontSize: '28px', color: '#1b4332', fontStyle: 'bold', align: 'center', wordWrap: { width: 190 } }).setOrigin(0.5));
    if (this.mode === 'sounds') this.card.add(this.add.text(-100, 70, en(r.cue), { fontFamily: FONT, fontSize: '26px', color: '#6c757d' }).setOrigin(0.5));
  }

  private spawnItems(ids: string[]) {
    const cells = placeItems(ids.length, this.body, this.queue.at(-1) ?? this.dir, COLS, ROWS, this.rng);
    this.items = cells.map((cell, i) => {
      const { x, y } = px(cell);
      const img = this.add.image(x, y, `snake-${ids[i]}`).setDisplaySize(ITEM_SIZE, ITEM_SIZE).setDepth(4);
      const s = img.scale;
      img.setScale(0);
      this.tweens.add({ targets: img, scale: s, duration: 350, delay: i * 120, ease: 'Back.easeOut' });
      this.tweens.add({ targets: img, angle: { from: -4, to: 4 }, yoyo: true, repeat: -1, duration: 900 + i * 90, ease: 'Sine.easeInOut' });
      return { id: ids[i]!, cell, img };
    });
  }

  private step() {
    this.dir = this.queue.shift() ?? this.dir;
    const old = this.body;
    const growing = this.grow > 0;
    this.body = moveSnake(old, this.dir, growing, COLS, ROWS);
    this.prev = growing ? [...old, old.at(-1)!] : old;
    if (growing) this.grow--;
    const head = this.body[0]!;
    const hit = this.items.find((it) => it.cell.x === head.x && it.cell.y === head.y);
    if (hit) void this.eat(hit);
  }

  private async eat(item: Item) {
    if (this.multi.length) return this.eatMulti(item);
    this.items = this.items.filter((it) => it !== item);
    this.tweens.killTweensOf(item.img);
    this.paused = true;
    this.run?.answer({ item: this.target, correct: item.id === this.target, chosen: item.id === this.target ? undefined : item.id, round: this.round });
    if (item.id !== this.target) {
      if (this.firstTry) recordWord(this.target, false, 'snake');
      this.firstTry = false;
      this.cameras.main.shake(120, 0.003);
      this.tweens.add({ targets: item.img, alpha: 0, scale: item.img.scale * 1.6, duration: 400, onComplete: () => item.img.destroy() });
      this.floatWord(item.id, item.img.x, item.img.y, '#ffffff');
      if (await this.talk(english(item.id), phrase('snake.no'), english(this.target))) this.paused = false;
      return;
    }

    // Right picture: it flies into its slot at the top, the snake grows.
    this.grow++;
    const slot = this.eaten.length;
    this.eaten.push(item.id);
    if (this.firstTry) {
      this.stats[item.id] = (this.stats[item.id] ?? 0) + 1;
      recordWord(item.id, true, 'snake');
    }
    writeStore(STATS_KEY, this.stats);
    this.burst(item.img.x, item.img.y);
    this.floatWord(item.id, item.img.x, item.img.y, '#ffd166');
    this.tweens.add({
      targets: item.img, x: this.slotX(slot), y: 46, displayWidth: 40, displayHeight: 40, angle: 0, duration: 600, ease: 'Cubic.easeInOut',
      onComplete: () => this.slots.push(item.img),
    });
    for (const other of this.items) {
      this.tweens.killTweensOf(other.img);
      this.tweens.add({ targets: other.img, alpha: 0, scale: 0, duration: 300, onComplete: () => other.img.destroy() });
    }
    this.items = [];
    this.showCard(item.id);
    const yes = phrase(`snake.yes.${Math.floor(this.rng() * YES_COUNT)}` as PhraseId);
    if (!(await this.talk(english(item.id), yes))) return;
    await new Promise((r) => setTimeout(r, 400));
    if (!this.sys.isActive()) return;
    this.round++;
    void this.startRound();
  }

  private async eatMulti(item: Item) {
    this.items = this.items.filter((it) => it !== item);
    this.tweens.killTweensOf(item.img);
    this.paused = true;
    const rules = this.mode === 'rules';
    if (!this.need.has(item.id)) {
      // Eaten against the rule: named, taken away, the rule said again.
      this.run?.answer({ item: this.target, correct: false, chosen: item.id, ms: Date.now() - this.askedAt, round: this.round, skill: rules ? 'nogo' : 'phonics' });
      this.firstTry = false;
      this.cameras.main.shake(120, 0.003);
      this.tweens.add({ targets: item.img, alpha: 0, scale: item.img.scale * 1.6, duration: 400, onComplete: () => item.img.destroy() });
      this.floatWord(item.id, item.img.x, item.img.y, '#ffffff');
      if (await this.talk(english(item.id), phrase(rules ? 'snake.rules.no' : 'snake.sounds.no'), english(this.target))) this.paused = false;
      return;
    }
    this.need.delete(item.id);
    this.grow++;
    const slot = this.eaten.length;
    this.eaten.push(item.id);
    recordWord(item.id, true, 'snake');
    this.run?.answer({ item: `${this.target}:${item.id}`, correct: true, ms: Date.now() - this.askedAt, round: this.round, skill: rules ? 'nogo' : 'phonics' });
    this.askedAt = Date.now();
    this.burst(item.img.x, item.img.y);
    this.floatWord(item.id, item.img.x, item.img.y, '#ffd166');
    this.tweens.add({
      targets: item.img, x: this.slotX(slot), y: 46, displayWidth: 40, displayHeight: 40, angle: 0, duration: 600, ease: 'Cubic.easeInOut',
      onComplete: () => this.slots.push(item.img),
    });
    if (this.need.size > 0) {
      if (await this.talk(english(item.id), phrase('snake.rules.more'))) this.paused = false;
      return;
    }
    for (const other of this.items) {
      this.tweens.killTweensOf(other.img);
      this.tweens.add({ targets: other.img, alpha: 0, scale: 0, duration: 300, onComplete: () => other.img.destroy() });
    }
    this.items = [];
    const yes = phrase(`snake.yes.${Math.floor(this.rng() * YES_COUNT)}` as PhraseId);
    if (!(await this.talk(english(item.id), yes))) return;
    await new Promise((r) => setTimeout(r, 400));
    if (!this.sys.isActive()) return;
    this.round++;
    void this.startRound();
  }

  private floatWord(id: string, x: number, y: number, color: string) {
    const t = this.add
      .text(x, y - 40, en(id), { fontFamily: FONT, fontSize: '40px', color, stroke: '#1b4332', strokeThickness: 8, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(8);
    this.tweens.add({ targets: t, y: y - 110, alpha: 0, delay: 700, duration: 900, onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const s = this.add.star(x, y, 5, 6, 14, i % 2 ? 0xffd166 : 0xffffff).setDepth(7);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 90, alpha: 0, angle: 180, duration: 650, onComplete: () => s.destroy() });
    }
  }

  private win() {
    this.run?.end({ completed: true, score: this.eaten.length, mode: this.mode ?? null });
    this.run = undefined;
    this.paused = true;
    this.moving = false;
    this.target = '';
    const layer: Phaser.GameObjects.GameObject[] = [];
    layer.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setInteractive());
    layer.push(this.add.rectangle(W / 2, H / 2, 1000, 600, 0xfffaf0).setStrokeStyle(8, 0x1b4332));
    layer.push(this.add.text(W / 2, 100, 'Шуша сыта! Десять слов!', { fontFamily: FONT, fontSize: '48px', color: '#1b4332' }).setOrigin(0.5));
    // Every eaten picture with its word; a tap says it again.
    this.eaten.forEach((id, i) => {
      const x = W / 2 - 360 + (i % 5) * 180;
      const y = 220 + Math.floor(i / 5) * 190;
      const img = this.add.image(x, y, `snake-${id}`).setDisplaySize(110, 110).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => {
        voice.say(english(id));
        this.tweens.add({ targets: img, scale: img.scale * 1.15, yoyo: true, duration: 150 });
      });
      layer.push(img, this.add.text(x, y + 72, en(id), { fontFamily: FONT, fontSize: '30px', color: '#1b4332', fontStyle: 'bold' }).setOrigin(0.5));
    });
    layer.push(button(this, W / 2 - 170, 580, 'Ещё раз', () => this.scene.restart({ mode: this.mode }), { w: 300, h: 90, color: COLORS.leaf }));
    layer.push(button(this, W / 2 + 170, 580, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    void this.talk(phrase('snake.win'));
  }

  // ---------- frame ----------

  update(time: number, delta: number) {
    const stepMs = Math.max(250, 380 - this.round * 13);
    if (this.moving && !this.paused) {
      this.acc += Math.min(delta, 100);
      while (this.acc >= stepMs && !this.paused) {
        this.acc -= stepMs;
        this.step();
      }
    }
    this.render(Math.min(1, this.acc / stepMs));
    // Nothing eaten for a while: say the word again (twice at most).
    if (this.target && !this.talking && !this.paused && this.repeats < 2 && time - this.lastSpoken > 9000) {
      this.repeats++;
      this.repeatWord();
    }
  }

  /** Draws the snake between its previous and current cells (t = 0..1). */
  private render(t: number) {
    const pts = this.body.map((c, i) => {
      const a = this.prev[i] ?? c;
      let dx = c.x - a.x;
      let dy = c.y - a.y;
      // Through the edge: slide out on one side and in on the other.
      if (Math.abs(dx) > 1) dx = -Math.sign(dx);
      if (Math.abs(dy) > 1) dy = -Math.sign(dy);
      const from = px(a);
      const wrapped = Math.abs(c.x - a.x) > 1 || Math.abs(c.y - a.y) > 1;
      if (!wrapped) return { x: from.x + dx * CELL * t, y: from.y + dy * CELL * t };
      if (t < 0.5) return { x: from.x + dx * CELL * t, y: from.y + dy * CELL * t };
      const to = px(c);
      return { x: to.x - dx * CELL * (1 - t), y: to.y - dy * CELL * (1 - t) };
    });
    const r = (i: number) => {
      const n = pts.length;
      const base = CELL * 0.36;
      return i >= n - 1 ? base * 0.62 : i >= n - 2 ? base * 0.82 : base;
    };
    const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < CELL * 1.5;
    const g = this.snake.clear();
    // Outline pass, then fill pass, so the body reads as one tube.
    for (const [w, color, extra] of [[1, 0x1b4332, 5], [1, 0x52b788, 0]] as const) {
      for (let i = pts.length - 1; i > 0; i--) {
        const a = pts[i]!;
        const b = pts[i - 1]!;
        if (!near(a, b)) continue;
        g.lineStyle((r(i) + extra) * 2 * w, color).lineBetween(a.x, a.y, b.x, b.y);
        g.fillStyle(color).fillCircle((a.x + b.x) / 2, (a.y + b.y) / 2, r(i) + extra);
      }
      pts.forEach((p, i) => g.fillStyle(color).fillCircle(p.x, p.y, (i === 0 ? CELL * 0.46 : r(i)) + extra));
    }
    // Back pattern.
    for (let i = 1; i < pts.length - 1; i += 2) g.fillStyle(0x95d5b2).fillCircle(pts[i]!.x, pts[i]!.y, r(i) * 0.45);
    // Head: darker, eyes look where it goes, tongue flicks now and then.
    const h = pts[0]!;
    const d = DIRS[this.dir];
    g.fillStyle(0x40916c).fillCircle(h.x, h.y, CELL * 0.4);
    const side = { x: -d.y, y: d.x };
    for (const s of [-1, 1]) {
      const ex = h.x + d.x * 8 + side.x * 13 * s;
      const ey = h.y + d.y * 8 + side.y * 13 * s;
      g.fillStyle(0xffffff).fillCircle(ex, ey, 10);
      g.fillStyle(0x1b263b).fillCircle(ex + d.x * 4, ey + d.y * 4, 5);
    }
    if (this.time.now % 1800 < 350) {
      const tx = h.x + d.x * 30;
      const ty = h.y + d.y * 30;
      g.lineStyle(4, 0xe63946).lineBetween(h.x + d.x * 22, h.y + d.y * 22, tx, ty);
      g.lineBetween(tx, ty, tx + d.x * 8 + side.x * 6, ty + d.y * 8 + side.y * 6);
      g.lineBetween(tx, ty, tx + d.x * 8 - side.x * 6, ty + d.y * 8 - side.y * 6);
    }
  }
}
