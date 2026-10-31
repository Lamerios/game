import Phaser from 'phaser';
import type { GameState } from '../game-state';
import { arrival, EPISODES, ISLAND_NAMES, islandOf, LETTERS, strelkaParts } from '../story/script';
import { button, FONT, H, W } from './ui';

/** Atlantic: harbour + 5 islands. */
export const ISLAND_POS: [number, number][] = [
  [120, 600], [330, 440], [560, 560], [760, 330], [990, 440], [1130, 210],
];

export class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  create() {
    const state = this.registry.get('state') as GameState;
    const ep = Math.min(state.episode, EPISODES - 1);
    const island = islandOf(ep);
    this.add.image(W / 2, H / 2, 'bg-sea').setDisplaySize(W, H);
    this.add
      .text(W / 2, 50, 'Атлантика', { fontFamily: FONT, fontSize: '52px', color: '#ffffff', stroke: '#0b2233', strokeThickness: 8 })
      .setOrigin(0.5);

    // Dotted route: solid where we have sailed.
    const g = this.add.graphics();
    for (let i = 0; i < ISLAND_POS.length - 1; i++) {
      const [x1, y1] = ISLAND_POS[i]!;
      const [x2, y2] = ISLAND_POS[i + 1]!;
      const sailed = i <= island;
      for (let t = 0; t < 1; t += 0.06) {
        g.fillStyle(sailed ? 0xffd166 : 0xffffff, sailed ? 0.95 : 0.4).fillCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 5);
      }
    }
    // Harbour, then the islands.
    this.add.image(ISLAND_POS[0]![0], ISLAND_POS[0]![1], 'yacht-side').setDisplaySize(70, 64).setAlpha(0.6);
    ISLAND_NAMES.forEach((name, i) => {
      const [x, y] = ISLAND_POS[i + 1]!;
      const visited = i < island || (i === island && ep % 2 === 1);
      this.add.image(x, y, `island-${i}-${visited ? 'v' : 'n'}`).setDisplaySize(200, 120);
      this.add
        .text(x, y + 62, name, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', backgroundColor: '#0b2233aa', padding: { x: 8, y: 2 } })
        .setOrigin(0.5, 0);
    });

    // What we have found so far.
    const parts = strelkaParts(state.episode);
    // Top-left: Strelka and the letters of the secret word.
    this.add.rectangle(20, 20, 330, 140, 0x0b2233, 0.75).setOrigin(0).setStrokeStyle(3, 0xffd166);
    this.add.image(90, 90, `strelka-${parts}`).setDisplaySize(110, 110);
    this.add.text(150, 32, `Детали: ${parts} из 4`, { fontFamily: FONT, fontSize: '24px', color: '#ffffff' });
    LETTERS.forEach((l, i) => {
      const found = i < parts;
      this.add.rectangle(170 + i * 44, 110, 38, 46, found ? 0xfff1d0 : 0x415a77).setStrokeStyle(3, 0xffd166);
      this.add
        .text(170 + i * 44, 110, found ? l : '?', { fontFamily: FONT, fontSize: '30px', color: found ? '#3d2b1f' : '#adb5bd' })
        .setOrigin(0.5);
    });

    // Klyaksa's ship lurks ahead of us until the last island.
    if (island < 4) {
      const [bx, by] = ISLAND_POS[Math.min(island + 2, 5)]!;
      const blot = this.add.image(bx + 70, by - 70, 'blot-ship').setDisplaySize(110, 100);
      this.tweens.add({ targets: blot, y: by - 80, yoyo: true, repeat: -1, duration: 1300, ease: 'Sine.easeInOut' });
    }

    const from = ISLAND_POS[island]!;
    const to = ISLAND_POS[island + 1]!;
    const atIsland = ep % 2 === 1; // second visit: we are already there
    const start = atIsland ? to : from;
    const yacht = this.add.image(start[0] - 10, start[1] - 60, 'yacht-side').setDisplaySize(110, 100);
    this.tweens.add({ targets: yacht, angle: 3, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });

    button(this, W - 190, H - 70, 'Плыть', () => {
      this.tweens.add({
        targets: yacht,
        x: to[0] - 10,
        y: to[1] - 60,
        duration: atIsland ? 300 : 1400,
        ease: 'Sine.easeInOut',
        onComplete: async () => {
          const fresh = !state.profile.currentSession;
          await state.beginOrResume();
          if (fresh) {
            this.scene.start('Story', { lines: arrival(ep), next: 'Island', bg: 'bg-beach', strelka: parts });
          } else {
            this.scene.start('Island');
          }
        },
      });
    }, { w: 300 });
  }
}
