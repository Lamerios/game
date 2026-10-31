import Phaser from 'phaser';
import { preloadArt } from '../art/load';
import { voice } from '../core/audio';
import { GameState } from '../game-state';
import { button, FONT, H, W } from './ui';

/** Loads art and state, then waits for the first tap, which also unlocks audio on iOS. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.cameras.main.setBackgroundColor(0x1b4965);
    const bar = this.add.rectangle(W / 2 - 300, H / 2, 0, 24, 0xffd166).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 600, 24).setStrokeStyle(4, 0xffffff);
    this.load.on('progress', (v: number) => bar.setSize(600 * v, 24));
    preloadArt(this);
  }

  async create() {
    this.add.image(W / 2, H / 2, 'bg-harbor').setDisplaySize(W, H);
    this.add.image(330, 470, 'yacht-side').setDisplaySize(360, 332);
    this.add
      .text(W / 2, 150, 'Кругосветка капитана', { fontFamily: FONT, fontSize: '64px', color: '#ffffff', stroke: '#1b4965', strokeThickness: 10 })
      .setOrigin(0.5);
    const [state] = await Promise.all([GameState.load(), voice.init()]);
    this.registry.set('state', state);
    button(this, W / 2 + 180, H / 2 + 60, 'Поднять якорь', () => {
      const ctx = (this.sound as Phaser.Sound.WebAudioSoundManager).context;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      voice.unlock();
      this.scene.start('Harbor');
    }, { w: 460 });
  }
}
