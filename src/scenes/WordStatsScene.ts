import Phaser from 'phaser';
import { voice } from '../core/audio';
import { english, ENGLISH } from '../core/phrases';
import { loadStats, report, type Row, type Status } from '../core/wordStats';
import { preloadWordArt } from '../games/snake/SnakeScene';
import { WORDS } from '../games/snake/logic';
import { ruLabel } from '../core/wordLog';
import { button, FONT, H, W } from './ui';

const TOP = 196;
const ROW_H = 84;
const LIST_H = H - TOP - 12;

const STATUS: Record<Status, { label: string; color: number; text: string }> = {
  hard: { label: 'трудное', color: 0xe63946, text: '#ffffff' },
  learning: { label: 'учит', color: 0xffd166, text: '#3d2b1f' },
  learnt: { label: 'выучено', color: 0x43aa8b, text: '#ffffff' },
};

const ruOf = (id: string) => WORDS.find((w) => w.id === id)?.ru ?? ruLabel(id);
const enOf = (id: string) => ENGLISH[id] ?? id;

function ago(ts: number): string {
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / 86400000);
  return days <= 0 ? 'сегодня' : days === 1 ? 'вчера' : `${days} дн. назад`;
}

/**
 * For parents (behind the harbour's grown-up check): how the child does with
 * each English word. Hardest words first; drag or scroll the list; tap a row
 * to hear the word.
 */
export class WordStatsScene extends Phaser.Scene {
  /** The pointer moved since it went down: a drag, not a tap. */
  private moved = false;

  constructor() {
    super('WordStats');
  }

  preload() {
    preloadWordArt(this);
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0xfff1d0);
    this.add.text(40, 48, 'Английские слова: статистика', { fontFamily: FONT, fontSize: '40px', color: '#3d2b1f' }).setOrigin(0, 0.5);
    button(this, W - 120, 48, 'Назад', () => this.scene.start('Harbor'), { w: 200, h: 64, color: 0x6c757d });

    const r = report(loadStats());
    const pct = r.asked ? Math.round((100 * r.firstTry) / r.asked) : 0;
    const tiles: [string, string][] = [
      [String(r.rows.length), 'слов встречалось'],
      [String(r.learnt), 'выучено'],
      [String(r.hard), 'трудных'],
      [`${pct}%`, 'с первой попытки'],
    ];
    tiles.forEach(([big, small], i) => {
      const x = 40 + i * 305;
      this.add.rectangle(x, 92, 285, 84, 0xffffff).setOrigin(0).setStrokeStyle(3, 0x8d5524);
      this.add.text(x + 20, 134, big, { fontFamily: FONT, fontSize: '40px', color: '#1b4332', fontStyle: 'bold' }).setOrigin(0, 0.5);
      this.add.text(x + 115, 134, small, { fontFamily: FONT, fontSize: '22px', color: '#6c757d', wordWrap: { width: 160 } }).setOrigin(0, 0.5);
    });

    if (r.rows.length === 0) {
      this.add
        .text(W / 2, 420, 'Пока нет данных.\nСыграйте в «Змейку» — здесь появится,\nкакие слова получаются, а какие путаются.', {
          fontFamily: FONT, fontSize: '32px', color: '#3d2b1f', align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    const list = this.add.container(0, TOP);
    r.rows.forEach((row, i) => list.add(this.row(row, i)));
    const mask = this.make.graphics({}, false).fillRect(0, TOP, W, LIST_H);
    list.setMask(mask.createGeometryMask());

    // Scroll: mouse wheel or drag.
    const maxScroll = Math.max(0, r.rows.length * ROW_H - LIST_H);
    let scroll = 0;
    let dragFrom: number | undefined;
    const setScroll = (v: number) => {
      scroll = Phaser.Math.Clamp(v, 0, maxScroll);
      list.y = TOP - scroll;
    };
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => setScroll(scroll + dy));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y >= TOP) {
        dragFrom = p.y + scroll;
        this.moved = false;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragFrom === undefined || !p.isDown) return;
      if (Math.abs(dragFrom - scroll - p.y) > 8) this.moved = true;
      setScroll(dragFrom - p.y);
    });
    this.input.on('pointerup', () => (dragFrom = undefined));
    if (maxScroll > 0) {
      this.add.text(W - 40, H - 18, 'листайте ↕', { fontFamily: FONT, fontSize: '20px', color: '#8d5524' }).setOrigin(1, 1);
    }
  }

  private row(r: Row, i: number): Phaser.GameObjects.Container {
    const y = i * ROW_H;
    const s = r.stat;
    const st = STATUS[r.status];
    const c = this.add.container(0, y);
    c.add(this.add.rectangle(40, 4, W - 80, ROW_H - 8, i % 2 ? 0xfffaf0 : 0xffffff).setOrigin(0).setStrokeStyle(2, 0xe9c46a));
    const key = `snake-${r.id}`;
    if (this.textures.exists(key)) c.add(this.add.image(84, ROW_H / 2, key).setDisplaySize(64, 64));
    c.add(this.add.text(130, ROW_H / 2 - 14, enOf(r.id), { fontFamily: FONT, fontSize: '28px', color: '#1b4332', fontStyle: 'bold' }).setOrigin(0, 0.5));
    c.add(this.add.text(130, ROW_H / 2 + 18, ruOf(r.id), { fontFamily: FONT, fontSize: '20px', color: '#6c757d' }).setOrigin(0, 0.5));

    // First-try share as a bar.
    const bx = 390;
    const bw = 220;
    const color = r.accuracy >= 0.75 ? 0x43aa8b : r.accuracy >= 0.5 ? 0xffb703 : 0xe63946;
    c.add(this.add.rectangle(bx, ROW_H / 2 - 10, bw, 18, 0xe9ecef).setOrigin(0, 0.5));
    c.add(this.add.rectangle(bx, ROW_H / 2 - 10, Math.max(4, bw * r.accuracy), 18, color).setOrigin(0, 0.5));
    c.add(
      this.add
        .text(bx, ROW_H / 2 + 16, `${s.firstTry} из ${s.asked} с первой попытки`, { fontFamily: FONT, fontSize: '19px', color: '#3d2b1f' })
        .setOrigin(0, 0.5),
    );

    c.add(this.add.text(650, ROW_H / 2 - 12, `ошибок: ${s.misses}`, { fontFamily: FONT, fontSize: '22px', color: '#3d2b1f' }).setOrigin(0, 0.5));
    if (r.topConfusion) {
      const ru = ruOf(r.topConfusion);
      c.add(
        this.add
          .text(650, ROW_H / 2 + 16, `путает с: ${enOf(r.topConfusion)}${ru ? ` (${ru})` : ''}`, { fontFamily: FONT, fontSize: '19px', color: '#c1121f' })
          .setOrigin(0, 0.5),
      );
    }

    c.add(this.add.text(1000, ROW_H / 2, ago(s.last), { fontFamily: FONT, fontSize: '19px', color: '#6c757d' }).setOrigin(0, 0.5));
    c.add(this.add.rectangle(1170, ROW_H / 2, 120, 36, st.color).setStrokeStyle(2, 0x3d2b1f));
    c.add(this.add.text(1170, ROW_H / 2, st.label, { fontFamily: FONT, fontSize: '20px', color: st.text }).setOrigin(0.5));

    // Tap a row (not a drag) to hear the word.
    c.setSize(W - 80, ROW_H - 8);
    const hit = this.add.rectangle(40, 4, W - 80, ROW_H - 8, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.moved && p.y >= TOP && ENGLISH[r.id]) voice.say(english(r.id));
    });
    c.add(hit);
    return c;
  }
}
