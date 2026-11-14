import Phaser from 'phaser';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, join, phrase, type Utterance } from '../../core/phrases';
import { recordWord } from '../../core/wordLog';
import { button, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { LEVELS, nextLevel, numberWord, pae, planTargets, ROUNDS, verdict } from './logic';

const KEY = 'anchor-progress';
const LINE_Y = 300;
const X0 = 140;
const X1 = 1140;

function readLevel(): number {
  try {
    const v = Number(JSON.parse(localStorage.getItem(KEY) ?? '{}').level);
    return v >= 1 && v <= 4 ? v : 1;
  } catch {
    return 1;
  }
}
function writeLevel(level: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ level }));
  } catch {
    /* private mode */
  }
}

/** «Якорь»: drop the anchor at the named depth on a line with only its ends marked. */
export class AnchorScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  private targets: number[] = [];
  private round = 0;
  private errors: number[] = [];
  private run?: Run;
  private ship!: Phaser.GameObjects.Image;
  private marks: Phaser.GameObjects.GameObject[] = [];
  private accepting = false;
  private askedAt = 0;
  private talkToken = 0;

  constructor() {
    super('Anchor');
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.level = readLevel();
    this.targets = planTargets(this.level, this.rng);
    this.round = 0;
    this.errors = [];
    this.marks = [];
    this.accepting = false;

    this.add.image(W / 2, H / 2, 'bg-sea').setDisplaySize(W, H);
    this.drawLine();
    this.ship = this.add.image(X0, LINE_Y - 70, 'yacht-side').setDisplaySize(150, 138).setDepth(4);
    this.add.image(90, 640, 'char-rumb').setDisplaySize(120, 120);
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.add.text(40, 40, `Якорь · уровень ${this.level}`, { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#0b2233', strokeThickness: 6 }).setOrigin(0, 0.5);
    // Tap anywhere along the line.
    const zone = this.add.zone(X0 - 30, LINE_Y - 120, X1 - X0 + 60, 260).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', (p: Phaser.Input.Pointer) => this.drop(p.x));
    this.run = startRun('anchor', { level: this.level });
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false });
    });
    this.time.delayedCall(0, () => void this.start());
  }

  private leave() {
    this.run?.end({ completed: false });
    goHome(this);
  }

  private get max() {
    return LEVELS[this.level]!.max;
  }

  private xOf(v: number) {
    return X0 + (v / this.max) * (X1 - X0);
  }

  private drawLine() {
    const g = this.add.graphics();
    g.fillStyle(0xfff1d0, 0.92).fillRoundedRect(X0 - 50, LINE_Y - 30, X1 - X0 + 100, 60, 24).lineStyle(4, 0x3d2b1f).strokeRoundedRect(X0 - 50, LINE_Y - 30, X1 - X0 + 100, 60, 24);
    g.lineStyle(8, 0x1b4965).lineBetween(X0, LINE_Y, X1, LINE_Y);
    g.lineStyle(6, 0x1b4965).lineBetween(X0, LINE_Y - 22, X0, LINE_Y + 22).lineBetween(X1, LINE_Y - 22, X1, LINE_Y + 22);
    this.add.text(X0, LINE_Y + 48, '0', { fontFamily: FONT, fontSize: '40px', color: '#fff', stroke: '#0b2233', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(X1, LINE_Y + 48, String(this.max), { fontFamily: FONT, fontSize: '40px', color: '#fff', stroke: '#0b2233', strokeThickness: 6 }).setOrigin(0.5);
  }

  private async talk(...lines: Utterance[]): Promise<boolean> {
    const token = ++this.talkToken;
    for (const u of lines) {
      if (token !== this.talkToken) return false;
      voice.say(u);
      await voice.idle(8000);
      if (!this.sys.isActive()) return false;
    }
    return token === this.talkToken;
  }

  private async start() {
    const first = !localStorage.getItem(KEY);
    if (!(await this.talk(phrase(first ? 'rumb.anchor.hello' : 'rumb.anchor.again')))) return;
    void this.ask();
  }

  private target() {
    return this.targets[this.round]!;
  }

  private big?: Phaser.GameObjects.Text;

  private async ask() {
    this.marks.forEach((m) => m.destroy());
    this.marks = [];
    this.big?.destroy();
    const t = this.target();
    this.big = this.add.text(W / 2, 140, String(t), { fontFamily: FONT, fontSize: '96px', color: '#ffd166', stroke: '#0b2233', strokeThickness: 10 }).setOrigin(0.5);
    this.add.tween({ targets: this.big, scale: { from: 0.4, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    this.accepting = true;
    this.askedAt = Date.now();
    await this.talk(join(english('anchor.drop'), english(numberWord(t))));
  }

  private async drop(x: number) {
    if (!this.accepting) return;
    this.accepting = false;
    const cx = Phaser.Math.Clamp(x, X0, X1);
    const guess = ((cx - X0) / (X1 - X0)) * this.max;
    const t = this.target();
    const p = pae(t, guess, this.max);
    const v = verdict(p);
    this.errors.push(p);
    this.run?.answer({ item: `${t}/${this.max}`, correct: v !== 'far', guess: Math.round(guess * 10) / 10, pae: Math.round(p * 10) / 10, ms: Date.now() - this.askedAt, level: this.level, skill: 'number_line' });
    recordWord(numberWord(t), v !== 'far', 'anchor');
    // The ship sails there and drops the anchor.
    await new Promise((r) => this.tweens.add({ targets: this.ship, x: cx, duration: 600, ease: 'Sine.easeInOut', onComplete: r }));
    const chain = this.add.graphics().setDepth(3);
    chain.lineStyle(4, 0x3d2b1f).lineBetween(cx, LINE_Y - 20, cx, LINE_Y + 150);
    const anchor = this.add.graphics({ x: cx, y: LINE_Y + 175 }).setDepth(3);
    anchor.lineStyle(7, 0x3d2b1f).strokeCircle(0, -34, 9).lineBetween(0, -25, 0, 22).lineBetween(-16, -12, 16, -12);
    anchor.beginPath().arc(0, 0, 24, 0.2, Math.PI - 0.2).strokePath();
    this.marks.push(chain, anchor);
    // Then the truth: the right place with ticks to count by.
    const tx = this.xOf(t);
    const g = this.add.graphics().setDepth(5);
    const step = this.max <= 20 ? 1 : 10;
    for (let k = 0; k <= this.max; k += step) g.lineStyle(3, 0x1b4965, 0.8).lineBetween(this.xOf(k), LINE_Y - 14, this.xOf(k), LINE_Y + 14);
    g.fillStyle(0x2a9d8f).fillCircle(tx, LINE_Y, 16).lineStyle(4, 0xffffff).strokeCircle(tx, LINE_Y, 16);
    const label = this.add.text(tx, LINE_Y - 56, String(t), { fontFamily: FONT, fontSize: '36px', color: '#2a9d8f', backgroundColor: '#ffffff', padding: { x: 8, y: 2 } }).setOrigin(0.5).setDepth(6);
    this.marks.push(g, label);
    const lines: Utterance[] = [phrase(`rumb.anchor.${v}`)];
    if (v === 'far') lines.push(phrase(guess < t ? 'rumb.anchor.more' : 'rumb.anchor.less'));
    if (!(await this.talk(...lines))) return;
    await new Promise((r) => this.time.delayedCall(700, r));
    if (!this.sys.isActive()) return;
    this.round++;
    if (this.round >= ROUNDS) return this.finish();
    void this.ask();
  }

  private finish() {
    const mean = this.errors.reduce((a, b) => a + b, 0) / Math.max(1, this.errors.length);
    const next = nextLevel(this.level, mean);
    writeLevel(next);
    const good = this.errors.filter((p) => verdict(p) !== 'far').length;
    const stars = good >= ROUNDS - 1 ? 3 : good >= ROUNDS / 2 ? 2 : 1;
    this.run?.end({ completed: true, stars, score: good, meanPae: Math.round(mean * 10) / 10, levelChange: next - this.level });
    this.run = undefined;
    this.big?.destroy();
    const layer: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setInteractive(),
      this.add.rectangle(W / 2, H / 2, 760, 460, 0xfffaf0).setStrokeStyle(8, 0x1b4965),
      this.add.text(W / 2, 190, 'Якорь брошен!', { fontFamily: FONT, fontSize: '50px', color: '#1b4965' }).setOrigin(0.5),
      this.add.text(W / 2, 350, `Точно и близко: ${good} из ${ROUNDS}`, { fontFamily: FONT, fontSize: '34px', color: '#3d2b1f' }).setOrigin(0.5),
    ];
    for (let i = 0; i < 3; i++) layer.push(this.add.star(W / 2 - 110 + i * 110, 270, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    layer.push(button(this, W / 2 - 170, 470, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    layer.push(button(this, W / 2 + 170, 470, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    const lines = [phrase('rumb.anchor.end')];
    if (next > this.level) lines.push(phrase('rumb.anchor.levelup'));
    void this.talk(...lines);
  }
}
