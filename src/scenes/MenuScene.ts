import Phaser from 'phaser';
import { voice } from '../core/audio';
import { join, phrase, type PhraseId, type Utterance } from '../core/phrases';
import { analytics, track } from '../core/analytics';
import {
  addEvent,
  lastPlayed,
  pickTip,
  progressFromEvents,
  progressOf,
  totalStars,
  type ProgressMap,
} from '../core/menuProgress';
import type { GameState } from '../game-state';
import { GAMES, type GameEntry } from '../games/registry';
import { openParentGate } from '../parent/gate';
import { FONT, H, W } from './ui';

const OPENED_KEY = 'menu-opened';
/** Tile size and the distance between tile centres in the carousel. */
const TILE_W = 280;
const TILE_H = 360;
const STEP = 310;
/** Vertical centre of the carousel. */
const CY = 368;
/** Tiles next to the focused one are this much smaller. */
const SIDE_SCALE = 0.84;
/** A pointer that moved more than this is a swipe, not a tap. */
const DRAG_PX = 14;

function readOpened(): string[] {
  try {
    return JSON.parse(localStorage.getItem(OPENED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

// ---------- progress, shared by every menu visit ----------

let progress: ProgressMap | undefined;
let loading: Promise<ProgressMap> | undefined;
let listening = false;

/**
 * Progress from the event log: read once, then kept up to date from new events.
 * `fresh` re-reads the log (after events were imported from another device).
 */
export function loadMenuProgress(fresh = false): Promise<ProgressMap> {
  if (!listening) {
    listening = true;
    analytics.onEvent((e) => progress && addEvent(progress, e));
  }
  if (fresh) loading = undefined;
  loading ??= analytics
    .all()
    .then((events) => (progress = progressFromEvents(events)))
    .catch(() => (progress = {}));
  return loading;
}

/** What Rumb says about a game: its own voiced line, or the title for a game added without one. */
function gameLine(g: GameEntry): Utterance {
  try {
    return phrase(`rumb.menu.game.${g.id}` as PhraseId);
  } catch {
    return { show: g.title, segs: [{ id: '', show: g.title, say: g.title, voiced: false }], speaker: 'rumb' };
  }
}

interface Tile {
  game: GameEntry;
  box: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Graphics;
  play: Phaser.GameObjects.Container;
  stars: Phaser.GameObjects.Container;
  starText: Phaser.GameObjects.Text;
}

/**
 * Main menu, the first screen. Built for a child who does not read yet:
 *  - one row of big picture tiles, one choice in the middle at a time;
 *  - every tile says its name aloud when it comes to the middle;
 *  - the middle tile starts with one more tap (or its green ▶), a side tile
 *    first slides to the middle, so a stray tap never throws the child into a game;
 *  - Rumb suggests a game (new ones first, then the one played longest ago) and the
 *    row opens on it;
 *  - each tile shows the stars collected in that game, the top corner shows the total,
 *    and new stars since the last visit fly in.
 * Swipe, tap, mouse wheel, arrow keys + Enter (and anything mapped to them: gamepad,
 * TV remote) all move the same focus. Tile order never changes, so the child can
 * remember where a game lives.
 */
export class MenuScene extends Phaser.Scene {
  /** Gamepad layer: the pad is turned into arrow keys + Enter, which this scene handles itself. */
  padMode = 'keys' as const;
  private tiles: Tile[] = [];
  private games: GameEntry[] = [];
  /** Scroll position in tiles (0 = first tile in the middle); fractional while moving. */
  private scroll = { pos: 0 };
  private focus = 0;
  private tipId?: string;
  private bubble?: Phaser.GameObjects.Container;
  private bubbleText?: Phaser.GameObjects.Text;
  private bubbleBg?: Phaser.GameObjects.Graphics;
  private dots: Phaser.GameObjects.Arc[] = [];
  private arrows: Phaser.GameObjects.Container[] = [];
  private totalText?: Phaser.GameObjects.Text;
  private totalStar?: Phaser.GameObjects.Star;
  private ready = false;
  private leaving = false;
  private sayTimer?: Phaser.Time.TimerEvent;
  /** Taps on side tiles this visit; the first ones get the "tap again" hint. */
  private hinted = 0;
  private drag?: { x: number; pos: number; moved: boolean; from: number };
  private lastWheel = 0;

  constructor() {
    super('Menu');
  }

  preload() {
    for (const g of GAMES) {
      const { key, url, svg } = g.icon;
      if (this.textures.exists(key)) continue;
      if (url) this.load.image(key, url);
      else if (svg) this.load.svg(key, `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`, { scale: 1 });
    }
  }

  create() {
    const state = this.registry.get('state') as GameState;
    // Back home from a game ("Домой"): whatever was running ends as left in the middle.
    analytics.abandonAll('home');
    this.tiles = [];
    this.dots = [];
    this.arrows = [];
    this.ready = false;
    this.leaving = false;
    this.hinted = 0;
    this.games = GAMES.filter((g) => !g.hidden);
    this.drawBackdrop();

    const title = this.add
      .text(W / 2, 58, `Капитан ${state.profile.childName}`, {
        fontFamily: FONT, fontSize: '50px', color: '#ffffff', fontStyle: 'bold', stroke: '#14365a', strokeThickness: 11,
        shadow: { offsetX: 0, offsetY: 5, color: '#0b2233', blur: 0, fill: true, stroke: true },
      })
      .setOrigin(0.5);

    const parent = this.add.container(W - 112, H - 34);
    const pbg = this.add.graphics();
    pbg.fillStyle(0x0b2233, 0.6).fillRoundedRect(-100, -22, 200, 44, 22);
    parent.add([pbg, this.add.text(0, 0, 'Для родителей', { fontFamily: FONT, fontSize: '21px', color: '#ffffff' }).setOrigin(0.5)]);
    parent.setSize(200, 44).setInteractive({ useHandCursor: true }).on('pointerup', () => openParentGate(this, state));

    if (this.registry.get('menu-unlocked')) {
      void this.start(false);
      track('menu', 'menu.open');
      return;
    }
    // First screen after loading: one big button, the tap unlocks audio.
    title.setY(H / 2 - 130).setScale(1.3);
    parent.setVisible(false);
    const rumb = this.add.image(W / 2, H / 2 - 260, 'char-rumb').setDisplaySize(150, 150).setVisible(false);
    const play = this.playButton(W / 2, H / 2 + 40, () => {
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      voice.unlock();
      this.registry.set('menu-unlocked', true);
      track('menu', 'menu.open', { first: true });
      this.tweens.add({ targets: play, scale: 0, alpha: 0, duration: 250, onComplete: () => play.destroy() });
      this.tweens.add({ targets: title, y: 58, scale: 1, duration: 450, ease: 'Cubic.easeOut' });
      rumb.destroy();
      parent.setVisible(true);
      void this.start(true);
    });
  }

  update() {
    if (this.tiles.length) this.layout();
  }

  // ---------- start ----------

  private async start(first: boolean) {
    const map = await loadMenuProgress();
    if (!this.scene.isActive()) return;
    const opened = readOpened();
    const ids = this.games.map((g) => g.id);
    const just = lastPlayed(map);
    this.tipId = pickTip(ids, map, { fresh: this.games.filter((g) => g.isNew && !opened.includes(g.id) && !progressOf(map, g.id).plays).map((g) => g.id), lastPlayed: just });
    const tipIndex = Math.max(0, ids.indexOf(this.tipId ?? ''));

    this.drawRumb();
    this.drawTotal(map);
    this.games.forEach((g) => this.tiles.push(this.tile(g, map, opened)));
    this.drawArrows();
    this.drawDots();
    this.drawTipBadge();
    this.bindInput();

    // The row slides in from where the child last was (or the start) to Rumb's tip.
    const from = Phaser.Math.Clamp((this.registry.get('menu-focus') as number | undefined) ?? 0, 0, this.games.length - 1);
    this.scroll.pos = from;
    this.focus = tipIndex;
    this.layout();
    this.tiles.forEach((t, i) => {
      t.box.setAlpha(0);
      this.tweens.add({ targets: t.box, alpha: 1, delay: 80 + Math.abs(i - from) * 60, duration: 300 });
    });
    this.tweens.add({
      targets: this.scroll, pos: tipIndex, delay: 350, duration: 600 + Math.min(4, Math.abs(tipIndex - from)) * 120, ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.ready = true;
        this.refreshFocus();
      },
    });
    this.refreshFocus();

    const tipGame = this.games[tipIndex];
    const line = tipGame ? join(phrase('rumb.menu.tip'), gameLine(tipGame)) : phrase('rumb.menu.hello');
    this.say(first ? join(phrase('rumb.menu.hello'), line) : line);
  }

  // ---------- backdrop ----------

  private drawBackdrop() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x48b5e8, 0x48b5e8, 0xbfe9ff, 0xbfe9ff, 1).fillRect(0, 0, W, 470);
    // Sun with slowly turning rays.
    const rays = this.add.graphics({ x: 110, y: 86 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rays.fillStyle(0xfff3b0, 0.45).fillTriangle(Math.cos(a - 0.12) * 60, Math.sin(a - 0.12) * 60, Math.cos(a + 0.12) * 60, Math.sin(a + 0.12) * 60, Math.cos(a) * 120, Math.sin(a) * 120);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });
    this.add.circle(110, 86, 54, 0xffd166).setStrokeStyle(6, 0xffe8a3);
    [[330, 120, 1], [800, 64, 0.8], [1100, 150, 1.1]].forEach(([x, y, s], i) => {
      const c = this.cloud(x!, y!, s!);
      this.tweens.add({ targets: c, x: `+=${80 + i * 30}`, yoyo: true, repeat: -1, duration: 9000 + i * 2500, ease: 'Sine.easeInOut' });
    });
    // Far island with palms, then the sea in three layers of waves.
    const isl = this.add.graphics();
    isl.fillStyle(0x52b788).fillEllipse(1130, 470, 420, 120);
    isl.fillStyle(0xf4d58d).fillEllipse(1130, 476, 440, 50);
    for (const [px, h] of [[1060, 90], [1180, 120]] as const) {
      isl.lineStyle(10, 0x8d5524).beginPath().moveTo(px, 460).lineTo(px + 14, 460 - h).strokePath();
      isl.fillStyle(0x2d6a4f);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI + (k / 4) * Math.PI;
        isl.fillEllipse(px + 14 + Math.cos(a) * 34, 460 - h + Math.sin(a) * 12 + 8, 70, 22);
      }
    }
    const waves: [number, number, number][] = [[470, 0x5fa8d3, 0], [530, 0x3a86c8, 1], [600, 0x1b6aa5, 2]];
    for (const [y, color, i] of waves) {
      const g = this.add.graphics({ x: 0, y });
      g.fillStyle(color);
      g.beginPath();
      g.moveTo(-80, 40);
      for (let x = -80; x <= W + 80; x += 10) g.lineTo(x, Math.sin((x / 90) + i) * 9);
      g.lineTo(W + 80, H);
      g.lineTo(-80, H);
      g.closePath();
      g.fillPath();
      g.lineStyle(3, 0xffffff, 0.35);
      g.beginPath();
      for (let x = -80; x <= W + 80; x += 10) (x === -80 ? g.moveTo : g.lineTo).call(g, x, Math.sin((x / 90) + i) * 9);
      g.strokePath();
      this.tweens.add({ targets: g, x: i % 2 ? 40 : -40, yoyo: true, repeat: -1, duration: 3200 + i * 700, ease: 'Sine.easeInOut' });
    }
    for (let i = 0; i < 14; i++) {
      const s = this.add.star(Phaser.Math.Between(20, W - 20), Phaser.Math.Between(500, 700), 4, 2, 7, 0xffffff, 0.8);
      this.tweens.add({ targets: s, alpha: 0, scale: 0.4, yoyo: true, repeat: -1, delay: i * 300, duration: 1200 });
    }
    for (let i = 0; i < 2; i++) {
      const gull = this.add.image(-60, 130 + i * 60, 'gull').setDisplaySize(60, 41);
      this.tweens.add({ targets: gull, x: W + 80, duration: 22000 + i * 6000, delay: i * 7000, repeat: -1 });
      this.tweens.add({ targets: gull, y: `+=16`, yoyo: true, repeat: -1, duration: 1300 + i * 200, ease: 'Sine.easeInOut' });
    }
  }

  private cloud(x: number, y: number, s: number) {
    const g = this.add.graphics({ x, y }).setScale(s);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(-50, 10, 34).fillCircle(0, -8, 46).fillCircle(52, 8, 36).fillRoundedRect(-84, 4, 170, 40, 20);
    return g;
  }

  /** Rumb on a barrel in the corner, with a speech bubble that shows what he says. */
  private drawRumb() {
    const barrel = this.add.graphics({ x: 74, y: 672 });
    barrel.fillStyle(0x8d5524).fillRoundedRect(-44, -30, 88, 70, 18);
    barrel.fillStyle(0xa0662e).fillRoundedRect(-36, -30, 72, 70, 14);
    barrel.lineStyle(5, 0x5c3317).strokeRoundedRect(-44, -30, 88, 70, 18);
    barrel.lineStyle(4, 0x3d2210).lineBetween(-44, -12, 44, -12).lineBetween(-44, 22, 44, 22);
    const rumb = this.add.image(74, 600, 'char-rumb').setDisplaySize(120, 120).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: rumb, y: 590, angle: 4, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    rumb.on('pointerup', () => {
      const tip = this.games.find((g) => g.id === this.tipId);
      const i = tip ? this.games.indexOf(tip) : -1;
      if (i >= 0) this.focusTo(i, false);
      this.say(tip ? join(phrase('rumb.menu.tip'), gameLine(tip)) : phrase('rumb.menu.hello'));
    });
    this.bubbleBg = this.add.graphics();
    this.bubbleText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '22px', color: '#14365a', fontStyle: 'bold' }).setOrigin(0, 0.5);
    this.bubble = this.add.container(150, 668, [this.bubbleBg, this.bubbleText]).setAlpha(0);
  }

  private say(u: Utterance) {
    this.sayTimer?.remove();
    voice.say(u);
    if (!this.bubble || !this.bubbleText || !this.bubbleBg) return;
    const text = u.show.replace(/\s+/g, ' ').trim();
    this.bubbleText.setText(text).setWordWrapWidth(400, true);
    const w = Math.min(440, this.bubbleText.width + 40);
    const h = Math.max(52, this.bubbleText.height + 18);
    this.bubbleText.setPosition(20, 0);
    this.bubble.setY(Math.min(668, H - 8 - h / 2));
    this.bubbleBg.clear();
    this.bubbleBg.fillStyle(0x0b2233, 0.25).fillRoundedRect(2, -h / 2 + 5, w, h, 22);
    this.bubbleBg.fillStyle(0xffffff).fillRoundedRect(0, -h / 2, w, h, 22);
    this.bubbleBg.fillTriangle(2, -8, 2, 12, -20, 8);
    this.bubbleBg.lineStyle(4, 0x14365a).strokeRoundedRect(0, -h / 2, w, h, 22);
    this.bubbleBg.fillStyle(0xffffff).fillRect(-2, -6, 8, 16);
    this.bubbleBg.lineStyle(4, 0x14365a).lineBetween(0, -10, -20, 8).lineBetween(-20, 8, 0, 14);
    this.tweens.killTweensOf(this.bubble);
    this.bubble.setAlpha(1).setScale(0.9);
    this.tweens.add({ targets: this.bubble, scale: 1, duration: 160, ease: 'Back.easeOut' });
    // Fades once the line is over, so an old line does not hang on the screen.
    const shown = text;
    void Promise.all([voice.idle(9000), new Promise((r) => setTimeout(r, 3000))]).then(() => {
      if (!this.bubble?.active || this.bubbleText?.text !== shown) return;
      this.tweens.add({ targets: this.bubble, alpha: 0, delay: 1500, duration: 400 });
    });
  }

  // ---------- total stars ----------

  private drawTotal(map: ProgressMap) {
    const total = totalStars(map);
    const seen = (this.registry.get('menu-stars') as number | undefined) ?? total;
    this.registry.set('menu-stars', total);
    const x = W - 128;
    const y = 58;
    const g = this.add.graphics({ x, y });
    g.fillStyle(0x0b2233, 0.35).fillRoundedRect(-100, -30, 200, 64, 32);
    g.fillStyle(0xffffff).fillRoundedRect(-100, -34, 200, 64, 32);
    g.lineStyle(5, 0x14365a).strokeRoundedRect(-100, -34, 200, 64, 32);
    this.totalStar = this.add.star(x - 58, y - 2, 5, 13, 30, 0xffc300).setStrokeStyle(4, 0xb87700);
    this.tweens.add({ targets: this.totalStar, angle: 12, yoyo: true, repeat: -1, duration: 1500, ease: 'Sine.easeInOut' });
    this.totalText = this.add
      .text(x + 22, y - 2, String(seen), { fontFamily: FONT, fontSize: '40px', color: '#14365a', fontStyle: 'bold' })
      .setOrigin(0.5);
    if (total > seen) this.starsFlyIn(seen, total);
  }

  /** New stars since the last visit fly from the middle of the screen into the counter. */
  private starsFlyIn(from: number, to: number) {
    const n = Math.min(12, to - from);
    const target = this.totalStar!;
    let got = 0;
    for (let i = 0; i < n; i++) {
      const s = this.add.star(W / 2, CY, 5, 10, 24, 0xffc300).setStrokeStyle(3, 0xb87700).setDepth(50).setScale(0);
      this.tweens.chain({
        targets: s,
        tweens: [
          { scale: 1.4, x: W / 2 + Phaser.Math.Between(-180, 180), y: CY + Phaser.Math.Between(-120, 60), duration: 350, delay: 500 + i * 110, ease: 'Back.easeOut' },
          {
            scale: 0.6, x: target.x, y: target.y, duration: 520, ease: 'Cubic.easeIn',
            onComplete: () => {
              s.destroy();
              got++;
              const shown = got === n ? to : from + Math.round(((to - from) * got) / n);
              this.totalText?.setText(String(shown));
              this.tweens.add({ targets: [this.totalText, target], scale: 1.3, yoyo: true, duration: 120 });
            },
          },
        ],
      });
    }
  }

  // ---------- tiles ----------

  private tile(g: GameEntry, map: ProgressMap, opened: string[]): Tile {
    const box = this.add.container(0, CY);
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const HEAD = 214;
    const bg = this.add.graphics();
    bg.fillStyle(0x0b2233, 0.3).fillRoundedRect(-hw + 5, -hh + 12, TILE_W, TILE_H, 30);
    bg.fillStyle(0xffffff).fillRoundedRect(-hw, -hh, TILE_W, TILE_H, 30);
    bg.fillStyle(g.color).fillRoundedRect(-hw, -hh, TILE_W, HEAD, { tl: 30, tr: 30, bl: 0, br: 0 });
    // Light from above and a few bubbles on the coloured part.
    bg.fillStyle(0xffffff, 0.12).fillRoundedRect(-hw + 12, -hh + 10, TILE_W - 24, 40, 20);
    bg.fillStyle(0xffffff, 0.12).fillCircle(hw - 44, -hh + 170, 46).fillCircle(-hw + 38, -hh + 190, 26).fillCircle(-hw + 70, -hh + 70, 14);
    bg.fillStyle(0x000000, 0.12).fillRect(-hw, -hh + HEAD - 8, TILE_W, 8);
    bg.lineStyle(6, 0x14365a).strokeRoundedRect(-hw, -hh, TILE_W, TILE_H, 30);
    box.add(bg);
    if (this.textures.exists(g.icon.key)) {
      const img = this.add.image(0, -hh + HEAD / 2 + 4, g.icon.key);
      img.setScale(Math.min(210 / img.width, 170 / img.height));
      box.add(img);
      this.tweens.add({ targets: img, y: img.y - 7, yoyo: true, repeat: -1, duration: 1400 + (g.id.length % 5) * 120, ease: 'Sine.easeInOut' });
    }
    box.add(
      this.add
        .text(0, -hh + HEAD + 52, g.title, {
          fontFamily: FONT, fontSize: g.title.length > 15 ? '28px' : '32px', color: '#14365a', fontStyle: 'bold', align: 'center',
          wordWrap: { width: TILE_W - 30 }, lineSpacing: -4,
        })
        .setOrigin(0.5),
    );

    // Stars collected in this game, a pill in the top corner.
    const p = progressOf(map, g.id);
    const stars = this.add.container(hw - 58, -hh + 34);
    const sbg = this.add.graphics();
    sbg.fillStyle(0xffffff).fillRoundedRect(-48, -22, 96, 44, 22).lineStyle(4, 0x14365a).strokeRoundedRect(-48, -22, 96, 44, 22);
    const starText = this.add.text(16, 0, String(p.stars), { fontFamily: FONT, fontSize: '28px', color: '#14365a', fontStyle: 'bold' }).setOrigin(0.5);
    stars.add([sbg, this.add.star(-22, 0, 5, 8, 18, 0xffc300).setStrokeStyle(3, 0xb87700), starText]);
    stars.setVisible(p.plays > 0);
    box.add(stars);

    if (g.isNew && !opened.includes(g.id) && !p.plays) {
      const r = this.add.container(hw - 44, -hh + 26).setAngle(16);
      const rb = this.add.graphics();
      rb.fillStyle(0xe63946).fillRoundedRect(-56, -19, 112, 38, 12).lineStyle(4, 0xffffff).strokeRoundedRect(-56, -19, 112, 38, 12);
      r.add([rb, this.add.text(0, 0, 'Новое!', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)]);
      this.tweens.add({ targets: r, scale: 1.1, yoyo: true, repeat: -1, duration: 600 });
      box.add(r);
    }

    // Focus ring: thick and bright, so it is seen from the sofa too (TV, projector).
    const ring = this.add.graphics();
    ring.lineStyle(10, 0xffd60a).strokeRoundedRect(-hw - 12, -hh - 12, TILE_W + 24, TILE_H + 24, 40);
    ring.lineStyle(3, 0xffffff, 0.9).strokeRoundedRect(-hw - 5, -hh - 5, TILE_W + 10, TILE_H + 10, 34);
    ring.setVisible(false);
    box.addAt(ring, 0);

    // Big green ▶ on the bottom edge of the middle tile.
    const play = this.add.container(0, hh + 6);
    const pg = this.add.graphics();
    pg.fillStyle(0x0b2233, 0.3).fillCircle(0, 6, 44);
    pg.fillStyle(0x2dc653).fillCircle(0, 0, 44).fillStyle(0x6fe08a).fillCircle(-10, -14, 16);
    pg.lineStyle(6, 0x14365a).strokeCircle(0, 0, 44);
    pg.fillStyle(0xffffff).fillTriangle(-12, -20, -12, 20, 22, 0);
    pg.lineStyle(4, 0x14365a).strokeTriangle(-12, -20, -12, 20, 22, 0);
    play.add(pg).setVisible(false);
    this.tweens.add({ targets: play, scale: 1.12, yoyo: true, repeat: -1, duration: 560, ease: 'Sine.easeInOut' });
    box.add(play);

    return { game: g, box, ring, play, stars, starText };
  }

  /** Rumb's head on the corner of the tip tile, so the suggestion is seen without words. */
  private drawTipBadge() {
    const t = this.tiles.find((x) => x.game.id === this.tipId);
    if (!t) return;
    const c = this.add.container(-TILE_W / 2 + 26, -TILE_H / 2 + 20);
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillCircle(0, 0, 40).lineStyle(5, 0xffd60a).strokeCircle(0, 0, 40);
    c.add([g, this.add.image(0, 2, 'char-rumb').setDisplaySize(70, 70)]);
    this.tweens.add({ targets: c, angle: { from: -10, to: 10 }, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    t.box.add(c);

  }

  private layout() {
    const pos = this.scroll.pos;
    this.tiles.forEach((t, i) => {
      const d = i - pos;
      const ad = Math.abs(d);
      t.box.setVisible(ad < 3.2);
      if (!t.box.visible) return;
      const k = 1 - Math.min(ad, 1) * (1 - SIDE_SCALE);
      t.box.setPosition(W / 2 + d * STEP, CY + Math.min(ad, 1) * 16).setScale(k);
      t.box.setDepth(10 - ad);
    });
  }

  private refreshFocus() {
    this.tiles.forEach((t, i) => {
      const on = i === this.focus;
      t.ring.setVisible(on);
      t.play.setVisible(on && this.ready);
    });
    this.dots.forEach((d, i) => d.setFillStyle(i === this.focus ? 0xffd60a : 0xffffff, i === this.focus ? 1 : 0.55).setRadius(i === this.focus ? 11 : 7));
    this.arrows[0]?.setAlpha(this.focus > 0 ? 1 : 0.3);
    this.arrows[1]?.setAlpha(this.focus < this.tiles.length - 1 ? 1 : 0.3);
  }

  /** Brings tile i to the middle and says its name. */
  private focusTo(i: number, speak = true, hint = false) {
    if (this.leaving || !this.tiles.length) return;
    const to = Phaser.Math.Clamp(i, 0, this.tiles.length - 1);
    const moved = to !== this.focus;
    this.focus = to;
    this.registry.set('menu-focus', to);
    this.tweens.killTweensOf(this.scroll);
    this.ready = true;
    this.tweens.add({ targets: this.scroll, pos: to, duration: 320, ease: 'Cubic.easeOut' });
    this.refreshFocus();
    if (!moved && !speak) return;
    if (!moved) {
      this.tweens.add({ targets: this.tiles[to]!.box, angle: { from: -3, to: 3 }, yoyo: true, repeat: 1, duration: 70, onComplete: () => this.tiles[to]?.box.setAngle(0) });
    }
    if (!speak) return;
    // Waits a moment: scrolling fast through the row should not start a line for every tile.
    this.sayTimer?.remove();
    voice.stop();
    const g = this.tiles[to]!.game;
    this.sayTimer = this.time.delayedCall(220, () => {
      const line = gameLine(g);
      this.say(hint ? join(line, phrase('rumb.menu.again')) : line);
    });
  }

  private step(dir: -1 | 1) {
    this.focusTo(this.focus + dir);
  }

  // ---------- arrows, dots ----------

  private drawArrows() {
    for (const go of [-1, 1] as const) {
      const g = this.add.graphics();
      g.fillStyle(0x0b2233, 0.3).fillCircle(0, 5, 42);
      g.fillStyle(0xffd166).fillCircle(0, 0, 42).lineStyle(6, 0x14365a).strokeCircle(0, 0, 42);
      g.fillStyle(0x14365a).fillTriangle(-10 * go, -18, -10 * go, 18, 16 * go, 0);
      g.lineStyle(6, 0x14365a).strokeTriangle(-10 * go, -18, -10 * go, 18, 16 * go, 0);
      const c = this.add.container(go < 0 ? 54 : W - 54, CY, [g]).setSize(96, 96).setDepth(30).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => c.setScale(0.9));
      c.on('pointerout', () => c.setScale(1));
      c.on('pointerup', () => {
        c.setScale(1);
        this.step(go);
      });
      this.arrows.push(c);
    }
  }

  private drawDots() {
    const n = this.tiles.length;
    const gap = Math.min(26, 560 / Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const d = this.add.circle(W / 2 - ((n - 1) * gap) / 2 + i * gap, 132, 7, 0xffffff, 0.55).setStrokeStyle(2, 0x14365a, 0.6).setDepth(20);
      d.setInteractive({ useHandCursor: true }).on('pointerup', () => this.focusTo(i));
      this.dots.push(d);
    }
  }

  // ---------- input ----------

  private bindInput() {
    // One hit area over the row: a swipe scrolls, a tap picks a tile.
    const zone = this.add.zone(W / 2, CY, W - 220, TILE_H + 90).setInteractive().setDepth(5);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.leaving) return;
      this.tweens.killTweensOf(this.scroll);
      this.drag = { x: p.x, pos: this.scroll.pos, moved: false, from: this.focus };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      const dx = p.x - d.x;
      if (Math.abs(dx) > DRAG_PX) d.moved = true;
      if (d.moved) this.scroll.pos = Phaser.Math.Clamp(d.pos - dx / STEP, -0.4, this.tiles.length - 0.6);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      this.drag = undefined;
      if (!d || this.leaving) return;
      if (d.moved) {
        const dx = p.x - d.x;
        let to = Math.round(this.scroll.pos);
        // A short flick still moves by one.
        if (to === d.from && Math.abs(dx) > 50) to = d.from - Math.sign(dx);
        this.focusTo(to, to !== d.from);
        if (to === d.from) this.focusTo(to, false);
        return;
      }
      const i = Math.round(this.scroll.pos + (p.x - W / 2) / STEP);
      if (i < 0 || i >= this.tiles.length) return;
      if (i === this.focus && Math.abs(this.scroll.pos - i) < 0.3) {
        this.open(this.tiles[i]!.game, 'tap');
        return;
      }
      // A side tile comes to the middle first; the first few times Rumb adds "tap again".
      this.hinted++;
      this.focusTo(i, true, this.hinted <= 2);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => {
      const now = this.time.now;
      const v = Math.abs(dx) > Math.abs(dy) ? dx : dy;
      if (Math.abs(v) < 4 || now - this.lastWheel < 260) return;
      this.lastWheel = now;
      this.step(v > 0 ? 1 : -1);
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      // The parent gate is drawn on top (depth 5000): keys must not reach the row under it.
      if (this.leaving || this.children.list.some((o) => (o as unknown as { depth: number }).depth >= 5000)) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          this.step(-1);
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          this.step(1);
          break;
        case 'Home':
          this.focusTo(0);
          break;
        case 'End':
          this.focusTo(this.tiles.length - 1);
          break;
        case 'Enter':
        case ' ':
          if (this.tiles[this.focus]) this.open(this.tiles[this.focus]!.game, 'key');
          break;
        default:
          return;
      }
      e.preventDefault();
    });
  }

  private playButton(x: number, y: number, onClick: () => void) {
    const g = this.add.graphics();
    g.fillStyle(0x0b2233, 0.35).fillRoundedRect(-200, -56 + 8, 400, 112, 56);
    g.fillStyle(0xffb703).fillRoundedRect(-200, -56, 400, 112, 56);
    g.fillStyle(0xffd166).fillRoundedRect(-188, -50, 376, 50, 25);
    g.lineStyle(6, 0x9c6500).strokeRoundedRect(-200, -56, 400, 112, 56);
    const t = this.add.text(0, 0, 'Играть!', { fontFamily: FONT, fontSize: '56px', color: '#5a3200', fontStyle: 'bold' }).setOrigin(0.5);
    const c = this.add.container(x, y, [g, t]).setSize(400, 112).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: c, scale: 1.06, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    c.on('pointerup', onClick);
    // Enter / Space (keyboard, gamepad, TV remote) presses it too.
    const key = (e: KeyboardEvent) => {
      if (!c.active || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      this.input.keyboard?.off('keydown', key);
      onClick();
    };
    this.input.keyboard?.on('keydown', key);
    return c;
  }

  private open(g: GameEntry, via: 'tap' | 'key') {
    if (this.leaving) return;
    this.leaving = true;
    const opened = readOpened();
    if (!opened.includes(g.id)) {
      try {
        localStorage.setItem(OPENED_KEY, JSON.stringify([...opened, g.id]));
      } catch {
        /* private mode */
      }
    }
    track('menu', 'menu.pick', { game: g.id, tip: g.id === this.tipId, via });
    this.sayTimer?.remove();
    voice.stop();
    const t = this.tiles.find((x) => x.game === g);
    if (t) this.tweens.add({ targets: t.box, scale: 1.12, duration: 160, yoyo: true });
    this.time.delayedCall(180, () => {
      this.cameras.main.fadeOut(220, 11, 34, 51);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(g.scene, g.data));
    });
  }
}
