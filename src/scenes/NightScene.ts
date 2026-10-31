import Phaser from 'phaser';
import { voice } from '../core/audio';
import { phrase } from '../core/phrases';
import type { GameState } from '../game-state';
import { evening } from '../story/script';
import { button, FONT, H, W } from './ui';

/** Natural stop point: the yacht anchors, Pykhtelkin tells a fact and a cliffhanger. */
export class NightScene extends Phaser.Scene {
  constructor() {
    super('Night');
  }

  async create() {
    const state = this.registry.get('state') as GameState;
    const ep = state.episode;
    this.add.image(W / 2, H / 2, 'bg-night').setDisplaySize(W, H);
    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(Math.random() * W, Math.random() * H * 0.6, Math.random() * 2 + 1, 0xfff3b0);
      this.tweens.add({ targets: star, alpha: 0.3, yoyo: true, repeat: -1, duration: 800 + Math.random() * 1500 });
    }
    const yacht = this.add.image(300, 470, 'yacht-side').setDisplaySize(300, 277).setTint(0x8899bb);
    this.tweens.add({ targets: yacht, angle: 2, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });
    const kettle = this.add.image(W - 240, H - 200, 'char-kettle').setDisplaySize(300, 300);
    this.tweens.add({ targets: kettle, y: H - 210, yoyo: true, repeat: -1, duration: 900 });

    const line = phrase(evening(ep));
    const t = this.add.text(80, 60, line.show, {
      fontFamily: FONT,
      fontSize: '34px',
      color: '#0b2233',
      wordWrap: { width: 760 },
      lineSpacing: 6,
    });
    this.add.rectangle(56, 40, 810, t.height + 50, 0xfff1d0).setOrigin(0).setStrokeStyle(5, 0xffd166);
    t.setDepth(1);
    voice.say(line);
    if (state.profile.currentSession) await state.finish();
    button(this, W / 2 - 100, H - 90, 'Спокойной ночи', () => {
      voice.stop();
      this.scene.start('Harbor');
    }, { w: 420 });
  }
}
