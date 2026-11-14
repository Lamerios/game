import Phaser from 'phaser';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, ENGLISH, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import { recordWord } from '../../core/wordLog';
import { button, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { DECK_BG, YUNGA } from './art';
import {
  bodyLine, dirLine, expected, freshProgress, isRight, LEVELS, parseProgress, planGame, recordGame, starsFor, STORM_LINE,
  type Dir, type Flag, type Progress, type Step,
} from './logic';

const PROGRESS_KEY = 'inverse-progress';
const GAME = 'inverse';
const RED_WAIT_MS = 2600;
const JUNG_X = 720;
const JUNG_Y = 362;

const toUri = (s: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s)))}`;

function readProgress(): Progress {
  try {
    return parseProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null'));
  } catch {
    return freshProgress();
  }
}
function writeProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

const ARROW_ANGLE: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

/**
 * «Наоборот, юнга!»: walrus captain Plombir shouts English commands; the flag on
 * the mast says whether to obey (white), do the opposite (black) or freeze (red).
 * Rules and research notes are in logic.ts. Keyboard arrows or the on-screen pad.
 */
export class InverseScene extends Phaser.Scene {
  private rng!: Rng;
  private progress!: Progress;
  private steps: Step[] = [];
  private run?: Run;
  private right = 0;
  private scored = 0;
  private talkToken = 0;
  private waiter?: (d: Dir | 'done') => void;
  private flagBox!: Phaser.GameObjects.Container;
  private jung!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Container;
  private pad = new Map<Dir, Phaser.GameObjects.Container>();
  private dots: Phaser.GameObjects.Arc[] = [];
  private doneBtn?: Phaser.GameObjects.Container;
  private said = new Set<string>();
  private streak = 0;

  constructor() {
    super('Inverse');
  }

  preload() {
    if (!this.textures.exists('inverse-yunga')) this.load.svg('inverse-yunga', toUri(YUNGA), { scale: 2 });
    if (!this.textures.exists('inverse-deck')) this.load.svg('inverse-deck', toUri(DECK_BG));
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.progress = readProgress();
    this.steps = planGame(this.progress.level, this.rng);
    this.right = 0;
    this.scored = 0;
    this.said = new Set();
    this.streak = 0;
    this.pad = new Map();
    this.dots = [];
    this.waiter = undefined;

    this.add.image(W / 2, H / 2, 'inverse-deck').setDisplaySize(W, H);
    this.drawMast();
    const captain = this.add.image(400, 370, 'char-walrus').setDisplaySize(210, 210);
    this.tweens.add({ targets: captain, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.easeInOut' });
    this.bubble = this.add.container(540, 196).setDepth(6).setVisible(false);
    this.jung = this.add.image(JUNG_X, JUNG_Y, 'inverse-yunga').setDisplaySize(170, 221).setDepth(5);
    const rumb = this.add.image(560, 430, 'char-rumb').setDisplaySize(96, 96).setDepth(4);
    this.tweens.add({ targets: rumb, y: 424, yoyo: true, repeat: -1, duration: 900 });

    this.add
      .text(40, 690, `Уровень ${this.progress.level}`, { fontFamily: FONT, fontSize: '26px', color: '#fff', stroke: '#3d2b1f', strokeThickness: 6 })
      .setOrigin(0, 1);
    const real = this.steps.filter((s) => s.kind === 'dir').length;
    for (let i = 0; i < real; i++) {
      this.dots.push(this.add.circle(480 + i * 36, 40, 13, 0xffffff, 0.45).setStrokeStyle(3, 0x3d2b1f, 0.7));
    }
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.drawPad();
    this.bindKeys();

    this.run = startRun(GAME, { level: this.progress.level, games: this.progress.games });
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false });
    });
    // After create(): the scene only counts as active once create() has returned.
    this.time.delayedCall(0, () => void this.play());
  }

  private leave() {
    this.run?.end({ completed: false, score: this.right });
    goHome(this);
  }

  // ---------- drawing ----------

  private drawMast() {
    const g = this.add.graphics();
    g.fillStyle(0x7a4a24).fillRect(150, 50, 22, 430);
    g.lineStyle(5, 0x2b2d42).strokeRect(150, 50, 22, 430);
    g.fillStyle(0xffd166).fillCircle(161, 46, 14).lineStyle(4, 0x2b2d42).strokeCircle(161, 46, 14);
    g.lineStyle(3, 0x3d2b1f, 0.7).lineBetween(172, 70, 300, 470).lineBetween(150, 70, 30, 470);
    this.flagBox = this.add.container(172, 70).setDepth(3);
    this.tweens.add({ targets: this.flagBox, scaleX: { from: 1, to: 0.9 }, yoyo: true, repeat: -1, duration: 650, ease: 'Sine.easeInOut' });
  }

  private setFlag(flag: Flag | 'unknown') {
    this.flagBox.removeAll(true);
    const fill = flag === 'white' ? 0xffffff : flag === 'black' ? 0x1b1b1b : flag === 'red' ? 0xe63946 : 0xadb5bd;
    const cloth = this.add.graphics();
    cloth.fillStyle(fill).beginPath().moveTo(0, 0).lineTo(200, 10).lineTo(190, 70).lineTo(200, 130).lineTo(0, 124).closePath().fillPath();
    cloth.lineStyle(5, 0x2b2d42).strokePath();
    this.flagBox.add(cloth);
    if (flag === 'black') {
      // Skull and crossbones: the pirate flag reads as "the other way round".
      const s = this.add.graphics();
      s.lineStyle(12, 0xffffff).lineBetween(60, 30, 140, 100).lineBetween(140, 30, 60, 100);
      s.fillStyle(0xffffff).fillCircle(100, 56, 28).fillRect(86, 70, 28, 20);
      s.fillStyle(0x1b1b1b).fillCircle(90, 54, 7).fillCircle(110, 54, 7);
      this.flagBox.add(s);
      this.flagBox.add(this.add.text(100, 150, 'НАОБОРОТ', { fontFamily: FONT, fontSize: '26px', color: '#fff', backgroundColor: '#1b1b1b', padding: { x: 8, y: 2 } }).setOrigin(0.5, 0));
    } else if (flag === 'red') {
      const s = this.add.graphics();
      s.fillStyle(0xffffff).fillCircle(100, 64, 38);
      s.fillStyle(0xe63946).fillRect(70, 56, 60, 16);
      this.flagBox.add(s);
      this.flagBox.add(this.add.text(100, 150, 'СТОП', { fontFamily: FONT, fontSize: '26px', color: '#fff', backgroundColor: '#c1121f', padding: { x: 8, y: 2 } }).setOrigin(0.5, 0));
    } else if (flag === 'white') {
      this.flagBox.add(this.add.text(100, 150, 'КАК СКАЗАНО', { fontFamily: FONT, fontSize: '26px', color: '#1b4965', backgroundColor: '#ffffff', padding: { x: 8, y: 2 } }).setOrigin(0.5, 0));
    } else {
      this.flagBox.add(this.add.text(100, 64, '?', { fontFamily: FONT, fontSize: '80px', color: '#fff', stroke: '#2b2d42', strokeThickness: 8 }).setOrigin(0.5));
    }
    this.tweens.add({ targets: this.flagBox, y: { from: 110, to: 70 }, duration: 260, ease: 'Back.easeOut' });
  }

  private showBubble(text?: string) {
    this.bubble.removeAll(true);
    if (!text) {
      this.bubble.setVisible(false);
      return;
    }
    const t = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: text.length > 12 ? '40px' : '58px', color: '#1b4965', fontStyle: 'bold' }).setOrigin(0.5);
    const bg = this.add.graphics();
    const w = t.width + 50;
    const h = t.height + 30;
    bg.fillStyle(0xffffff).fillRoundedRect(-w / 2, -h / 2, w, h, 24).lineStyle(5, 0x2b2d42).strokeRoundedRect(-w / 2, -h / 2, w, h, 24);
    bg.fillStyle(0xffffff).fillTriangle(-20, h / 2 - 3, 20, h / 2 - 3, -30, h / 2 + 34);
    bg.lineStyle(5, 0x2b2d42).lineBetween(-20, h / 2, -30, h / 2 + 34).lineBetween(20, h / 2, -30, h / 2 + 34);
    this.bubble.add([bg, t]).setVisible(true).setScale(0.6);
    this.tweens.add({ targets: this.bubble, scale: 1, duration: 220, ease: 'Back.easeOut' });
  }

  private drawPad() {
    const cx = 1100;
    const cy = 440;
    const at: Record<Dir, [number, number]> = { up: [cx, cy - 116], down: [cx, cy + 116], left: [cx - 116, cy], right: [cx + 116, cy] };
    this.add.circle(cx, cy, 40, 0x3d2b1f, 0.35);
    for (const d of Object.keys(at) as Dir[]) {
      const [x, y] = at[d];
      const bg = this.add.circle(0, 0, 56, 0xffd166).setStrokeStyle(6, 0x5c3317);
      const tri = this.add.triangle(0, -4, 0, 36, 22, 0, 44, 36, 0x5c3317).setAngle(ARROW_ANGLE[d]);
      const c = this.add.container(x, y, [bg, tri]).setSize(120, 120).setInteractive({ useHandCursor: true }).setDepth(5);
      c.on('pointerdown', () => {
        c.setScale(0.9);
        this.press(d);
      });
      c.on('pointerup', () => c.setScale(1));
      c.on('pointerout', () => c.setScale(1));
      this.pad.set(d, c);
    }
  }

  private bindKeys() {
    const keys: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const d = keys[e.code];
      if (d) {
        e.preventDefault();
        this.press(d);
        const c = this.pad.get(d);
        if (c) this.tweens.add({ targets: c, scale: 0.9, yoyo: true, duration: 90 });
      } else if ((e.code === 'Space' || e.code === 'Enter') && this.doneBtn) {
        this.waiter?.('done');
      }
    });
  }

  private press(d: Dir) {
    this.waiter?.(d);
  }

  // ---------- flow ----------

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

  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }

  /** Says a rule line the first time it matters in this game. */
  private async once(key: string, id: PhraseId) {
    if (this.said.has(key)) return true;
    this.said.add(key);
    return this.talk(phrase(id));
  }

  /** Resolves with the first press, or null when `ms` passes first. */
  private waitInput(ms?: number, accept: 'dir' | 'done' = 'dir'): Promise<{ got: Dir | 'done' | null; ms: number }> {
    const t0 = Date.now();
    return new Promise((resolve) => {
      let timer: Phaser.Time.TimerEvent | undefined;
      const finish = (got: Dir | 'done' | null) => {
        this.waiter = undefined;
        timer?.remove();
        resolve({ got, ms: Date.now() - t0 });
      };
      this.waiter = (d) => {
        if (accept === 'done' ? d === 'done' : d !== 'done') finish(d);
      };
      if (ms) timer = this.time.delayedCall(ms, () => finish(null));
    });
  }

  private async play() {
    const first = this.progress.games === 0;
    if (!(await this.talk(phrase(first ? 'rumb.inverse.hello' : 'rumb.inverse.again')))) return;
    const spec = LEVELS[this.progress.level]!;
    let dirIndex = 0;
    let prevFlag: Flag | undefined;
    for (const step of this.steps) {
      if (!this.sys.isActive()) return;
      if (step.kind === 'body') {
        if (!(await this.bodyStep(step.body))) return;
        continue;
      }
      if (step.kind === 'storm') {
        if (!(await this.storm())) return;
        continue;
      }
      // Rule reminders the first time each flag (and the mixing) comes up.
      if (step.flag === 'white' && !(await this.once('white', 'rumb.inverse.white'))) return;
      if (step.flag === 'black' && !(await this.once('black', 'rumb.inverse.black'))) return;
      if (step.flag === 'red' && !(await this.once('red', 'rumb.inverse.red'))) return;
      if (dirIndex === spec.warmup + spec.blackOnly && dirIndex > 0 && !(await this.once('mixed', 'rumb.inverse.mixed'))) return;
      if (step.late && !(await this.once('late', 'rumb.inverse.late'))) return;
      if (prevFlag && prevFlag !== step.flag) this.run?.event('rule_switch', { from: prevFlag, to: step.flag, index: dirIndex });
      prevFlag = step.flag;
      if (!(await this.dirStep(step, dirIndex))) return;
      dirIndex++;
    }
    this.finishGame();
  }

  private async dirStep(step: Extract<Step, { kind: 'dir' }>, index: number): Promise<boolean> {
    this.setFlag(step.late ? 'unknown' : step.flag);
    await this.wait(step.late ? 300 : 700);
    if (!this.sys.isActive()) return false;
    const cmd = dirLine(step.dir);
    this.showBubble(ENGLISH[cmd]);
    voice.say(english(cmd));
    if (step.late) {
      await voice.idle(3000);
      this.setFlag(step.flag);
    }
    const limit = step.flag === 'red' ? RED_WAIT_MS : step.limitMs;
    let input = await this.waitInput(limit);
    // No time limit: say the command again now and then, until the child answers.
    let repeats = 0;
    while (input.got === null && step.flag !== 'red' && !step.limitMs && repeats < 3 && this.sys.isActive()) {
      repeats++;
      voice.say(english(cmd));
      input = await this.waitInput(7000);
    }
    if (!this.sys.isActive()) return false;
    const pressed = input.got === 'done' ? null : input.got;
    const ok = isRight(step, pressed);
    this.scored++;
    if (ok) this.right++;
    this.run?.answer({
      item: `${step.dir}-${step.flag}`,
      correct: ok,
      chosen: pressed ?? 'none',
      ms: input.ms,
      level: this.progress.level,
      skill: step.flag === 'white' ? 'listening' : step.flag === 'black' ? 'inhibition' : 'nogo',
      late: step.late,
      timedOut: input.got === null,
    });
    // The word itself is learnt only when it is obeyed as said.
    if (step.flag === 'white') recordWord(cmd, ok, GAME);
    this.dots[index]?.setFillStyle(ok ? 0xffd166 : 0xadb5bd, 1);
    this.showBubble();
    const want = expected(step.dir, step.flag);
    if (ok) {
      this.streak++;
      await this.moveJung(want);
      // Praise the effort that matters: resisting the trap, not speed.
      if (step.flag !== 'white' && this.streak % 3 === 0) {
        if (!(await this.talk(phrase(`rumb.inverse.good.${Math.floor(this.rng() * 4)}` as PhraseId)))) return false;
      }
      return true;
    }
    this.streak = 0;
    this.cameras.main.shake(160, 0.004);
    const tooSlow = input.got === null && step.flag !== 'red';
    const line: PhraseId = tooSlow ? 'rumb.inverse.slow' : `rumb.inverse.wrong.${step.flag}`;
    if (want) this.blinkArrow(want);
    if (!(await this.talk(phrase(line)))) return false;
    await this.moveJung(want);
    return true;
  }

  private blinkArrow(d: Dir) {
    const c = this.pad.get(d);
    if (!c) return;
    const bg = c.list[0] as Phaser.GameObjects.Arc;
    bg.setFillStyle(0x80ed99);
    this.tweens.add({ targets: c, scale: 1.18, yoyo: true, repeat: 3, duration: 200, onComplete: () => bg.setFillStyle(0xffd166) });
  }

  private moveJung(d: Dir | null): Promise<void> {
    return new Promise((resolve) => {
      const j = this.jung;
      this.tweens.killTweensOf(j);
      j.setPosition(JUNG_X, JUNG_Y).setScale(j.scaleX, j.scaleX).setAngle(0);
      const base = j.scaleX;
      const done = () => resolve();
      if (d === null) {
        // Frozen: a little stiff wobble.
        this.tweens.add({ targets: j, angle: { from: -3, to: 3 }, yoyo: true, repeat: 1, duration: 120, onComplete: done });
      } else if (d === 'left' || d === 'right') {
        const dx = d === 'left' ? -130 : 130;
        this.tweens.add({ targets: j, x: JUNG_X + dx, duration: 260, ease: 'Quad.easeOut', yoyo: true, hold: 200, onComplete: done });
      } else if (d === 'up') {
        this.tweens.add({ targets: j, y: JUNG_Y - 110, duration: 260, ease: 'Quad.easeOut', yoyo: true, hold: 100, onComplete: done });
      } else {
        this.tweens.add({ targets: j, scaleY: base * 0.7, y: JUNG_Y + 34, duration: 220, yoyo: true, hold: 260, onComplete: done });
      }
    });
  }

  private showDone(): Phaser.GameObjects.Container {
    this.doneBtn?.destroy();
    const b = button(this, JUNG_X, 640, 'Сделал!', () => this.waiter?.('done'), { w: 320, h: 96, color: 0x2a9d8f });
    b.setDepth(8).setAlpha(0);
    this.tweens.add({ targets: b, alpha: 1, duration: 250 });
    this.doneBtn = b;
    return b;
  }

  private hideDone() {
    this.doneBtn?.destroy();
    this.doneBtn = undefined;
  }

  /** Total physical response: do it in the room, then tap "Сделал!". The cabin boy shows how. */
  private async bodyStep(body: Extract<Step, { kind: 'body' }>['body']): Promise<boolean> {
    this.setFlag('white');
    if (!(await this.once('body', 'rumb.inverse.body'))) return false;
    const line = bodyLine(body);
    this.showBubble(ENGLISH[line]);
    if (!(await this.talk(english(line)))) return false;
    const j = this.jung;
    const base = j.scaleX;
    const anim: Record<string, Phaser.Types.Tweens.TweenBuilderConfig> = {
      jump: { targets: j, y: JUNG_Y - 120, yoyo: true, repeat: 2, duration: 280, ease: 'Quad.easeOut' },
      clap: { targets: j, scaleX: base * 0.9, yoyo: true, repeat: 5, duration: 120 },
      sit: { targets: j, scaleY: base * 0.65, y: JUNG_Y + 40, yoyo: true, hold: 700, duration: 300 },
      stand: { targets: j, scaleY: base * 1.08, y: JUNG_Y - 12, yoyo: true, hold: 500, duration: 300 },
      turn: { targets: j, scaleX: -base, yoyo: true, repeat: 1, duration: 300 },
      wave: { targets: j, angle: { from: -8, to: 8 }, yoyo: true, repeat: 4, duration: 160 },
    };
    this.tweens.add(anim[body]!);
    await this.wait(1200);
    this.showDone();
    const t0 = Date.now();
    const r = await this.waitInput(20000, 'done');
    this.hideDone();
    j.setScale(base).setAngle(0).setPosition(JUNG_X, JUNG_Y);
    this.showBubble();
    if (!this.sys.isActive()) return false;
    this.run?.answer({ item: `body-${body}`, correct: r.got === 'done', ms: Date.now() - t0, skill: 'tpr' });
    recordWord(line, r.got === 'done', GAME);
    return this.talk(phrase('rumb.inverse.done'));
  }

  /** Movement break in the middle of the game: the whole ship sways. */
  private async storm(): Promise<boolean> {
    this.setFlag('white');
    this.showBubble(ENGLISH[STORM_LINE]);
    if (!(await this.talk(english(STORM_LINE), phrase('rumb.inverse.storm')))) return false;
    const cam = this.cameras.main;
    const sway = this.tweens.add({ targets: cam, rotation: { from: -0.05, to: 0.05 }, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.run?.event('movement_break', { kind: 'storm' });
    await this.wait(7000);
    this.showDone();
    const r = await this.waitInput(15000, 'done');
    sway.stop();
    cam.setRotation(0);
    this.hideDone();
    this.showBubble();
    if (!this.sys.isActive()) return false;
    this.run?.event('movement_break_done', { tapped: r.got === 'done' });
    return true;
  }

  private finishGame() {
    const stars = starsFor(this.right, this.scored);
    const { progress, change } = recordGame(this.progress, this.right, this.scored);
    writeProgress(progress);
    this.run?.end({ completed: true, stars, score: this.right, total: this.scored, level: this.progress.level, levelChange: change });
    this.run = undefined;
    this.setFlag('white');

    const layer: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setInteractive(),
      this.add.rectangle(W / 2, H / 2, 820, 520, 0xfffaf0).setStrokeStyle(8, 0x1b4965),
      this.add.text(W / 2, 170, 'Служба окончена!', { fontFamily: FONT, fontSize: '50px', color: '#1b4965' }).setOrigin(0.5),
      this.add.text(W / 2, 330, `Верно: ${this.right} из ${this.scored}`, { fontFamily: FONT, fontSize: '36px', color: '#3d2b1f' }).setOrigin(0.5),
    ];
    for (let i = 0; i < 3; i++) {
      const s = this.add.star(W / 2 - 110 + i * 110, 250, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f);
      s.setScale(0);
      this.tweens.add({ targets: s, scale: 1, delay: 300 + i * 250, duration: 300, ease: 'Back.easeOut' });
      layer.push(s);
    }
    layer.push(button(this, W / 2 - 170, 470, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    layer.push(button(this, W / 2 + 170, 470, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    const lines = [phrase(`rumb.inverse.end.${stars}` as PhraseId)];
    if (change === 'up') lines.push(phrase('rumb.inverse.levelup'));
    if (change === 'down') lines.push(phrase('rumb.inverse.leveldown'));
    void this.talk(...lines);
  }
}
