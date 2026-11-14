import Phaser from 'phaser';
import { track } from '../core/analytics';
import type { GameState } from '../game-state';
import { button, FONT, H, W } from '../scenes/ui';
import { openDashboard } from './dashboard';

/** Grown-up check (a multiplication a 6-year-old can't do yet), then the parent dashboard. */
export function openParentGate(scene: Phaser.Scene, state: GameState) {
  const a = Phaser.Math.Between(6, 9);
  const b = Phaser.Math.Between(6, 9);
  const answer = a * b;
  const options = Phaser.Utils.Array.Shuffle([answer, answer + a, answer - b, answer + 1]);
  const items: Phaser.GameObjects.GameObject[] = [
    scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive(),
    scene.add.rectangle(W / 2, H / 2, 760, 420, 0xfff1d0).setStrokeStyle(6, 0x8d5524),
    scene.add.text(W / 2, H / 2 - 130, `Для родителей.\nСколько будет ${a} × ${b}?`, { fontFamily: FONT, fontSize: '32px', color: '#3d2b1f', align: 'center' }).setOrigin(0.5),
  ];
  const close = () => items.forEach((o) => o.destroy());
  options.forEach((v, i) => {
    items.push(
      button(scene, W / 2 - 255 + i * 170, H / 2 + 20, String(v), () => {
        close();
        track('parent', 'parent.gate', { ok: v === answer });
        if (v === answer) openDashboard(state, () => scene.scene.restart());
      }, { w: 150, h: 96 }),
    );
  });
  items.push(button(scene, W / 2, H / 2 + 150, 'Отмена', close, { w: 240, h: 72, color: 0x6c757d }));
  items.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(5000));
}
