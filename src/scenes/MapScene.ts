import Phaser from 'phaser';
import type { GameState } from '../game-state';
import { blocks, button, COLORS, H, title, W, YACHT, YACHT_PALETTE } from './ui';

/** Atlantic: harbour + 5 islands. The sea crossing ("Course plotting") plugs in here in stage 3. */
export const ISLAND_POS: [number, number][] = [
  [160, 560], [380, 420], [600, 520], [820, 360], [1040, 460], [1180, 260],
];

export class MapScene extends Phaser.Scene {
  constructor() {
    super('Map');
  }

  create() {
    const state = this.registry.get('state') as GameState;
    this.cameras.main.setBackgroundColor(COLORS.sea);
    title(this, 'Атлантика', 60);

    const g = this.add.graphics();
    g.lineStyle(6, COLORS.white, 0.5);
    for (let i = 0; i < ISLAND_POS.length - 1; i++) {
      const [x1, y1] = ISLAND_POS[i]!;
      const [x2, y2] = ISLAND_POS[i + 1]!;
      g.lineBetween(x1, y1, x2, y2);
    }
    ISLAND_POS.forEach(([x, y], i) => {
      const reached = i <= state.profile.route.islandIndex;
      this.add.rectangle(x, y, 72, 72, reached ? COLORS.sand : COLORS.leaf).setStrokeStyle(4, 0x264653);
    });

    const idx = Math.min(state.profile.route.islandIndex, ISLAND_POS.length - 2);
    const [fx, fy] = ISLAND_POS[idx]!;
    const [tx, ty] = ISLAND_POS[idx + 1]!;
    const yacht = blocks(this, fx - 54, fy - 120, YACHT, 12, YACHT_PALETTE);

    button(this, W / 2, H - 70, 'Плыть', () => {
      this.tweens.add({
        targets: yacht,
        x: tx - 54,
        y: ty - 120,
        duration: 1200,
        ease: 'Sine.easeInOut',
        onComplete: async () => {
          await state.beginOrResume();
          this.scene.start('Island');
        },
      });
    }, { w: 300 });
  }
}
