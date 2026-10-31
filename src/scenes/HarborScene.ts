import Phaser from 'phaser';
import type { GameState } from '../game-state';
import { blocks, button, COLORS, FONT, H, title, W, YACHT, YACHT_PALETTE } from './ui';

export class HarborScene extends Phaser.Scene {
  constructor() {
    super('Harbor');
  }

  create() {
    const state = this.registry.get('state') as GameState;
    this.cameras.main.setBackgroundColor(COLORS.seaLight);
    this.add.rectangle(W / 2, H - 80, W, 160, COLORS.sand);
    blocks(this, 160, H - 300, YACHT, 24, YACHT_PALETTE);
    title(this, `Гавань. Капитан ${state.profile.childName}`);

    const gate = state.gate();
    if (gate.allowed) {
      button(this, W / 2 + 200, H / 2, 'В море!', () => this.scene.start('Map'), { w: 380 });
    } else {
      const msg =
        gate.reason === 'daily_limit'
          ? 'Команда отдыхает до завтра'
          : `Команда отдыхает до ${new Date(gate.availableAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      this.add.text(W / 2 + 200, H / 2, msg, { fontFamily: FONT, fontSize: '40px', color: '#0b2233' }).setOrigin(0.5);
    }
  }
}
