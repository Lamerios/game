import Phaser from 'phaser';
import { english, type Utterance } from '../../core/phrases';
import { voice } from '../../core/audio';
import { button, FONT, H, W } from '../../scenes/ui';
import type { Rng } from '../common/rng';
import { CARS, carLine, MAX_NITRO, nextCar, nitroPrice, type Progress } from './logic';

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
 */
export function runGarage(host: Host, run: number): Promise<void> {
  const sc = host.scene;
  const k = <T extends Phaser.GameObjects.GameObject>(o: T) => host.keep(o);
  return new Promise<void>((done) => {
    const bg = k(sc.add.graphics());
    bg.fillGradientStyle(0x2b2d42, 0x2b2d42, 0x14213d, 0x14213d, 1).fillRect(0, 0, W, H);
    // garage floor stripes
    for (let i = 0; i < 20; i++) bg.fillStyle(0xffd166, 0.9).fillRect(i * 70, 448, 35, 10);
    k(sc.add.text(W / 2, 44, 'Гараж', { fontFamily: FONT, fontSize: '56px', color: '#ffd166', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 10 }).setOrigin(0.5));
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

    // ---- cars ----
    const rings: Phaser.GameObjects.Rectangle[] = [];
    const drawCars = () => {
      const p = host.progress();
      const next = nextCar(p);
      CARS.forEach((c, i) => {
        const x = 118 + (i % 6) * 209;
        const y = 175 + Math.floor(i / 6) * 150;
        const own = p.cars.includes(c.id);
        const ring = k(sc.add.rectangle(x, y, 196, 138, 0xffffff, c.id === p.car ? 0.9 : 0.1).setStrokeStyle(4, c.id === p.car ? 0xffd166 : 0x495057));
        rings[i] = ring;
        const img = k(sc.add.image(x, y - 4, `race-car-${c.id}`).setScale(0.38));
        if (!own) img.setTintFill(0x14213d).setAlpha(0.8);
        k(sc.add.text(x, y + 52, own ? c.name : c === next ? 'следующая' : '?', { fontFamily: FONT, fontSize: '20px', color: c.id === p.car ? '#14213d' : '#ffffff' }).setOrigin(0.5));
        ring.setInteractive({ useHandCursor: true }).on('pointerup', () => {
          if (!own) {
            void host.talk(host.ru('raccoon.race.garage'));
            return;
          }
          host.setProgress({ ...host.progress(), car: c.id });
          CARS.forEach((cc, j) => rings[j]!.setFillStyle(0xffffff, cc.id === c.id ? 0.9 : 0.1).setStrokeStyle(4, cc.id === c.id ? 0xffd166 : 0x495057));
          host.beep([660, 880], 0.08);
          sc.tweens.add({ targets: img, y: img.y - 14, yoyo: true, duration: 180 });
          void host.talk(english(carLine(c.id)));
        });
      });
    };
    drawCars();

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
    void host.talk(host.ru('raccoon.race.garage'), ...(p.coins >= 3 && p.nitro < MAX_NITRO ? [host.ru('raccoon.race.nitro')] : []));
    void run;
  });
}
