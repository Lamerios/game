import Phaser from 'phaser';
import { english, type Utterance } from '../../core/phrases';
import { voice } from '../../core/audio';
import { button, FONT, H, W } from '../../scenes/ui';
import type { Rng } from '../common/rng';
import { goalLine, goalProgress, goalText, PLANES, planeLine } from '../flight/logic';
import { CARS, carLine, MAX_NITRO, nextCar, nitroPrice, type Car, type Progress } from './logic';

/** What the garage and the pit stop borrow from the race scene. */
export interface Host {
  scene: Phaser.Scene;
  rng: Rng;
  progress: () => Progress;
  setProgress: (p: Progress) => void;
  keep: <T extends Phaser.GameObjects.GameObject>(o: T) => T;
  talk: (...u: Utterance[]) => Promise<boolean>;
  ru: (id: string) => Utterance;
  beep: (f: number[], d?: number) => void;
  wait: (ms: number, run: number) => Promise<boolean>;
  alive: (run: number) => boolean;
  setRaccoon: (img?: Phaser.GameObjects.Image, sub?: Phaser.GameObjects.Text) => void;
}

const PILE_MAX = 30;

/**
 * The garage: every car (new ones come for a race without a mistake), the
 * coins earned for right words, and a nitro shop where the child pays by
 * counting out exactly the price, coin by coin, while the voice counts in English.
 * With `air` it is the flight game's hangar: every plane with its goal and how
 * far along it is.
 */
export function runGarage(host: Host, run: number, air = false): Promise<void> {
  const sc = host.scene;
  const k = <T extends Phaser.GameObjects.GameObject>(o: T) => host.keep(o);
  return new Promise<void>((done) => {
    const bg = k(sc.add.graphics());
    if (air) {
      // inside the hangar: arched roof beams, a window strip, a concrete floor with a yellow taxi line
      bg.fillGradientStyle(0x1d3557, 0x1d3557, 0x274c77, 0x274c77, 1).fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) bg.lineStyle(10, 0x14213d, 0.8).beginPath().arc(W / 2, 1100, 900 - i * 10, Math.PI * 1.1, Math.PI * 1.9).strokePath();
      for (let x = 40; x < W; x += 120) bg.fillStyle(0xa8dadc, 0.35).fillRect(x, 92, 80, 26);
      bg.fillStyle(0x495057).fillRect(0, 456, W, H - 456);
      bg.fillStyle(0xffd166).fillRect(0, 462, W, 6);
    } else {
      bg.fillGradientStyle(0x2b2d42, 0x2b2d42, 0x14213d, 0x14213d, 1).fillRect(0, 0, W, H);
      // garage floor stripes
      for (let i = 0; i < 20; i++) bg.fillStyle(0xffd166, 0.9).fillRect(i * 70, 448, 35, 10);
    }
    k(sc.add.text(air ? W / 2 : 850, 44, air ? 'Ангар' : 'Гараж', { fontFamily: FONT, fontSize: '56px', color: '#ffd166', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 10 }).setOrigin(0.5));
    k(button(sc, 1170, 46, 'Назад', () => done(), { w: 170, h: 64, color: 0x6c757d }));
    const rac = k(sc.add.image(80, 70, 'char-raccoon').setDisplaySize(120, 120));
    const sub = k(
      sc.add
        .text(W / 2, 440, '', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', backgroundColor: '#14213dcc', padding: { x: 14, y: 8 }, align: 'center', wordWrap: { width: 1100 } })
        .setOrigin(0.5)
        .setDepth(60)
        .setVisible(false),
    );
    host.setRaccoon(rac, sub);

    // ---- the cars (the race) or the planes with their goals (the flight game) ----
    let grid: Phaser.GameObjects.GameObject[] = [];
    const drawCars = () => {
      grid.forEach((o) => o.destroy());
      grid = [];
      const g = <T extends Phaser.GameObjects.GameObject>(o: T) => {
        grid.push(k(o));
        return o;
      };
      const p = host.progress();
      const list: readonly Car[] = CARS;
      const next = nextCar(p);
      const rings: Phaser.GameObjects.Rectangle[] = [];
      list.forEach((c, i) => {
        const x = 118 + (i % 6) * 209;
        const y = 175 + Math.floor(i / 6) * 150;
        const own = p.cars.includes(c.id);
        const ring = g(sc.add.rectangle(x, y, 196, 138, 0xffffff, c.id === p.car ? 0.9 : 0.1).setStrokeStyle(4, c.id === p.car ? 0xffd166 : 0x495057));
        rings[i] = ring;
        const img = g(sc.add.image(x, y - 4, `race-car-${c.id}`).setScale(0.38));
        if (!own) img.setTintFill(0x14213d).setAlpha(0.8);
        g(sc.add.text(x, y + 52, own ? c.name : c === next ? 'следующая' : '?', { fontFamily: FONT, fontSize: '20px', color: c.id === p.car ? '#14213d' : '#ffffff' }).setOrigin(0.5));
        ring.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          if (!own) {
            void host.talk(host.ru('raccoon.race.garage'));
            return;
          }
          host.setProgress({ ...host.progress(), car: c.id });
          list.forEach((cc, j) => rings[j]!.setFillStyle(0xffffff, cc.id === c.id ? 0.9 : 0.1).setStrokeStyle(4, cc.id === c.id ? 0xffd166 : 0x495057));
          host.beep([660, 880], 0.08);
          sc.tweens.add({ targets: img, y: img.y - 14, yoyo: true, duration: 180 });
          void host.talk(english(carLine(c.id)));
        });
      });
    };
    const drawPlanes = () => {
      const p = host.progress();
      const rings: Phaser.GameObjects.Rectangle[] = [];
      PLANES.forEach((c, i) => {
        const x = 130 + (i % 5) * 255;
        const y = 210 + Math.floor(i / 5) * 160;
        const own = p.planes.includes(c.id);
        const chosen = c.id === p.plane;
        const ring = k(sc.add.rectangle(x, y, 240, 150, 0xffffff, chosen ? 0.9 : own ? 0.16 : 0.06).setStrokeStyle(4, chosen ? 0xffd166 : own ? 0xadb5bd : 0x495057));
        rings[i] = ring;
        const img = k(sc.add.image(x, y - 20, `race-plane-${c.id}`).setScale(0.3));
        if (own) {
          k(sc.add.text(x, y + 52, c.name, { fontFamily: FONT, fontSize: '22px', color: chosen ? '#14213d' : '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
        } else {
          img.setTintFill(0x0b132b).setAlpha(0.75);
          // the goal and a progress bar under the dark plane
          const { have, need } = goalProgress(c.goal, p);
          k(sc.add.text(x, y + 30, goalText(c.goal), { fontFamily: FONT, fontSize: '17px', color: '#ffd166', align: 'center', wordWrap: { width: 228 } }).setOrigin(0.5));
          k(sc.add.rectangle(x - 90, y + 58, 150, 14, 0xffffff, 0.2).setOrigin(0, 0.5));
          k(sc.add.rectangle(x - 90, y + 58, Math.max(3, (150 * have) / need), 14, 0x52d273).setOrigin(0, 0.5));
          if (need > 1) k(sc.add.text(x + 68, y + 58, `${have}/${need}`, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0, 0.5));
        }
        ring.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          if (!own) {
            void host.talk(host.ru(goalLine(c.goal)));
            return;
          }
          host.setProgress({ ...host.progress(), plane: c.id });
          PLANES.forEach((cc, j) => {
            const o = host.progress().planes.includes(cc.id);
            rings[j]!.setFillStyle(0xffffff, cc.id === c.id ? 0.9 : o ? 0.16 : 0.06).setStrokeStyle(4, cc.id === c.id ? 0xffd166 : o ? 0xadb5bd : 0x495057);
          });
          host.beep([660, 880], 0.08);
          sc.tweens.add({ targets: img, y: img.y - 14, yoyo: true, duration: 180 });
          void host.talk(english(planeLine(c.id)));
        });
      });
    };
    if (air) drawPlanes();
    else drawCars();

    // ---- nitro shop ----
    let shop: Phaser.GameObjects.GameObject[] = [];
    let price = nitroPrice(host.rng);
    const drawShop = () => {
      shop.forEach((o) => o.destroy());
      shop = [];
      const s = <T extends Phaser.GameObjects.GameObject>(o: T) => {
        shop.push(k(o));
        return o;
      };
      const p = host.progress();
      s(sc.add.rectangle(W / 2, 572, 1220, 196, 0x000000, 0.35).setStrokeStyle(3, 0xffd166));
      s(sc.add.text(40, 486, `Мои монеты: ${p.coins}`, { fontFamily: FONT, fontSize: '26px', color: '#ffd166' }));
      for (let i = 0; i < MAX_NITRO; i++) s(sc.add.image(1000 + i * 52, 500, 'race-nitro').setDisplaySize(36, 50).setAlpha(i < p.nitro ? 1 : 0.25));
      s(sc.add.text(990, 500, 'Нитро:', { fontFamily: FONT, fontSize: '24px', color: '#7dd3fc' }).setOrigin(1, 0.5));
      // pile of coins (tap to move into the tray)
      const pile = Math.min(p.coins, PILE_MAX);
      const tray: Phaser.GameObjects.Image[] = [];
      const counter = s(sc.add.text(860, 640, '0', { fontFamily: FONT, fontSize: '44px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
      const trayBox = s(sc.add.rectangle(860, 578, 250, 100, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff));
      void trayBox;
      const relayout = () => {
        tray.forEach((c, i) => sc.tweens.add({ targets: c, x: 765 + (i % 5) * 47, y: 555 + Math.floor(i / 5) * 46, duration: 160 }));
        counter.setText(String(tray.length));
      };
      for (let i = 0; i < pile; i++) {
        const home = { x: 60 + (i % 15) * 42, y: 545 + Math.floor(i / 15) * 46 };
        const coin = s(sc.add.image(home.x, home.y, 'race-coin').setDisplaySize(40, 40).setInteractive({ useHandCursor: true }));
        coin.on('pointerup', () => {
          const at = tray.indexOf(coin);
          if (at >= 0) {
            tray.splice(at, 1);
            sc.tweens.add({ targets: coin, x: home.x, y: home.y, duration: 160 });
          } else {
            if (tray.length >= 10) return;
            tray.push(coin);
            voice.say(english(`n${tray.length}`));
            host.beep([500 + tray.length * 40], 0.06);
          }
          relayout();
        });
      }
      if (p.coins > PILE_MAX) s(sc.add.text(60 + 15 * 42 - 20, 636, `+${p.coins - PILE_MAX}`, { fontFamily: FONT, fontSize: '24px', color: '#ffd166' }));
      // the price tag
      const tag = s(sc.add.container(1080, 590));
      tag.add(sc.add.rectangle(0, 0, 150, 110, 0xfffaf0).setStrokeStyle(5, 0x2b2d42));
      tag.add(sc.add.image(-38, -8, 'race-nitro').setDisplaySize(40, 56));
      tag.add(sc.add.text(20, -14, String(price), { fontFamily: FONT, fontSize: '52px', color: '#2b2d42', fontStyle: 'bold' }).setOrigin(0.5));
      tag.add(sc.add.image(62, -14, 'race-coin').setDisplaySize(30, 30));
      tag.add(sc.add.text(0, 38, 'цена', { fontFamily: FONT, fontSize: '20px', color: '#6c757d' }).setOrigin(0.5));
      s(button(sc, 1080, 680, 'Купить', () => void buy(tray.length), { w: 180, h: 64, color: 0x2a9d8f }));
      s(sc.add.text(860, 508, 'положи сюда монеты', { fontFamily: FONT, fontSize: '18px', color: '#adb5bd' }).setOrigin(0.5));
    };
    const buy = async (n: number) => {
      const p = host.progress();
      if (p.nitro >= MAX_NITRO) return void host.talk(host.ru('raccoon.race.nitro.full'));
      if (p.coins < price) return void host.talk(host.ru('raccoon.race.nitro.poor'));
      if (n > price) return void host.talk(host.ru('raccoon.race.nitro.many'));
      if (n < price) return void host.talk(host.ru('raccoon.race.nitro.few'));
      host.setProgress({ ...p, coins: p.coins - price, nitro: p.nitro + 1 });
      host.beep([523, 659, 784, 1046], 0.1);
      price = nitroPrice(host.rng);
      drawShop();
      await host.talk(english('race.nitro'), host.ru('raccoon.race.nitro.yes'));
    };
    drawShop();
    const p = host.progress();
    void host.talk(host.ru(air ? 'raccoon.sky.hangar' : 'raccoon.race.garage'), ...(p.coins >= 3 && p.nitro < MAX_NITRO ? [host.ru('raccoon.race.nitro')] : []));
    void run;
  });
}
