import Phaser from 'phaser';
import { OL, svg } from '../../art/objects';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, phrase, type Utterance } from '../../core/phrases';
import { recordWord } from '../../core/wordLog';
import { button, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { COMPASS, dirLine, endOf, LEVELS, MAX_LEVEL, planPieces, planRoute, STEP, type Compass, type Piece, type Route } from './logic';

const KEY = 'mappuzzle-progress';
const MAP = 600;
const BOARD = { x: 340, y: 380 };
const GRID = 6;
const CELL = MAP / GRID;

/** The treasure map: parchment, sea, an island with hills and palms, a dotted grid to sail by. */
const MAP_SVG = svg(MAP, MAP, `
  <rect width="600" height="600" fill="#f4e1b5"/>
  <rect x="10" y="10" width="580" height="580" rx="14" fill="#9fd3e6" stroke="#a5683a" stroke-width="10"/>
  <path d="M120 170 C160 90 320 80 400 130 C480 170 520 260 480 340 C450 410 500 470 430 510 C340 560 220 520 170 460 C110 400 70 320 100 250Z" fill="#f4d58d" stroke="${OL}" stroke-width="6"/>
  <path d="M150 220 C190 160 300 150 370 190 C440 230 450 300 420 360 C390 420 300 450 230 420 C170 390 130 300 150 220Z" fill="#8ac926"/>
  <path d="M240 300 L290 220 L340 300Z" fill="#9aa5b1" stroke="${OL}" stroke-width="5"/><path d="M275 245 L290 220 L305 245Z" fill="#fff"/>
  <path d="M330 330 L370 270 L410 330Z" fill="#9aa5b1" stroke="${OL}" stroke-width="5"/>
  <path d="M190 380 V340 M190 340 C170 330 160 336 156 344 M190 340 C210 328 222 334 226 342 M190 340 C184 322 190 314 198 312" stroke="#2d6a4f" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M440 420 V385 M440 385 C422 376 414 382 410 390 M440 385 C458 374 470 380 474 388" stroke="#2d6a4f" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M60 520 C80 505 100 535 120 520 S160 505 180 520" fill="none" stroke="#fff" stroke-width="5"/>
  <path d="M420 70 C440 55 460 85 480 70 S520 55 540 70" fill="none" stroke="#fff" stroke-width="5"/>
  ${Array.from({ length: GRID - 1 }, (_, i) => `<path d="M${(i + 1) * CELL} 14 V586 M14 ${(i + 1) * CELL} H586" stroke="#3d2b1f" stroke-opacity=".25" stroke-width="3" stroke-dasharray="8 10"/>`).join('')}`);

const toUri = (s: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s)))}`;

/** «Порванная карта»: assemble the torn map (turn pieces with a tap), then sail it by English compass words. */
export class MapPuzzleScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  private run?: Run;
  private talkToken = 0;
  private placed = 0;
  private pieces: Piece[] = [];
  private turnsUsed = 0;
  private misdrops = 0;
  private startedAt = 0;

  constructor() {
    super('MapPuzzle');
  }

  preload() {
    if (!this.textures.exists('treasure-map')) this.load.svg('treasure-map', toUri(MAP_SVG));
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    try {
      const v = Number(JSON.parse(localStorage.getItem(KEY) ?? '{}').level);
      this.level = v >= 1 && v <= MAX_LEVEL ? v : 1;
    } catch {
      this.level = 1;
    }
    this.placed = 0;
    this.turnsUsed = 0;
    this.misdrops = 0;
    this.startedAt = Date.now();
    this.add.rectangle(W / 2, H / 2, W, H, 0x1b4965);
    this.add.text(40, 40, `Порванная карта · уровень ${this.level}`, { fontFamily: FONT, fontSize: '30px', color: '#fff' }).setOrigin(0, 0.5);
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.add.image(1180, 640, 'char-rumb').setDisplaySize(120, 120);
    this.run = startRun('mappuzzle', { level: this.level });
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false });
    });
    this.makeFrames();
    this.layoutPuzzle();
    this.time.delayedCall(0, () => void this.talk(phrase('rumb.map.hello')));
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

  private get spec() {
    return LEVELS[this.level]!;
  }

  private makeFrames() {
    const tex = this.textures.get('treasure-map');
    const { cols, rows } = this.spec;
    const pw = MAP / cols;
    const ph = MAP / rows;
    for (let i = 0; i < cols * rows; i++) {
      const name = `p${cols}x${rows}-${i}`;
      if (!tex.has(name)) tex.add(name, 0, (i % cols) * pw, Math.floor(i / cols) * ph, pw, ph);
    }
  }

  private slotCenter(i: number) {
    const { cols, rows } = this.spec;
    const pw = MAP / cols;
    const ph = MAP / rows;
    return { x: BOARD.x - MAP / 2 + (i % cols) * pw + pw / 2, y: BOARD.y - MAP / 2 + Math.floor(i / cols) * ph + ph / 2 };
  }

  private layoutPuzzle() {
    const { cols, rows } = this.spec;
    const pw = MAP / cols;
    const ph = MAP / rows;
    // The board: an empty frame with faint slots.
    this.add.rectangle(BOARD.x, BOARD.y, MAP + 16, MAP + 16, 0x0b2233).setStrokeStyle(6, 0xffd166);
    for (let i = 0; i < cols * rows; i++) {
      const c = this.slotCenter(i);
      this.add.rectangle(c.x, c.y, pw - 4, ph - 4, 0xffffff, 0.06).setStrokeStyle(2, 0xffffff, 0.3);
    }
    this.pieces = planPieces(this.level, this.rng);
    // Loose pieces on the right, a bit smaller.
    const scale = Math.min(1, 200 / Math.max(pw, ph));
    this.pieces.forEach((p, k) => {
      const x = 760 + (k % 3) * 160 + (this.rng() - 0.5) * 20;
      const y = 170 + Math.floor(k / 3) * 170 + (this.rng() - 0.5) * 20;
      const img = this.add.image(x, y, 'treasure-map', `p${cols}x${rows}-${p.index}`).setScale(scale * 0.75).setAngle(p.turns * 90);
      img.setData({ piece: p, home: { x, y }, turns: p.turns, scale: scale * 0.75 });
      img.setInteractive({ useHandCursor: true, draggable: true });
      let moved = false;
      img.on('dragstart', () => {
        moved = false;
        img.setDepth(10).setScale(1);
      });
      img.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
        if (Math.abs(dx - img.x) + Math.abs(dy - img.y) > 6) moved = true;
        img.setPosition(dx, dy);
      });
      img.on('dragend', () => (moved ? this.dropPiece(img) : this.turnPiece(img)));
    });
  }

  /** A tap (no drag) turns the piece a quarter turn clockwise. */
  private turnPiece(img: Phaser.GameObjects.Image) {
    const home = img.getData('home') as { x: number; y: number };
    img.setPosition(home.x, home.y).setScale(img.getData('scale') as number).setDepth(1);
    const turns = ((img.getData('turns') as number) + 1) % 4;
    img.setData('turns', turns);
    this.turnsUsed++;
    this.tweens.add({ targets: img, angle: turns * 90 === 0 ? 360 : turns * 90, duration: 180, onComplete: () => img.setAngle(turns * 90) });
  }

  private dropPiece(img: Phaser.GameObjects.Image) {
    const p = img.getData('piece') as Piece;
    const turns = img.getData('turns') as number;
    const slot = this.slotCenter(p.index);
    const near = Phaser.Math.Distance.Between(img.x, img.y, slot.x, slot.y) < 70;
    if (near && turns === 0) {
      img.disableInteractive().setDepth(2);
      this.tweens.add({ targets: img, x: slot.x, y: slot.y, duration: 150 });
      this.placed++;
      if (this.placed === this.pieces.length) void this.assembled();
      return;
    }
    this.misdrops++;
    const home = img.getData('home') as { x: number; y: number };
    this.tweens.add({ targets: img, x: home.x, y: home.y, scale: img.getData('scale') as number, duration: 250, onComplete: () => img.setDepth(1) });
    if (near && turns !== 0) void this.talk(phrase('rumb.map.rotate'));
  }

  private async assembled() {
    // Turns beyond the minimum show how much trial and error it took.
    const minTurns = this.pieces.reduce((s, p) => s + ((4 - p.turns) % 4), 0);
    this.run?.answer({ item: `puzzle-${this.spec.cols}x${this.spec.rows}`, correct: this.misdrops === 0, ms: Date.now() - this.startedAt, misdrops: this.misdrops, extraTurns: this.turnsUsed - minTurns, skill: 'spatial' });
    if (!(await this.talk(phrase('rumb.map.done')))) return;
    await this.sail();
  }

  // ---------- sailing by compass words ----------

  private async sail() {
    const route: Route = planRoute(this.rng, this.spec.steps, GRID);
    const cellCenter = (c: { x: number; y: number }) => ({ x: BOARD.x - MAP / 2 + c.x * CELL + CELL / 2, y: BOARD.y - MAP / 2 + c.y * CELL + CELL / 2 });
    const end = cellCenter(endOf(route));
    const x = this.add.text(end.x, end.y, '✕', { fontFamily: FONT, fontSize: '72px', color: '#e63946', fontStyle: 'bold' }).setOrigin(0.5).setDepth(5).setAlpha(0.25);
    let pos = { ...route.start };
    const ship = this.add.image(cellCenter(pos).x, cellCenter(pos).y, 'yacht-top').setDisplaySize(80, 80).setDepth(6);
    // Compass rose with big buttons.
    const cx = 960;
    const cy = 420;
    this.add.circle(cx, cy, 70, 0xfff1d0).setStrokeStyle(6, 0x3d2b1f);
    this.add.star(cx, cy, 4, 16, 62, 0xe9c46a).setStrokeStyle(3, 0x3d2b1f);
    const at: Record<Compass, [number, number, string]> = { north: [cx, cy - 170, 'N'], south: [cx, cy + 170, 'S'], east: [cx + 170, cy, 'E'], west: [cx - 170, cy, 'W'] };
    let answer: ((d: Compass) => void) | undefined;
    for (const d of COMPASS) {
      const [bx, by, letter] = at[d];
      const b = button(this, bx, by, letter, () => answer?.(d), { w: 110, h: 110, color: d === 'north' ? 0xe63946 : 0x277da1 });
      b.add(this.add.text(0, 40, d, { fontFamily: FONT, fontSize: '20px', color: '#fff' }).setOrigin(0.5));
    }
    if (!(await this.talk(phrase('rumb.map.nav')))) return;
    let right = 0;
    for (const step of route.steps) {
      const t0 = Date.now();
      let first = true;
      for (;;) {
        voice.say(english(dirLine(step)));
        const got = await new Promise<Compass>((r) => (answer = r));
        answer = undefined;
        if (!this.sys.isActive()) return;
        const ok = got === step;
        if (first) recordWord(dirLine(step), ok, 'mappuzzle');
        this.run?.answer({ item: dirLine(step), correct: ok, chosen: got, ms: Date.now() - t0, skill: 'compass' });
        if (ok) {
          if (first) right++;
          break;
        }
        first = false;
        this.cameras.main.shake(120, 0.003);
        if (!(await this.talk(english(dirLine(got)), phrase('rumb.map.navwrong')))) return;
      }
      pos = { x: pos.x + STEP[step].x, y: pos.y + STEP[step].y };
      const c = cellCenter(pos);
      await new Promise((r) => this.tweens.add({ targets: ship, x: c.x, y: c.y, duration: 380, onComplete: r }));
    }
    x.setAlpha(1);
    this.tweens.add({ targets: x, scale: 1.4, yoyo: true, repeat: 2, duration: 200 });
    this.finish(right, route.steps.length);
  }

  private finish(right: number, total: number) {
    const clean = this.misdrops <= 1 && right === total;
    const next = clean ? Math.min(MAX_LEVEL, this.level + 1) : right < total / 2 ? Math.max(1, this.level - 1) : this.level;
    try {
      localStorage.setItem(KEY, JSON.stringify({ level: next }));
    } catch {
      /* private mode */
    }
    const stars = clean ? 3 : right >= total - 1 ? 2 : 1;
    this.run?.end({ completed: true, stars, score: right, total, misdrops: this.misdrops, levelChange: next - this.level });
    this.run = undefined;
    const layer: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive(),
      this.add.rectangle(W / 2, H / 2, 760, 420, 0xfffaf0).setStrokeStyle(8, 0xa5683a),
      this.add.text(W / 2, 200, 'Сокровище найдено!', { fontFamily: FONT, fontSize: '50px', color: '#a5683a' }).setOrigin(0.5),
    ];
    for (let i = 0; i < 3; i++) layer.push(this.add.star(W / 2 - 110 + i * 110, 300, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    layer.push(button(this, W / 2 - 170, 440, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    layer.push(button(this, W / 2 + 170, 440, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    void this.talk(phrase('rumb.map.treasure'));
  }
}
