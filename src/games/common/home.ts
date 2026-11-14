import type Phaser from 'phaser';

/** "Домой" from a stand-alone mini-game: the main menu, or the harbour where there is no menu yet. */
export function goHome(scene: Phaser.Scene) {
  const key = scene.scene.manager.keys['Menu'] ? 'Menu' : 'Harbor';
  scene.scene.start(key);
}
