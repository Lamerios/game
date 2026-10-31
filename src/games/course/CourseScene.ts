import Phaser from 'phaser';
import { blocks, button, COLORS, FONT, H, YACHT, YACHT_PALETTE } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { MiniGameScene } from '../common/MiniGameScene';
import { run, type Cmd, type CourseMap, type Program } from './engine';
import { generateCourse } from './generator';

const CELL = 60;
const GX = 40;
const GY = 120;
const ARROW: Record<Cmd, string> = { F: '↑', L: '↶', R: '↷' };
const SAY: Record<Cmd, string> = { F: 'вперёд', L: 'налево', R: 'направо' };
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
  private coinViews = new Map<string, Phaser.GameObjects.Rectangle>();

  constructor() {
    super('Course');
  }

  protected override bubbleWidth = 250;

  protected itemId() {
    return this.map.itemId;
  }

  protected instruction() {
    const extra = this.map.coins.length ? ' Собери все монеты по пути.' : '';
    const limit = this.map.maxBlocks ? ` Можно не больше ${this.map.maxBlocks} стрелок — используй повтор.` : '';
    return `Проложи курс до флага. Собери стрелки и нажми «В путь!».${extra}${limit}`;
  }

  create() {
    this.map = generateCourse(this.task.level, this.rng);
    this.program = [];
    this.running = false;
    this.coinViews.clear();
    this.cameras.main.setBackgroundColor(COLORS.night);
    this.add.text(GX, 60, 'Прокладка курса', { fontFamily: FONT, fontSize: '44px', color: '#ffffff' }).setOrigin(0, 0.5);

    const m = this.map;
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++)
        this.add.rectangle(GX + x * CELL, GY + y * CELL, CELL - 2, CELL - 2, COLORS.sea).setOrigin(0);
    for (const r of m.reefs) this.add.rectangle(GX + r.x * CELL + 6, GY + r.y * CELL + 6, CELL - 14, CELL - 14, 0x6c757d).setOrigin(0);
    for (const c of m.coins) {
      this.coinViews.set(`${c.x},${c.y}`, this.add.rectangle(GX + c.x * CELL + CELL / 2, GY + c.y * CELL + CELL / 2, 22, 22, 0xfcbf49));
    }
    // Goal flag.
    blocks(this, GX + m.goal.x * CELL + 14, GY + m.goal.y * CELL + 8, ['RRR.', 'RRRR', 'RRR.', 'P...', 'P...', 'P...'], 8, { R: 0xd62828, P: 0xffffff });
    // Bow marker so the child always sees which way "forward" is.
    const bow = this.add.triangle(0, -28, 0, 10, 8, -4, 16, 10, 0xfcbf49).setOrigin(0.5);
    this.yacht = this.add.container(0, 0, [blocks(this, -27, -18, YACHT, 6, YACHT_PALETTE), bow]);
    this.placeYacht(m.start.x, m.start.y, m.start.dir);

    // Palette.
    const px = GX + m.w * CELL + 50;
    (['F', 'L', 'R'] as Cmd[]).forEach((c, i) =>
      button(this, px + 50 + i * 112, GY + 40, ARROW[c], () => this.add_(c), { w: 100, h: 96 }),
    );
    if (m.allowRepeat) {
      this.add
        .text(px, GY + 110, 'Нажми на стрелку в курсе, чтобы повторить её ×2, ×3…', { fontFamily: FONT, fontSize: '22px', color: '#e9c46a', wordWrap: { width: 330 } })
        .setOrigin(0, 0);
    }
    this.strip = this.add.container(px, GY + 230);
    button(this, px + 110, H - 70, 'Стереть', () => this.clearProgram(), { w: 220, h: 80, color: 0x6c757d });
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
        if (this.map.allowRepeat) {
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
      this.say('Риф! Яхта остановилась. Посмотри на красную стрелку.');
    } else if (res.reason === 'too_long') {
      this.say(`Слишком много стрелок. Можно ${this.map.maxBlocks}. Нажми на стрелку, чтобы повторить её.`);
    } else if (res.reason === 'coins_left') {
      this.say('Не все монеты собраны.');
    } else {
      this.say('Яхта не дошла до флага. Что добавить?');
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
      const dirName = ['вверх', 'вправо', 'вниз', 'влево'][this.map.start.dir];
      this.say(`Яхта смотрит ${dirName}. Повернись к флагу и плыви вперёд.`);
    } else if (step === 3) {
      const b = sol[0]!;
      this.say(`Первая стрелка: ${SAY[b.cmd]}${b.times > 1 ? `, повторить ${b.times} раза` : ''}.`);
      this.program = [{ ...b }];
      this.renderStrip();
    } else {
      this.locked = true;
      this.say('Смотри, вот курс до флага.');
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
