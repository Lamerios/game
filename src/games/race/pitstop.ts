import Phaser from 'phaser';
import { voice } from '../../core/audio';
import { pushPadMode } from '../../core/input/pad';
import { english } from '../../core/phrases';
import { button, FONT, H, W } from '../../scenes/ui';
import type { Host } from './garage';
import { makeMaze, mazeSize, PUSHUPS, SQUATS, type Maze } from './logic';

type Dir = 'up' | 'right' | 'down' | 'left';
const STEP: Record<Dir, [number, number, number]> = { up: [0, -1, 0], right: [1, 0, 1], down: [0, 1, 2], left: [-1, 0, 3] };

/**
 * The garage after three crashes: ten squats, ten push-ups (the voice counts
 * each in English), then a maze: find the lost spare part and bring it to the
 * garage. The repair bar fills as each part is done.
 */
export async function runPitStop(host: Host, o: { run: number; plane: boolean; track: number; carKey: string }): Promise<boolean> {
  const sc = host.scene;
  const run = o.run;
  const items: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(g: T): T => {
    items.push(host.keep(g));
    (g as unknown as Phaser.GameObjects.Components.Depth).setDepth(3200);
    return g;
  };
  add(sc.add.rectangle(W / 2, H / 2, W, H, 0x14213d, 0.92).setInteractive());
  add(sc.add.text(W / 2, 50, o.plane ? 'Ангар' : 'Пит-стоп!', { fontFamily: FONT, fontSize: '56px', color: '#ffd166', fontStyle: 'bold' }).setOrigin(0.5));
  // repair bar: squats, push-ups, maze
  add(sc.add.rectangle(W / 2, 112, 800, 30, 0xffffff, 0.2).setStrokeStyle(4, 0xffffff));
  const bar = add(sc.add.rectangle(W / 2 - 400, 112, 0, 30, 0x38b000).setOrigin(0, 0.5));
  const total = SQUATS + PUSHUPS + 1;
  let done = 0;
  const progress = () => {
    done++;
    sc.tweens.add({ targets: bar, width: (800 * done) / total, duration: 200 });
  };
  const car = add(sc.add.image(220, 400, o.carKey).setScale(o.plane ? 0.6 : 0.65));
  const rac = add(sc.add.image(110, 520, 'char-raccoon').setDisplaySize(170, 170));
  const wr = add(sc.add.image(190, 470, 'race-wrench').setDisplaySize(80, 80));
  sc.tweens.add({ targets: wr, angle: { from: -30, to: 30 }, yoyo: true, repeat: -1, duration: 260 });
  sc.tweens.add({ targets: car, y: 392, yoyo: true, repeat: -1, duration: 200 });
  host.setRaccoon(rac, add(sc.add.text(W / 2, 168, '', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 12, y: 6 }, align: 'center', wordWrap: { width: 1000 } }).setOrigin(0.5).setVisible(false)));

  const exercise = async (count: number, label: string, intro: string[], tenLine: string) => {
    const stage: Phaser.GameObjects.GameObject[] = [];
    const st = <T extends Phaser.GameObjects.GameObject>(g: T) => {
      stage.push(add(g));
      return g;
    };
    let n = 0;
    let last = 0;
    let ready = false;
    const circles = Array.from({ length: count }, (_, i) => st(sc.add.circle(640 + (i % 5) * 104, 270 + Math.floor(i / 5) * 104, 40, 0xffffff, 0.15).setStrokeStyle(4, 0xffffff)));
    const nums = circles.map((c, i) => st(sc.add.text(c.x, c.y, String(i + 1), { fontFamily: FONT, fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.4)));
    let finish!: () => void;
    const finished = new Promise<void>((r) => (finish = r));
    const tap = () => {
      if (!ready || n >= count || sc.time.now - last < 1200) return;
      last = sc.time.now;
      n++;
      circles[n - 1]!.setFillStyle(0x38b000, 1);
      nums[n - 1]!.setAlpha(1);
      sc.tweens.add({ targets: [circles[n - 1], nums[n - 1]], scale: { from: 1.4, to: 1 }, duration: 300, ease: 'Back.easeOut' });
      host.beep([440 + n * 40], 0.1);
      voice.say(english(`n${n}`));
      progress();
      if (n === count) void host.wait(900, run).then(finish);
    };
    st(button(sc, 900, 560, label, tap, { w: 420, h: 110, color: 0x38b000 }));
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') tap();
    };
    sc.input.keyboard?.on('keydown', onKey);
    if (!(await host.talk(...intro.map((id) => host.ru(id))))) return false;
    ready = true;
    await finished;
    sc.input.keyboard?.off('keydown', onKey);
    if (!host.alive(run)) return false;
    if (!(await host.talk(host.ru(tenLine)))) return false;
    stage.forEach((g) => g.destroy());
    return true;
  };

  if (!(await exercise(SQUATS, 'Присел!', [o.plane ? 'raccoon.race.pit.plane' : 'raccoon.race.pit.0', 'raccoon.race.pit.1'], 'raccoon.race.pit.ten'))) return false;
  if (!(await exercise(PUSHUPS, 'Отжался!', ['raccoon.race.pit.push'], 'raccoon.race.pit.push.ten'))) return false;
  if (!(await maze(host, run, add, o.track, o.carKey, o.plane))) return false;
  progress();
  host.beep([523, 784, 1046], 0.12);
  if (!(await host.talk(host.ru('raccoon.race.pit.done')))) return false;
  await new Promise<void>((r) => {
    const go = add(button(sc, 900, 620, o.plane ? 'Полетели!' : 'Поехали!', () => r(), { w: 420, h: 110, color: 0xe63946 }));
    sc.tweens.add({ targets: go, scale: 1.08, yoyo: true, repeat: -1, duration: 400 });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        sc.input.keyboard?.off('keydown', onKey);
        r();
      }
    };
    sc.input.keyboard?.on('keydown', onKey);
  });
  items.forEach((g) => g.destroy());
  return host.alive(run);
}

/** Find the spare part, then drive to the garage. Arrows, swipes, the pad or a tap on the next cell. */
async function maze(host: Host, run: number, add: <T extends Phaser.GameObjects.GameObject>(g: T) => T, track: number, carKey: string, plane: boolean): Promise<boolean> {
  const sc = host.scene;
  // Gamepad / TV remote: the arrows drive the car through the maze.
  const padDone = pushPadMode(sc, 'keys');
  const [cols, rows] = mazeSize(track);
  const m: Maze = makeMaze(cols, rows, host.rng);
  if (import.meta.env.DEV) (window as unknown as { __maze?: Maze }).__maze = m;
  const cell = Math.min(76, Math.floor(560 / cols), Math.floor(380 / rows));
  const x0 = 880 - (cols * cell) / 2;
  const y0 = 170;
  const cx = (x: number) => x0 + x * cell + cell / 2;
  const cy = (y: number) => y0 + y * cell + cell / 2;
  const g = add(sc.add.graphics());
  g.fillStyle(0xfffaf0).fillRoundedRect(x0 - 10, y0 - 10, cols * cell + 20, rows * cell + 20, 14);
  g.lineStyle(7, 0x2b2d42);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const w = m.walls[y]![x]!;
    const L = x0 + x * cell;
    const T = y0 + y * cell;
    if (w[0]) g.lineBetween(L, T, L + cell, T);
    if (w[1]) g.lineBetween(L + cell, T, L + cell, T + cell);
    if (w[2]) g.lineBetween(L, T + cell, L + cell, T + cell);
    if (w[3]) g.lineBetween(L, T, L, T + cell);
  }
  add(sc.add.image(cx(m.exit.x), cy(m.exit.y), 'race-garage').setDisplaySize(cell * 0.85, cell * 0.75));
  const part = add(sc.add.image(cx(m.part.x), cy(m.part.y), 'race-part').setDisplaySize(cell * 0.7, cell * 0.7));
  sc.tweens.add({ targets: part, angle: 360, repeat: -1, duration: 3000 });
  const me = add(sc.add.image(cx(m.start.x), cy(m.start.y), carKey).setScale((cell * 0.9) / (plane ? 420 : 400)));
  let at = { ...m.start };
  let has = false;
  let ready = false;
  let told = false;
  let finish!: () => void;
  const finished = new Promise<void>((r) => (finish = r));
  const move = (d: Dir) => {
    if (!ready) return;
    const [dx, dy, w] = STEP[d];
    if (m.walls[at.y]![at.x]![w]) {
      host.beep([160], 0.08);
      sc.tweens.add({ targets: me, x: me.x + dx * 8, y: me.y + dy * 8, yoyo: true, duration: 70 });
      return;
    }
    at = { x: at.x + dx, y: at.y + dy };
    voice.say(english(`race.${d}`));
    sc.tweens.add({ targets: me, x: cx(at.x), y: cy(at.y), duration: 140 });
    me.setFlipX(d === 'left');
    if (!has && at.x === m.part.x && at.y === m.part.y) {
      has = true;
      host.beep([784, 1046], 0.08);
      sc.tweens.add({ targets: part, x: 120, y: 620, scale: part.scale * 1.4, duration: 500 });
      void host.talk(host.ru('raccoon.race.maze.got'));
    }
    if (at.x === m.exit.x && at.y === m.exit.y) {
      if (has) {
        ready = false;
        finish();
      } else if (!told) {
        told = true;
        void host.talk(host.ru('raccoon.race.maze.need'));
      }
    }
  };
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    const d = map[e.code];
    if (d) {
      e.preventDefault();
      move(d);
    }
  };
  sc.input.keyboard?.on('keydown', onKey);
  // pad on the left under the car
  const pad: Record<Dir, [number, number]> = { up: [400, 520], down: [400, 664], left: [328, 592], right: [472, 592] };
  for (const d of Object.keys(pad) as Dir[]) {
    const [x, y] = pad[d];
    const [dx, dy] = STEP[d];
    const bgc = sc.add.circle(0, 0, 38, 0xffd166).setStrokeStyle(5, 0x5c3317);
    const tri = sc.add.triangle(0, 0, 18, 0, 36, 30, 0, 30, 0x5c3317).setAngle(dx * 90 + (dy > 0 ? 180 : 0));
    const c = add(sc.add.container(x, y, [bgc, tri]).setSize(80, 80).setInteractive({ useHandCursor: true }));
    c.on('pointerdown', () => {
      c.setScale(0.9);
      move(d);
    });
    c.on('pointerup', () => c.setScale(1));
    c.on('pointerout', () => c.setScale(1));
  }
  // tap a cell next to the car, or swipe on the maze
  const zone = add(sc.add.zone(x0, y0, cols * cell, rows * cell).setOrigin(0).setInteractive());
  let start: { x: number; y: number } | undefined;
  zone.on('pointerdown', (p: Phaser.Input.Pointer) => (start = { x: p.x, y: p.y }));
  zone.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (!start) return;
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    start = undefined;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) return move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    const tx = Math.floor((p.x - x0) / cell) - at.x;
    const ty = Math.floor((p.y - y0) / cell) - at.y;
    if (Math.abs(tx) + Math.abs(ty) === 1) move(tx > 0 ? 'right' : tx < 0 ? 'left' : ty > 0 ? 'down' : 'up');
  });
  if (!(await host.talk(host.ru('raccoon.race.maze')))) {
    padDone();
    return false;
  }
  ready = true;
  await finished;
  sc.input.keyboard?.off('keydown', onKey);
  padDone();
  if (!host.alive(run)) return false;
  host.beep([523, 659, 784], 0.1);
  return true;
}

