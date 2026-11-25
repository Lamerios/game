import Phaser from 'phaser';
import { voice } from '../../core/audio';
import { english, ENGLISH, phrase } from '../../core/phrases';
import { finishGame, loadGame, saveGame, nextPrize, type Recorded } from '../../core/progress';
import { button, FONT, H, W } from '../../scenes/ui';
import { beep } from './beep';
import {
  COLLECTIONS, LEVELS, SKINS, skinById, skinLine, STARTER_SKIN, type Frame, type Skin, type StickerCollection,
} from './collections';

/**
 * Прогресс «как в гонке» на экране итогов любой мини-игры:
 *  - лесенка уровней со звёздами (как трассы гонки),
 *  - кнопка «Коллекция» и экран коллекции (как гараж),
 *  - торжественная выдача нового предмета за игру на три звезды.
 *
 * Игра вызывает showProgress() один раз, когда уже нарисовала свой экран итогов.
 */

const DEPTH = 30;
const PICTURE = (id: string) => `snake-${id}`;

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth;

export interface ShowProgressOptions {
  game: string;
  /** Уровень, на котором шла игра (0 — без уровней). */
  level: number;
  stars: number;
  /** Уровень на следующую игру, если игра его уже решила: он откроется и подсветится. */
  next?: number;
  /** Где нарисовать полоску (центр по y). По умолчанию у нижнего края. */
  y?: number;
}

/** Записывает итог и рисует полоску прогресса; новый предмет показывает отдельно. */
export function showProgress(scene: Phaser.Scene, o: ShowProgressOptions): Recorded & { bar: Phaser.GameObjects.Container } {
  const col = COLLECTIONS[o.game];
  const out = finishGame(o.game, { level: o.level, stars: o.stars }, col?.items ?? []);
  const y = o.y ?? H - 52;
  const max = LEVELS[o.game] ?? 0;
  const bar = scene.add.container(0, y).setDepth(DEPTH);
  bar.add(scene.add.rectangle(W / 2, 0, W - 40, 92, 0x0b2233, 0.82).setStrokeStyle(3, 0xffd166));
  const left = col ? W - 300 : W - 40;
  if (max > 0) drawLadder(scene, bar, out.progress.best, o.next ?? o.level, out.progress.peak, max, 40, left);
  else bar.add(scene.add.text(60, 0, `Игр сыграно: ${out.progress.played} · на три звезды: ${out.progress.perfect}`, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0, 0.5));
  if (col) {
    const owned = out.progress.prizes.length;
    const btn = button(scene, W - 160, 0, `${col.kind === 'skin' ? 'Шкурки' : 'Коллекция'} ${owned}/${col.items.length}`, () => openCollection(scene, o.game), { w: 250, h: 72, color: col.color });
    (btn.list[1] as Phaser.GameObjects.Text).setFontSize(28);
    bar.add(btn);
    if (!out.prize && nextPrize(out.progress, col.items)) {
      const hint = scene.add.text(W - 160, -60, `★★★ — ${col.kind === 'skin' ? 'новая шкурка' : 'новая наклейка'}`, { fontFamily: FONT, fontSize: '20px', color: '#ffd166', backgroundColor: '#0b2233cc', padding: { x: 10, y: 4 } }).setOrigin(0.5);
      bar.add(hint);
    }
  }
  if (out.prize) void revealPrize(scene, o.game, out.prize);
  return { ...out, bar };
}

/** Кружки уровней 1…max: со звёздами, уровень ребёнка подсвечен, выше самого высокого — замок. */
function drawLadder(scene: Phaser.Scene, bar: Phaser.GameObjects.Container, best: readonly number[], level: number, peak: number, max: number, x0: number, x1: number) {
  bar.add(scene.add.text(x0 + 20, -30, 'Уровни', { fontFamily: FONT, fontSize: '18px', color: '#adb5bd' }).setOrigin(0, 0.5));
  const step = Math.min(110, (x1 - x0 - 120) / max);
  for (let i = 1; i <= max; i++) {
    const x = x0 + 130 + (i - 1) * step;
    const open = i <= Math.max(peak, level);
    const here = i === level;
    bar.add(scene.add.circle(x, -8, here ? 26 : 21, open ? (here ? 0xffd166 : 0x2a9d8f) : 0x495057).setStrokeStyle(here ? 5 : 3, here ? 0xffffff : 0x0b2233));
    bar.add(scene.add.text(x, -8, open ? String(i) : '🔒', { fontFamily: FONT, fontSize: open ? '24px' : '18px', color: here ? '#0b2233' : '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
    const s = best[i - 1] ?? 0;
    for (let k = 0; k < 3; k++) bar.add(scene.add.star(x - 16 + k * 16, 28, 5, 3.5, 8, k < s ? 0xffd166 : 0x343a40).setStrokeStyle(1, 0x0b2233));
    if (i < max) bar.add(scene.add.rectangle(x + step / 2, -8, Math.max(0, step - 50), 4, open && i < Math.max(peak, level) ? 0x2a9d8f : 0x495057));
  }
}

// ---------- pictures ----------

function ensureTextures(scene: Phaser.Scene, ids: readonly string[]): Promise<void> {
  const missing = ids.filter((id) => !scene.textures.exists(PICTURE(id)));
  if (!missing.length) return Promise.resolve();
  return new Promise((resolve) => {
    for (const id of missing) scene.load.image(PICTURE(id), `${import.meta.env.BASE_URL}snake/${id}.webp`);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

const lighten = (c: number, t: number) => {
  const col = Phaser.Display.Color.IntegerToColor(c);
  const mix = (v: number) => Math.round(v + (255 - v) * t);
  return Phaser.Display.Color.GetColor(mix(col.red), mix(col.green), mix(col.blue));
};

/** Рамка наклейки нужной формы, size — сторона. */
function frameGraphics(scene: Phaser.Scene, frame: Frame, color: number, size: number, owned: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const r = size / 2;
  const main = owned ? color : 0x343a40;
  const inner = owned ? 0xfffaf0 : 0x495057;
  g.fillStyle(0x000000, 0.25);
  if (frame === 'plate' || frame === 'coin') g.fillCircle(4, 6, r);
  else g.fillRoundedRect(-r + 4, -r + 6, size, size, 14);
  switch (frame) {
    case 'stamp': {
      // A postage stamp: white paper with a scalloped edge and a coloured frame.
      g.fillStyle(owned ? 0xffffff : 0x6c757d).fillRect(-r, -r, size, size);
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const t = -r + (i * size) / n;
        g.fillStyle(owned ? 0xffffff : 0x6c757d);
        for (const [cx, cy] of [[t, -r], [t, r], [-r, t], [r, t]] as const) g.fillCircle(cx, cy, size / 22);
      }
      g.fillStyle(main).fillRect(-r + 10, -r + 10, size - 20, size - 20);
      g.fillStyle(inner).fillRect(-r + 16, -r + 16, size - 32, size - 32);
      break;
    }
    case 'plate':
      g.fillStyle(main).fillCircle(0, 0, r);
      g.fillStyle(lighten(main, 0.35)).fillCircle(0, 0, r - 8);
      g.fillStyle(inner).fillCircle(0, 0, r - 16);
      g.lineStyle(2, main, 0.5).strokeCircle(0, 0, r - 22);
      break;
    case 'coin':
      g.fillStyle(owned ? 0xb8860b : 0x343a40).fillCircle(0, 0, r);
      g.fillStyle(owned ? 0xffc300 : 0x495057).fillCircle(0, 0, r - 6);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        g.fillStyle(owned ? 0xffe066 : 0x6c757d).fillCircle(Math.cos(a) * (r - 10), Math.sin(a) * (r - 10), 2.5);
      }
      g.fillStyle(main).fillCircle(0, 0, r - 18);
      g.fillStyle(inner).fillCircle(0, 0, r - 24);
      break;
    case 'badge': {
      const hex = (rad: number) => Array.from({ length: 6 }, (_, i) => new Phaser.Math.Vector2(Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * rad, Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * rad));
      g.fillStyle(main).fillPoints(hex(r + 4), true);
      g.fillStyle(lighten(main, 0.4)).fillPoints(hex(r - 6), true);
      g.fillStyle(inner).fillPoints(hex(r - 14), true);
      break;
    }
    case 'card':
      g.fillStyle(main).fillRoundedRect(-r, -r, size, size, 18);
      g.fillStyle(lighten(main, 0.35)).fillRoundedRect(-r + 6, -r + 6, size - 12, size * 0.3, 12);
      g.fillStyle(inner).fillRoundedRect(-r + 12, -r + 12, size - 24, size - 24, 12);
      break;
  }
  if (owned) {
    // A little shine in the corner.
    g.fillStyle(0xffffff, 0.5).fillEllipse(-r * 0.45, -r * 0.55, r * 0.35, r * 0.14);
  }
  return g;
}

/** Наклейка со словом: рамка игры, картинка, подпись по-английски. */
export function drawSticker(scene: Phaser.Scene, col: StickerCollection, id: string, x: number, y: number, size: number, owned: boolean) {
  const c = scene.add.container(x, y);
  c.add(frameGraphics(scene, col.frame, col.color, size, owned));
  const img = scene.add.image(0, -4, PICTURE(id)).setDisplaySize(size * 0.58, size * 0.58);
  if (!owned) img.setTintFill(0x212529).setAlpha(0.85);
  c.add(img);
  return c;
}

/** Шуша в выбранной шкурке, свернувшаяся колечком (для коллекции). */
export function drawSkin(scene: Phaser.Scene, skin: Skin, x: number, y: number, size: number, owned: boolean) {
  const g = scene.add.graphics({ x, y });
  const n = 26;
  // A spiral from the tail (outside) to the head (in front, lower left).
  const pts = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const a = -Math.PI * 0.15 + t * Math.PI * 1.7;
    const rad = size * (0.2 + 0.12 * (1 - t));
    return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.75 };
  });
  const width = (i: number) => size * (0.035 + 0.045 * (i / (n - 1)));
  const tint = (c: number) => (owned ? c : 0x343a40);
  for (const [color, extra] of [[tint(skin.outline), 4], [tint(skin.body), 0]] as const) {
    pts.forEach((p, i) => g.fillStyle(color).fillCircle(p.x, p.y, width(i) + extra));
  }
  if (owned) {
    for (let i = 3; i < n - 2; i += 3) g.fillStyle(skin.id === 'rainbow' ? [0xf72585, 0xffd166, 0x80ed99, 0x4cc9f0][(i / 3) % 4]! : skin.pattern).fillCircle(pts[i]!.x, pts[i]!.y, width(i) * 0.5);
    const h = pts.at(-1)!;
    const r = width(n - 1) * 1.25;
    g.fillStyle(skin.outline).fillCircle(h.x, h.y, r + 4);
    g.fillStyle(skin.head).fillCircle(h.x, h.y, r);
    for (const s of [-1, 1]) {
      g.fillStyle(0xffffff).fillCircle(h.x + s * r * 0.45, h.y - r * 0.2, r * 0.36);
      g.fillStyle(0x1b263b).fillCircle(h.x + s * r * 0.45, h.y - r * 0.12, r * 0.18);
    }
    g.lineStyle(3, 0xe63946).lineBetween(h.x, h.y + r, h.x, h.y + r * 1.6);
  }
  return g;
}

// ---------- the collection screen ----------

/** Экран коллекции поверх игры: всё полученное, следующий предмет силуэтом. */
export function openCollection(scene: Phaser.Scene, game: string, onClose?: () => void) {
  const col = COLLECTIONS[game];
  if (!col) return;
  const objs: Obj[] = [];
  const k = <T extends Obj>(o: T) => {
    objs.push(o.setDepth(DEPTH + 10));
    return o;
  };
  const close = () => {
    objs.forEach((o) => o.destroy());
    onClose?.();
  };
  k(scene.add.rectangle(W / 2, H / 2, W, H, 0x0b2233, 1).setInteractive());
  k(scene.add.text(W / 2, 56, col.title, { fontFamily: FONT, fontSize: '52px', color: '#ffd166', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5));
  k(button(scene, W - 110, 56, 'Назад', close, { w: 180, h: 70, color: 0x6c757d }));
  const caption = k(scene.add.text(W / 2, H - 96, '', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', align: 'center' }).setOrigin(0.5));

  const draw = () => {
    const p = loadGame(game);
    const skins = col.kind === 'skin';
    const list = skins ? [STARTER_SKIN, ...col.items] : [...col.items];
    const owned = (id: string) => (skins && id === STARTER_SKIN) || p.prizes.includes(id);
    const next = nextPrize(p, col.items);
    const chosen = skinById(p.chosen).id;
    caption.setText(next ? `Игра на три звезды — и ${skins ? 'новая шкурка' : 'новая наклейка'}!` : 'Вся коллекция собрана!');
    const perRow = 5;
    const size = 150;
    list.forEach((id, i) => {
      const x = W / 2 - ((Math.min(perRow, list.length) - 1) * 220) / 2 + (i % perRow) * 220;
      const y = 210 + Math.floor(i / perRow) * 230;
      const have = owned(id);
      if (skins && have && id === chosen) k(scene.add.rectangle(x, y + 10, 200, 215, 0xffd166, 0.25).setStrokeStyle(4, 0xffd166));
      const view = skins
        ? k(drawSkin(scene, SKINS.find((s) => s.id === id)!, x, y, size, have))
        : k(drawSticker(scene, col, id, x, y, size, have));
      const label = have ? (skins ? skinById(id).name : (ENGLISH[id] ?? id)) : id === next ? 'следующая' : '?';
      k(scene.add.text(x, y + 98, label, { fontFamily: FONT, fontSize: '26px', color: have ? '#ffffff' : '#adb5bd', fontStyle: have ? 'bold' : 'normal' }).setOrigin(0.5));
      const hit = k(scene.add.zone(x, y + 10, 200, 215).setInteractive({ useHandCursor: true }));
      hit.on('pointerup', () => {
        if (!have) {
          caption.setText(id === next ? 'Эта — следующая. Сыграй на три звезды!' : 'Сначала получи предыдущие.');
          beep(scene, [300], 0.08);
          return;
        }
        scene.tweens.add({ targets: view, y: y - 14, yoyo: true, duration: 160 });
        beep(scene, [660, 880], 0.07);
        if (skins) {
          voice.say(english(skinLine(id)));
          if (id !== chosen) {
            saveGame(game, { ...loadGame(game), chosen: id });
            redraw();
          }
        } else voice.say(english(id));
      });
    });
  };
  let grid: Obj[] = [];
  const redraw = () => {
    grid.forEach((o) => o.destroy());
    const before = objs.length;
    draw();
    grid = objs.splice(before);
    objs.push(...grid);
  };
  if (col.kind === 'sticker') void ensureTextures(scene, col.items).then(() => scene.sys.isActive() && redraw());
  else redraw();
}

// ---------- a new prize ----------

/** Большая карточка нового предмета: вылетает, звучит слово по-английски, тап — закрыть. */
async function revealPrize(scene: Phaser.Scene, game: string, id: string) {
  const col = COLLECTIONS[game];
  if (!col) return;
  if (col.kind === 'sticker') await ensureTextures(scene, [id]);
  await voice.idle(8000);
  if (!scene.sys.isActive()) return;
  const objs: Obj[] = [];
  const k = <T extends Obj>(o: T) => {
    objs.push(o.setDepth(DEPTH + 20));
    return o;
  };
  k(scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive());
  const rays = k(scene.add.graphics({ x: W / 2, y: H / 2 - 10 }));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    rays.fillStyle(0xffd166, i % 2 ? 0.18 : 0.32).fillTriangle(0, 0, Math.cos(a) * 520, Math.sin(a) * 520, Math.cos(a + 0.2) * 520, Math.sin(a + 0.2) * 520);
  }
  scene.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
  const skin = col.kind === 'skin';
  k(scene.add.text(W / 2, 90, skin ? 'Новая шкурка для Шуши!' : `Новая наклейка: «${col.title}»`, { fontFamily: FONT, fontSize: '46px', color: '#ffffff', fontStyle: 'bold', stroke: '#0b2233', strokeThickness: 8 }).setOrigin(0.5));
  const view = k(skin ? drawSkin(scene, skinById(id), W / 2, H / 2 - 10, 300, true) : drawSticker(scene, col, id, W / 2, H / 2 - 10, 300, true));
  view.setScale(0.1).setAngle(-30);
  scene.tweens.add({ targets: view, scale: 1, angle: 0, duration: 700, ease: 'Back.easeOut' });
  k(scene.add.text(W / 2, H / 2 + 175, skin ? skinById(id).name : (ENGLISH[id] ?? id), { fontFamily: FONT, fontSize: '54px', color: '#ffd166', fontStyle: 'bold', stroke: '#0b2233', strokeThickness: 8 }).setOrigin(0.5));
  const close = () => objs.forEach((o) => o.destroy());
  k(button(scene, W / 2, H - 100, 'Ура!', close, { w: 260, h: 84, color: 0x2a9d8f }));
  for (let i = 0; i < 24; i++) {
    const s = k(scene.add.star(W / 2, H / 2, 5, 6, 14, [0xffd166, 0xffffff, 0x80ed99, 0xff8fab][i % 4]!));
    const a = (i / 24) * Math.PI * 2;
    scene.tweens.add({ targets: s, x: W / 2 + Math.cos(a) * 420, y: H / 2 + Math.sin(a) * 300, alpha: 0, angle: 360, duration: 1400, delay: 300 });
  }
  beep(scene, [523, 659, 784, 1046, 1318], 0.1);
  voice.say(phrase(skin ? 'rumb.prize.skin' : 'rumb.prize.new'));
  await voice.idle(6000);
  if (scene.sys.isActive() && objs[0]?.active) voice.say(english(skin ? skinLine(id) : id));
}
