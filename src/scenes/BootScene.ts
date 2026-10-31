import Phaser from 'phaser';
import { GameState } from '../game-state';
import { button, COLORS, H, title, W } from './ui';

/** Loads state and waits for the first tap, which also unlocks audio on iOS. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    this.cameras.main.setBackgroundColor(COLORS.sea);
    title(this, 'Кругосветка юнги', 200);
    const state = await GameState.load();
    this.registry.set('state', state);
    button(this, W / 2, H / 2 + 80, 'Поднять якорь', () => {
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      this.scene.start('Harbor');
    }, { w: 460 });
  }
}
