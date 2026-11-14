import Phaser from 'phaser';
import { voice } from '../core/audio';
import { phrase } from '../core/phrases';
import { analytics, track } from '../core/analytics';
import type { GameState } from '../game-state';
import { GAMES, SKILL_LABEL, type GameEntry } from '../games/registry';
import { openParentGate } from '../parent/gate';
import { FONT, H, W } from './ui';

const OPENED_KEY = 'menu-opened';
const PER_PAGE = 6;
const CARD_W = 290;
const CARD_H = 236;
const COLS_X = [478, 792, 1106];
const ROWS_Y = [258, 518];

function readOpened(): string[] {
  try {
    return JSON.parse(localStorage.getItem(OPENED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * Main menu, the first screen: a sunny harbour with the crew and a card for
 * every game in the registry. The first visit after loading waits for a tap
 * («Играть!»), which also unlocks sound on phones.
 */
export class MenuScene extends Phaser.Scene {
  private page = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private pager: Phaser.GameObjects.GameObject[] = [];

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
    this.cards = [];
    this.pager = [];
    this.drawBackdrop();
    this.drawCrew();

    const name = state.profile.childName;
    const title = this.add
      .text(W / 2 + 150, 66, `Капитан ${name}`, {
        fontFamily: FONT, fontSize: '58px', color: '#ffffff', fontStyle: 'bold', stroke: '#14365a', strokeThickness: 12,
        shadow: { offsetX: 0, offsetY: 6, color: '#0b2233', blur: 0, fill: true, stroke: true },
      })
      .setOrigin(0.5);

    const parent = this.add.container(W - 112, H - 36);
    const pbg = this.add.graphics();
    pbg.fillStyle(0x0b2233, 0.75).fillRoundedRect(-100, -24, 200, 48, 24);
    parent.add([pbg, this.add.text(0, 0, 'Для родителей', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5)]);
    parent.setSize(200, 48).setInteractive({ useHandCursor: true }).on('pointerup', () => openParentGate(this, state));

    if (this.registry.get('menu-unlocked')) {
      this.showCards(false);
      track('menu', 'menu.open');
      return;
    }
    // First screen after loading: one big button, the tap unlocks audio.
    title.setY(H / 2 - 120).setScale(1.25);
    parent.setVisible(false);
    const play = this.playButton(W / 2 + 150, H / 2 + 40, () => {
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      voice.unlock();
      this.registry.set('menu-unlocked', true);
      track('menu', 'menu.open', { first: true });
      this.tweens.add({ targets: play, scale: 0, alpha: 0, duration: 250, onComplete: () => play.destroy() });
      this.tweens.add({ targets: title, y: 66, scale: 1, duration: 450, ease: 'Cubic.easeOut' });
      parent.setVisible(true);
      this.showCards(true);
      voice.say(phrase('rumb.menu.hello'));
    });
  }

  // ---------- backdrop ----------

  private drawBackdrop() {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x48b5e8, 0x48b5e8, 0xbfe9ff, 0xbfe9ff, 1).fillRect(0, 0, W, 470);
    // Sun with slowly turning rays.
    const rays = this.add.graphics({ x: 120, y: 96 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rays.fillStyle(0xfff3b0, 0.45).fillTriangle(Math.cos(a - 0.12) * 70, Math.sin(a - 0.12) * 70, Math.cos(a + 0.12) * 70, Math.sin(a + 0.12) * 70, Math.cos(a) * 140, Math.sin(a) * 140);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });
    this.add.circle(120, 96, 64, 0xffd166).setStrokeStyle(6, 0xffe8a3);
    // Clouds drifting across.
    [[300, 120, 1], [760, 70, 0.8], [1120, 150, 1.1]].forEach(([x, y, s], i) => {
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
    // Sparkles on the water.
    for (let i = 0; i < 14; i++) {
      const s = this.add.star(Phaser.Math.Between(20, W - 20), Phaser.Math.Between(500, 700), 4, 2, 7, 0xffffff, 0.8);
      this.tweens.add({ targets: s, alpha: 0, scale: 0.4, yoyo: true, repeat: -1, delay: i * 300, duration: 1200 });
    }
    // Gulls.
    for (let i = 0; i < 2; i++) {
      const gull = this.add.image(-60, 150 + i * 70, 'gull').setDisplaySize(70, 48);
      this.tweens.add({ targets: gull, x: W + 80, duration: 22000 + i * 6000, delay: i * 7000, repeat: -1 });
      this.tweens.add({ targets: gull, y: `+=18`, yoyo: true, repeat: -1, duration: 1300 + i * 200, ease: 'Sine.easeInOut' });
    }
  }

  private cloud(x: number, y: number, s: number) {
    const g = this.add.graphics({ x, y }).setScale(s);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(-50, 10, 34).fillCircle(0, -8, 46).fillCircle(52, 8, 36).fillRoundedRect(-84, 4, 170, 40, 20);
    return g;
  }

  private drawCrew() {
    const yacht = this.add.image(168, 548, 'yacht-side').setDisplaySize(300, 277);
    this.tweens.add({ targets: yacht, angle: 2.5, y: 556, yoyo: true, repeat: -1, duration: 1500, ease: 'Sine.easeInOut' });
    const rumb = this.add.image(160, 320, 'char-rumb').setDisplaySize(160, 160).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: rumb, y: 304, angle: 5, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
    rumb.on('pointerup', () => voice.say(phrase('rumb.menu.hello')));
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
    return c;
  }

  // ---------- cards ----------

  private visibleGames(): GameEntry[] {
    return GAMES.filter((g) => !g.hidden);
  }

  private showCards(animate: boolean) {
    this.cards.forEach((c) => c.destroy());
    this.pager.forEach((c) => c.destroy());
    this.cards = [];
    this.pager = [];
    const games = this.visibleGames();
    const pages = Math.max(1, Math.ceil(games.length / PER_PAGE));
    this.page = Math.min(this.page, pages - 1);
    const opened = readOpened();
    games.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((g, i) => {
      const card = this.card(g, COLS_X[i % 3]!, ROWS_Y[Math.floor(i / 3)]!, g.isNew && !opened.includes(g.id));
      this.cards.push(card);
      if (animate) {
        card.setScale(0).setAlpha(0);
        this.tweens.add({ targets: card, scale: 1, alpha: 1, delay: 150 + i * 90, duration: 380, ease: 'Back.easeOut' });
      }
    });
    if (pages > 1) {
      const cx = COLS_X[1]!;
      // Drawn with Graphics around (0, 0): Phaser's Triangle shape centres on its bounding box, which shifted the arrows off-centre.
      const arrow = (dx: number, enabled: boolean, go: -1 | 1) => {
        const g = this.add.graphics();
        g.fillStyle(0x0b2233, 0.3).fillCircle(0, 4, 32);
        g.fillStyle(0xffd166).fillCircle(0, 0, 32).lineStyle(5, 0x14365a).strokeCircle(0, 0, 32);
        // A rounded arrowhead pointing left or right, its visual centre on the circle's centre.
        const t = go;
        g.fillStyle(0x14365a).fillTriangle(-9 * t, -15, -9 * t, 15, 15 * t, 0);
        g.lineStyle(6, 0x14365a).strokeTriangle(-9 * t, -15, -9 * t, 15, 15 * t, 0);
        const c = this.add.container(cx + dx, H - 38, [g]).setSize(72, 72).setAlpha(enabled ? 1 : 0.35);
        if (enabled) {
          c.setInteractive({ useHandCursor: true });
          c.on('pointerdown', () => c.setScale(0.9));
          c.on('pointerout', () => c.setScale(1));
          c.on('pointerup', () => {
            this.page += go;
            this.showCards(true);
          });
        }
        this.pager.push(c);
      };
      arrow(-130, this.page > 0, -1);
      arrow(130, this.page < pages - 1, 1);
      for (let p = 0; p < pages; p++) this.pager.push(this.add.circle(cx - (pages - 1) * 14 + p * 28, H - 38, 9, 0xffffff, p === this.page ? 1 : 0.45));
    }
  }

  private card(g: GameEntry, x: number, y: number, ribbon?: boolean) {
    const c = this.add.container(x, y);
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    const bg = this.add.graphics();
    bg.fillStyle(0x0b2233, 0.3).fillRoundedRect(-hw + 4, -hh + 10, CARD_W, CARD_H, 26);
    bg.fillStyle(0xffffff).fillRoundedRect(-hw, -hh, CARD_W, CARD_H, 26);
    bg.fillStyle(g.color).fillRoundedRect(-hw, -hh, CARD_W, 124, { tl: 26, tr: 26, bl: 0, br: 0 });
    // A soft light band and bubbles on the coloured part.
    bg.fillStyle(0xffffff, 0.1).fillRoundedRect(-hw + 10, -hh + 8, CARD_W - 20, 30, 15);
    bg.fillStyle(0xffffff, 0.12).fillCircle(hw - 40, -hh + 84, 40).fillCircle(-hw + 34, -hh + 100, 24);
    bg.lineStyle(5, 0x14365a).strokeRoundedRect(-hw, -hh, CARD_W, CARD_H, 26);
    c.add(bg);
    if (this.textures.exists(g.icon.key)) {
      const img = this.add.image(0, -hh + 64, g.icon.key);
      const k = Math.min(150 / img.width, 100 / img.height);
      img.setScale(k);
      c.add(img);
      this.tweens.add({ targets: img, y: img.y - 6, yoyo: true, repeat: -1, duration: 1400 + (x % 5) * 90, ease: 'Sine.easeInOut' });
    }
    c.add(this.add.text(0, 30, g.title, { fontFamily: FONT, fontSize: g.title.length > 13 ? '28px' : '32px', color: '#14365a', fontStyle: 'bold' }).setOrigin(0.5, 0.5));
    c.add(this.add.text(0, 62, g.subtitle, { fontFamily: FONT, fontSize: '21px', color: '#5c677d' }).setOrigin(0.5, 0.5));
    // Skill chips.
    const chips = g.skills.slice(0, 3).map((s) => SKILL_LABEL[s]);
    const widths = chips.map((t) => t.length * 10 + 22);
    let cx = -(widths.reduce((a, b) => a + b, 0) + (chips.length - 1) * 6) / 2;
    chips.forEach((t, i) => {
      const w = widths[i]!;
      const chip = this.add.graphics();
      chip.fillStyle(t === 'English' ? 0xffd166 : 0xe9ecef).fillRoundedRect(cx, 80, w, 26, 13);
      c.add(chip);
      c.add(this.add.text(cx + w / 2, 93, t, { fontFamily: FONT, fontSize: '16px', color: '#14365a', fontStyle: 'bold' }).setOrigin(0.5));
      cx += w + 6;
    });
    if (ribbon) {
      const r = this.add.container(hw - 38, -hh + 20).setAngle(18);
      const rb = this.add.graphics();
      rb.fillStyle(0xe63946).fillRoundedRect(-52, -17, 104, 34, 10).lineStyle(3, 0xffffff).strokeRoundedRect(-52, -17, 104, 34, 10);
      r.add([rb, this.add.text(0, 0, 'Новое!', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)]);
      this.tweens.add({ targets: r, scale: 1.1, yoyo: true, repeat: -1, duration: 600 });
      c.add(r);
    }
    c.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(0.95));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => {
      c.setScale(1);
      this.open(g);
    });
    return c;
  }

  private open(g: GameEntry) {
    const opened = readOpened();
    if (!opened.includes(g.id)) {
      try {
        localStorage.setItem(OPENED_KEY, JSON.stringify([...opened, g.id]));
      } catch {
        /* private mode */
      }
    }
    track('menu', 'menu.pick', { game: g.id });
    voice.stop();
    this.cameras.main.fadeOut(220, 11, 34, 51);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(g.scene, g.data));
  }
}
