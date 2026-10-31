import Phaser from 'phaser';
import { HoldScene } from './games/hold/HoldScene';
import { NoteScene } from './games/note/NoteScene';
import { BootScene } from './scenes/BootScene';
import { HarborScene } from './scenes/HarborScene';
import { IslandScene } from './scenes/IslandScene';
import { MapScene } from './scenes/MapScene';
import { NightScene } from './scenes/NightScene';
import { COLORS, H, W } from './scenes/ui';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: COLORS.night,
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, HarborScene, MapScene, IslandScene, NoteScene, HoldScene, NightScene],
});

// Dev-only handle for automated play-through tests.
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
