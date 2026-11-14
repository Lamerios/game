import Phaser from 'phaser';
import { BarrelsScene } from './games/action/BarrelsScene';
import { BuoysScene } from './games/action/BuoysScene';
import { GullsScene } from './games/action/GullsScene';
import { ChessScene } from './games/chess/ChessScene';
import { CourseScene } from './games/course/CourseScene';
import { HoldScene } from './games/hold/HoldScene';
import { NoteScene } from './games/note/NoteScene';
import { PuzzleScene } from './games/puzzle/PuzzleScene';
import { ParcelScene } from './games/parcel/ParcelScene';
import { RaceScene } from './games/race/RaceScene';
import { SnakeScene } from './games/snake/SnakeScene';
import { BootScene } from './scenes/BootScene';
import { HarborScene } from './scenes/HarborScene';
import { IslandScene } from './scenes/IslandScene';
import { MapScene } from './scenes/MapScene';
import { NightScene } from './scenes/NightScene';
import { StoryScene } from './scenes/StoryScene';
import { LockScene } from './scenes/LockScene';
import { WordStatsScene } from './scenes/WordStatsScene';
import { MenuScene } from './scenes/MenuScene';
import { analytics, startAppTracking } from './core/analytics';
import { voice } from './core/audio';
import { BUILD } from './parent/dashboard';
import { COLORS, H, W } from './scenes/ui';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: COLORS.night,
  antialias: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, HarborScene, MapScene, IslandScene, CourseScene, NoteScene, HoldScene, ChessScene, PuzzleScene, BarrelsScene, GullsScene, BuoysScene, NightScene, StoryScene, LockScene, SnakeScene, ParcelScene, RaceScene, WordStatsScene],
});

// Event log for the parent dashboard (local only). A line said by the browser voice
// instead of a recorded clip is logged once per clip, to find gaps in the voice-over.
startAppTracking(BUILD);
const fellBack = new Set<string>();
voice.onFallback = (clip, reason) => {
  if (fellBack.has(clip)) return;
  fellBack.add(clip);
  analytics.log('app', 'voice.fallback', { clip, reason });
};

// Dev-only handle for automated play-through tests.
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
