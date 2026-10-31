import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HarborScene } from './scenes/HarborScene';
import { IslandScene } from './scenes/IslandScene';
import { MapScene } from './scenes/MapScene';
import { NightScene } from './scenes/NightScene';
import { COLORS, H, W } from './scenes/ui';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: COLORS.night,
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, HarborScene, MapScene, IslandScene, NightScene],
});
