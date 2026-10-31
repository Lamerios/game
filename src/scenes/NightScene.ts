import Phaser from 'phaser';
import type { GameState } from '../game-state';
import { button, COLORS, FONT, H, title, W } from './ui';

/** Natural stop point: the yacht anchors, the crew sleeps. No auto-start of the next island. */
export class NightScene extends Phaser.Scene {
  constructor() {
    super('Night');
  }

  async create() {
    const state = this.registry.get('state') as GameState;
    this.cameras.main.setBackgroundColor(COLORS.night);
    for (let i = 0; i < 40; i++) {
      this.add.rectangle(Math.random() * W, Math.random() * H * 0.6, 6, 6, 0xfff3b0);
    }
    title(this, 'Ночь. Яхта на якоре, команда спит', 200);
    this.add
      .text(W / 2, 300, 'Вопрос для штурмана: почему яхта не может идти прямо против ветра?', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#e9c46a',
        wordWrap: { width: 1000 },
        align: 'center',
      })
      .setOrigin(0.5);
    if (state.profile.currentSession) await state.finish();
    button(this, W / 2, H - 140, 'В гавань', () => this.scene.start('Harbor'), { w: 360 });
  }
}
