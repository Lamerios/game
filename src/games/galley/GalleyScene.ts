import Phaser from 'phaser';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, ENGLISH, join, phrase, type Utterance } from '../../core/phrases';
import { recordWord } from '../../core/wordLog';
import { button, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { preloadWordPictures } from '../snake/SnakeScene';
import {
  BINS, binFor, checkTray, FOODS, nextLevel, planOrders, planSort, ruleOf, type Card, type OrderRound, type SortPhase,
} from './logic';

const KEY = 'galley-progress';
const PAINT = { red: 0xe63946, blue: 0x277da1 } as const;

function readLevel(): number {
  try {
    const v = Number(JSON.parse(localStorage.getItem(KEY) ?? '{}').level);
    return v >= 1 && v <= 4 ? v : 1;
  } catch {
    return 1;
  }
}

/** «Камбуз»: remember the cook's English order, then sort the cargo by a rule that changes. */
export class GalleyScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  private run?: Run;
  private talkToken = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private right = 0;
  private total = 0;

  constructor() {
    super('Galley');
  }

  preload() {
    preloadWordPictures(this, FOODS);
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.level = readLevel();
    this.layer = [];
    this.right = 0;
    this.total = 0;
    this.drawGalley();
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.run = startRun('galley', { level: this.level });
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

  private drawGalley() {
    this.add.rectangle(W / 2, H / 2, W, H, 0xf4d58d);
    const g = this.add.graphics();
    // Wooden wall, shelves, a porthole.
    for (let y = 0; y < 420; y += 60) g.fillStyle(y % 120 ? 0xb5651d : 0xa5683a).fillRect(0, y, W, 60);
    g.lineStyle(3, 0x7a4a24);
    for (let y = 60; y < 420; y += 60) g.lineBetween(0, y, W, y);
    g.fillStyle(0x8ecae6).fillCircle(1100, 170, 70).lineStyle(14, 0xffc94a).strokeCircle(1100, 170, 70);
    g.fillStyle(0x7a4a24).fillRect(0, 420, W, 300);
    g.fillStyle(0x5c3317).fillRect(0, 420, W, 16);
    this.add.image(110, 330, 'char-kettle').setDisplaySize(170, 170);
    this.add.text(40, 40, `Камбуз · уровень ${this.level}`, { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#3d2b1f', strokeThickness: 6 }).setOrigin(0, 0.5);
  }

  private clear() {
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
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

  private wait(ms: number) {
    return new Promise<boolean>((r) => this.time.delayedCall(ms, () => r(this.sys.isActive())));
  }

  private async play() {
    if (!(await this.talk(phrase('kettle.galley.hello')))) return;
    for (const r of planOrders(this.level, this.rng)) if (!(await this.orderRound(r))) return;
    if (!(await this.talk(phrase('kettle.galley.sort')))) return;
    for (const p of planSort(this.level, this.rng)) if (!(await this.sortPhase(p))) return;
    this.finish();
  }

  // ---------- the cook's order ----------

  private async orderRound(r: OrderRound): Promise<boolean> {
    this.clear();
    // The order is only heard, once: the child keeps it in mind.
    const bubble = this.keep(this.add.text(330, 150, '♪ ♪ ♪', { fontFamily: FONT, fontSize: '56px', color: '#3d2b1f', backgroundColor: '#ffffff', padding: { x: 20, y: 8 } }).setOrigin(0.5));
    if (!(await this.talk(phrase('kettle.galley.listen'), join(english('cook.need'), ...r.order.map((id) => english(id)))))) return false;
    bubble.destroy();
    // Tray at the bottom, shelf with foods.
    const tray = this.keep(this.add.rectangle(W / 2, 620, 560, 120, 0xced4da).setStrokeStyle(6, 0x495057));
    void tray;
    const picked: string[] = [];
    const t0 = Date.now();
    const cols = Math.ceil(r.shelf.length / 2);
    let wrong = 0;
    let replays = 0;
    const done = new Promise<void>((resolve) => {
      r.shelf.forEach((id, i) => {
        const x = 330 + (i % cols) * 150;
        const y = 150 + Math.floor(i / cols) * 150;
        const img = this.keep(this.add.image(x, y, `snake-${id}`).setDisplaySize(120, 120).setInteractive({ useHandCursor: true }));
        img.on('pointerup', () => {
          if (picked.includes(id) || picked.length >= r.order.length) return;
          voice.say(english(id));
          if (!r.order.includes(id)) {
            wrong++;
            this.tweens.add({ targets: img, angle: 12, yoyo: true, repeat: 2, duration: 90 });
            this.run?.answer({ item: `order-${r.order.join('+')}`, correct: false, chosen: id, skill: 'memory' });
            return;
          }
          picked.push(id);
          img.disableInteractive();
          this.tweens.add({ targets: img, x: W / 2 - 200 + (picked.length - 1) * 130, y: 620, displayWidth: 100, displayHeight: 100, duration: 400, ease: 'Back.easeOut' });
          if (picked.length === r.order.length) resolve();
        });
      });
      // "Say it again" costs nothing but is logged: how often memory needs a second hearing.
      this.keep(button(this, 1100, 620, 'Повтори', () => {
        replays++;
        voice.say(join(english('cook.need'), ...r.order.map((id) => english(id))));
      }, { w: 220, h: 80, color: 0x2a9d8f }));
    });
    await done;
    if (!this.sys.isActive()) return false;
    const { all, inOrder } = checkTray(r.order, picked);
    const clean = all && wrong === 0 && replays === 0;
    this.total++;
    if (clean) this.right++;
    this.run?.answer({ item: `order-${r.order.join('+')}`, correct: clean, ms: Date.now() - t0, inOrder, replays, wrong, size: r.order.length, skill: 'memory' });
    for (const id of r.order) recordWord(id, clean, 'galley');
    return this.talk(phrase(inOrder ? 'kettle.galley.order' : 'kettle.galley.ok'));
  }

  // ---------- the card sort ----------

  private drawCard(card: Card, x: number, y: number, size = 150) {
    const items: Phaser.GameObjects.GameObject[] = [this.add.rectangle(0, 0, size, size, 0xfffaf0).setStrokeStyle(card.frame ? 12 : 5, card.frame ? 0x111111 : 0x495057)];
    const c = PAINT[card.color];
    items.push(card.shape === 'star' ? this.add.star(0, 0, 5, size * 0.17, size * 0.38, c).setStrokeStyle(4, 0x2b2d42) : this.add.circle(0, 0, size * 0.32, c).setStrokeStyle(4, 0x2b2d42));
    return this.add.container(x, y, items);
  }

  private async sortPhase(p: SortPhase): Promise<boolean> {
    this.clear();
    const line = p.rule === 'color' ? 'sort.color' : p.rule === 'shape' ? 'sort.shape' : 'sort.mixed';
    BINS.forEach((b, i) => {
      const x = i === 0 ? 420 : 860;
      this.keep(this.add.rectangle(x, 560, 300, 230, 0x5c3317).setStrokeStyle(6, 0x2b2d42));
      this.keep(this.drawCard(b, x, 540, 140));
    });
    this.keep(this.add.text(W / 2, 90, ENGLISH[line] ?? '', { fontFamily: FONT, fontSize: '44px', color: '#ffffff', stroke: '#3d2b1f', strokeThickness: 8 }).setOrigin(0.5));
    const intro: Utterance[] = [];
    if (p.rule === 'shape') intro.push(phrase('kettle.galley.switch'));
    if (p.rule === 'mixed') intro.push(phrase('kettle.galley.frame'));
    intro.push(english(line));
    if (!(await this.talk(...intro))) return false;
    this.run?.event('rule_switch', { to: p.rule });
    for (const card of p.cards) {
      const view = this.keep(this.drawCard(card, W / 2, 270));
      this.tweens.add({ targets: view, scale: { from: 0.5, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      const t0 = Date.now();
      const bin = await new Promise<0 | 1>((resolve) => {
        const zones = [0, 1].map((i) => {
          const z = this.keep(this.add.zone(i === 0 ? 420 : 860, 560, 300, 230).setInteractive({ useHandCursor: true }));
          z.on('pointerup', () => {
            zones.forEach((zz) => zz.destroy());
            resolve(i as 0 | 1);
          });
          return z;
        });
      });
      const rule = ruleOf(card, p.rule);
      const ok = bin === binFor(card, rule);
      this.total++;
      if (ok) this.right++;
      this.run?.answer({ item: `${card.color}-${card.shape}${card.frame ? '-frame' : ''}`, correct: ok, chosen: bin === 0 ? 'left' : 'right', ms: Date.now() - t0, rule, phase: p.rule, skill: 'flexibility' });
      const tx = binFor(card, rule) === 0 ? 420 : 860;
      if (!ok) {
        this.cameras.main.shake(140, 0.004);
        if (!(await this.talk(phrase('kettle.galley.wrongsort'), english(rule === 'color' ? 'sort.color' : 'sort.shape')))) return false;
      }
      await new Promise((r) => this.tweens.add({ targets: view, x: tx, y: 560, scale: 0.6, duration: 380, onComplete: r }));
      view.destroy();
      if (!(await this.wait(150))) return false;
    }
    return true;
  }

  private finish() {
    this.clear();
    const acc = this.total ? this.right / this.total : 0;
    const next = nextLevel(this.level, acc);
    try {
      localStorage.setItem(KEY, JSON.stringify({ level: next }));
    } catch {
      /* private mode */
    }
    const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
    this.run?.end({ completed: true, stars, score: this.right, total: this.total, levelChange: next - this.level });
    this.run = undefined;
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setInteractive());
    this.keep(this.add.rectangle(W / 2, H / 2, 760, 440, 0xfffaf0).setStrokeStyle(8, 0x7a4a24));
    this.keep(this.add.text(W / 2, 190, 'Камбуз в порядке!', { fontFamily: FONT, fontSize: '50px', color: '#7a4a24' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) this.keep(this.add.star(W / 2 - 110 + i * 110, 290, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    this.keep(button(this, W / 2 - 170, 450, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    this.keep(button(this, W / 2 + 170, 450, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    this.layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    void this.talk(phrase('kettle.galley.end'));
  }
}
