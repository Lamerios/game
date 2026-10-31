import Phaser from 'phaser';
import { ChessScene } from './games/chess/ChessScene';
import { CourseScene } from './games/course/CourseScene';
import { HoldScene } from './games/hold/HoldScene';
import { NoteScene } from './games/note/NoteScene';
import { PuzzleScene } from './games/puzzle/PuzzleScene';
import { BootScene } from './scenes/BootScene';
import { HarborScene } from './scenes/HarborScene';
import { IslandScene } from './scenes/IslandScene';
import { MapScene } from './scenes/MapScene';
import { NightScene } from './scenes/NightScene';
import { StoryScene } from './scenes/StoryScene';
import { LockScene } from './scenes/LockScene';
import { COLORS, H, W } from './scenes/ui';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: COLORS.night,
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, HarborScene, MapScene, IslandScene, CourseScene, NoteScene, HoldScene, ChessScene, PuzzleScene, NightScene, StoryScene, LockScene],
});

// Dev-only handle for automated play-through tests.
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
