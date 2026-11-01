import Phaser from 'phaser';
import { join, phrase, type PhraseId } from '../../core/phrases';
import { button, COLORS, FONT, H } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { MiniGameScene } from '../common/MiniGameScene';
import { run, type Cmd, type CourseMap, type Program } from './engine';
import { breakProgram, generateCourse } from './generator';

const CELL = 60;
const GX = 40;
const GY = 120;
const ARROW: Record<Cmd, string> = { F: '↑', L: '↶', R: '↷' };
const MAX_BLOCKS_UI = 8;

/**
 * Sea crossing between islands: build a program of arrows and run it.
 * Uses the algo skill and reports via GameState.completeCrossing.
 */
export class CourseScene extends MiniGameScene {
  private map!: CourseMap;
  private program: Program = [];
  private yacht!: Phaser.GameObjects.Container;
  private strip!: Phaser.GameObjects.Container;
  private running = false;
  private coinViews = new Map<string, Phaser.GameObjects.Image>();
  /** "Fix Klyaksa's route": the program is given with one wrong arrow; taps change arrows. */
  private debug = false;

  constructor() {
    super('Course');
  }

  protected override bubbleWidth = 250;

  protected itemId() {
    return this.map.itemId;
  }

  protected instruction() {
    if (this.debug) return phrase('course.debug');
    const parts = [phrase('course.go')];
    if (this.map.coins.length) parts.push(phrase('course.coins'));
    if (this.map.maxBlocks) parts.push(phrase('course.limit', { n: this.map.maxBlocks }));
    return join(...parts);
  }

  create() {
    this.map = generateCourse(this.task.level, this.rng);
    this.debug = this.task.variant === 'debug';
    this.program = this.debug ? breakProgram(this.map, this.rng) : [];
    this.running = false;
    this.coinViews.clear();
    this.add.image(640, 360, 'bg-sea').setDisplaySize(1280, 720);
    this.add
      .text(GX, 60, this.debug ? 'Почини маршрут' : 'Прокладка курса', { fontFamily: FONT, fontSize: '44px', color: '#ffffff', stroke: '#0b2233', strokeThickness: 6 })
      .setOrigin(0, 0.5);

    const m = this.map;
    this.add.rectangle(GX - 6, GY - 6, m.w * CELL + 10, m.h * CELL + 10, 0x0b2233, 0.6).setOrigin(0).setStrokeStyle(4, 0xffd166);
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++)
        this.add.rectangle(GX + x * CELL, GY + y * CELL, CELL - 2, CELL - 2, (x + y) % 2 ? 0x2f6fa3 : 0x3a7fb5).setOrigin(0);
    for (const r of m.reefs) this.add.image(GX + r.x * CELL + CELL / 2, GY + r.y * CELL + CELL / 2, 'reef').setDisplaySize(CELL - 4, CELL - 4);
    for (const c of m.coins) {
      this.coinViews.set(`${c.x},${c.y}`, this.add.image(GX + c.x * CELL + CELL / 2, GY + c.y * CELL + CELL / 2, 'coin').setDisplaySize(34, 34));
    }
    this.add.image(GX + m.goal.x * CELL + CELL / 2, GY + m.goal.y * CELL + CELL / 2, 'goal').setDisplaySize(CELL, CELL);
    // The top-view yacht art points east; turn it so angle 0 means "up" like the engine.
    const hull = this.add.image(0, 0, 'yacht-top').setDisplaySize(CELL + 8, CELL + 8).setAngle(-90);
    this.yacht = this.add.container(0, 0, [hull]);
    this.placeYacht(m.start.x, m.start.y, m.start.dir);

    // Palette.
    const px = GX + m.w * CELL + 50;
    if (!this.debug) {
      (['F', 'L', 'R'] as Cmd[]).forEach((c, i) =>
        button(this, px + 50 + i * 112, GY + 40, ARROW[c], () => this.add_(c), { w: 100, h: 96 }),
      );
    }
    if (this.debug) {
      this.add
        .text(px, GY + 40, 'Нажми на стрелку, чтобы поменять её: ↑ → ↶ → ↷', { fontFamily: FONT, fontSize: '26px', color: '#ffd166', wordWrap: { width: 360 } })
        .setOrigin(0, 0);
    } else if (m.allowRepeat) {
      this.add
        .text(px, GY + 110, 'Нажми на стрелку в курсе, чтобы повторить её ×2, ×3…', { fontFamily: FONT, fontSize: '22px', color: '#e9c46a', wordWrap: { width: 330 } })
        .setOrigin(0, 0);
    }
    this.strip = this.add.container(px, GY + 230);
    if (!this.debug) button(this, px + 110, H - 70, 'Стереть', () => this.clearProgram(), { w: 220, h: 80, color: 0x6c757d });
    button(this, px + 350, H - 70, 'В путь!', () => void this.go(), { w: 260, h: 80, color: COLORS.leaf });
    this.renderStrip();
    this.addParrot();
    this.say(this.instruction());
  }

  private placeYacht(x: number, y: number, dir: number) {
    this.yacht.setPosition(GX + x * CELL + CELL / 2, GY + y * CELL + CELL / 2).setAngle(dir * 90);
  }

  private add_(c: Cmd) {
    if (this.locked || this.running) return;
    if (this.program.length >= MAX_BLOCKS_UI) return;
    this.program.push({ cmd: c, times: 1 });
    this.renderStrip();
  }

  private clearProgram() {
    if (this.locked || this.running) return;
    this.program = [];
    this.placeYacht(this.map.start.x, this.map.start.y, this.map.start.dir);
    this.renderStrip();
  }

  /** Program as a strip of tiles, 4 per row. Tap: repeat ×N on L4+, otherwise remove. */
  private renderStrip(active = -1, bad = -1) {
    this.strip.removeAll(true);
    this.program.forEach((b, i) => {
      const x = (i % 4) * 92;
      const y = Math.floor(i / 4) * 100;
      const color = i === bad ? 0x9b2226 : i === active ? COLORS.leaf : COLORS.wood;
      const tile = this.add.rectangle(x, y, 84, 84, color).setOrigin(0).setStrokeStyle(4, 0x5c3317);
      const t = this.add.text(x + 42, y + 42, ARROW[b.cmd], { fontFamily: FONT, fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
      const items: Phaser.GameObjects.GameObject[] = [tile, t];
      if (b.times > 1) items.push(this.add.text(x + 80, y + 4, `×${b.times}`, { fontFamily: FONT, fontSize: '26px', color: '#fcbf49' }).setOrigin(1, 0));
      tile.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (this.locked || this.running) return;
        if (this.debug) {
          b.cmd = b.cmd === 'F' ? 'L' : b.cmd === 'L' ? 'R' : 'F';
        } else if (this.map.allowRepeat) {
          b.times = b.times >= 6 ? 1 : b.times + 1;
        } else {
          this.program.splice(i, 1);
        }
        this.renderStrip();
      });
      this.strip.add(items);
    });
    if (this.map.maxBlocks) {
      this.strip.add(
        this.add.text(0, -40, `Стрелок: ${this.program.length} из ${this.map.maxBlocks}`, { fontFamily: FONT, fontSize: '26px', color: this.program.length > this.map.maxBlocks ? '#ff6b6b' : '#ffffff' }),
      );
    }
  }

  private async go() {
    if (this.locked || this.running || this.program.length === 0) return;
    this.running = true;
    const res = run(this.map, this.program);
    for (const s of res.steps.slice(1)) {
      this.renderStrip(s.block);
      await this.tweenTo(s.x, s.y, s.dir);
      this.coinViews.get(`${s.x},${s.y}`)?.setVisible(false);
    }
    if (res.ok) {
      void this.finish();
      return;
    }
    if (res.reason === 'crash') {
      this.cameras.main.shake(200, 0.006);
      this.say(phrase('course.crash'));
    } else if (res.reason === 'too_long') {
      this.say(phrase('course.toolong', { n: this.map.maxBlocks ?? 0 }));
    } else if (res.reason === 'coins_left') {
      this.say(phrase('course.coinsleft'));
    } else {
      this.say(phrase(this.debug ? 'course.short.debug' : 'course.short'));
    }
    this.renderStrip(-1, res.ok ? -1 : res.block);
    this.time.delayedCall(1200, () => {
      this.placeYacht(this.map.start.x, this.map.start.y, this.map.start.dir);
      this.coinViews.forEach((v) => v.setVisible(true));
      this.running = false;
      this.wrong();
    });
  }

  private tweenTo(x: number, y: number, dir: number) {
    return new Promise<void>((resolve) => {
      // Shortest rotation so the yacht doesn't spin all the way round.
      let target = dir * 90;
      while (target - this.yacht.angle > 180) target -= 360;
      while (target - this.yacht.angle < -180) target += 360;
      this.tweens.add({
        targets: this.yacht,
        x: GX + x * CELL + CELL / 2,
        y: GY + y * CELL + CELL / 2,
        angle: target,
        duration: 320,
        onComplete: () => resolve(),
      });
    });
  }

  protected showHint(step: HintStep) {
    const sol = this.map.solution;
    if (step === 1) {
      this.say(this.instruction());
    } else if (step === 2) {
      this.say(phrase(`course.dir.${this.map.start.dir}` as PhraseId));
    } else if (step === 3 && this.debug) {
      const bad = this.program.findIndex((b, i) => b.cmd !== sol[i]?.cmd);
      this.say(phrase('course.blink'));
      this.renderStrip(-1, bad);
    } else if (step === 3) {
      const b = sol[0]!;
      const first = phrase(`course.first.${b.cmd}` as PhraseId);
      const times = b.times % 10 >= 2 && b.times % 10 <= 4 && (b.times < 12 || b.times > 14) ? 'course.repeat.few' : 'course.repeat.many';
      this.say(b.times > 1 ? join(first, phrase(times, { n: b.times })) : first);
      this.program = [{ ...b }];
      this.renderStrip();
    } else {
      this.locked = true;
      this.say(phrase('course.solution'));
      this.program = sol.map((b) => ({ ...b }));
      this.renderStrip();
      const res = run(this.map, this.program);
      const play = async () => {
        for (const s of res.steps.slice(1)) {
          this.renderStrip(s.block);
          await this.tweenTo(s.x, s.y, s.dir);
        }
        void this.finish();
      };
      void play();
    }
  }

  /** Crossing reports to the algo skill, not to the island's task list. */
  protected override async report() {
    await this.state.completeCrossing(this.attempt.outcome(), this.itemId(), this.attempt.hintsUsed, Date.now() - this.attempt.startedAt);
  }
}
