import Phaser from 'phaser';
import type { GameState } from '../game-state';
import { INTRO, strelkaParts } from '../story/script';
import { button, FONT, H, W } from './ui';

export class HarborScene extends Phaser.Scene {
  constructor() {
    super('Harbor');
  }

  create() {
    const state = this.registry.get('state') as GameState;
    // Prologue on the very first launch.
    if (!state.seen('intro')) {
      void state.markSeen('intro');
      this.scene.start('Story', { lines: INTRO, next: 'Harbor', bg: 'bg-harbor', strelka: 0 });
      return;
    }
    this.add.image(W / 2, H / 2, 'bg-harbor').setDisplaySize(W, H);
    const yacht = this.add.image(330, 470, 'yacht-side').setDisplaySize(360, 332);
    this.tweens.add({ targets: yacht, angle: 2, y: 476, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut' });
    // The crew on the pier.
    this.add.image(900, 520, 'char-kettle').setDisplaySize(140, 140);
    this.add.image(1040, 500, 'char-raccoon').setDisplaySize(170, 170);
    this.add.image(1180, 520, `strelka-${strelkaParts(state.episode)}`).setDisplaySize(140, 140);
    this.add.image(790, 510, 'char-rumb').setDisplaySize(130, 130);
    this.add
      .text(W / 2, 70, `Капитан ${state.profile.childName}`, { fontFamily: FONT, fontSize: '56px', color: '#ffffff', stroke: '#1b4965', strokeThickness: 10 })
      .setOrigin(0.5);

    const gate = state.gate();
    if (gate.allowed) {
      button(this, 980, 330, 'В море!', () => this.scene.start('Map'), { w: 380 });
    } else {
      const msg =
        gate.reason === 'daily_limit'
          ? 'Команда отдыхает до завтра'
          : `Команда отдыхает до ${new Date(gate.availableAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      this.add
        .text(980, 330, msg, { fontFamily: FONT, fontSize: '40px', color: '#ffffff', backgroundColor: '#1b4965', padding: { x: 16, y: 10 } })
        .setOrigin(0.5);
    }
  }
}
