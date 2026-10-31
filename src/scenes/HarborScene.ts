import Phaser from 'phaser';
import type { GameState } from '../game-state';
import { INTRO, strelkaParts } from '../story/script';
import { button, FONT, H, W } from './ui';

/**
 * Parent check (SDD: grown-up gate): a multiplication a 6-year-old can't do yet.
 * Passing it opens the parent menu: one extra session today, or a fresh start.
 */
export class HarborScene extends Phaser.Scene {
  private overlay(title: string) {
    const items: Phaser.GameObjects.GameObject[] = [
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive(),
      this.add.rectangle(W / 2, H / 2, 760, 420, 0xfff1d0).setStrokeStyle(6, 0x8d5524),
      this.add.text(W / 2, H / 2 - 130, title, { fontFamily: FONT, fontSize: '32px', color: '#3d2b1f', align: 'center' }).setOrigin(0.5),
    ];
    const close = () => items.forEach((o) => o.destroy());
    return { items, close };
  }

  private parentGate(state: GameState) {
    const a = Phaser.Math.Between(6, 9);
    const b = Phaser.Math.Between(6, 9);
    const answer = a * b;
    const options = Phaser.Utils.Array.Shuffle([answer, answer + a, answer - b, answer + 1]);
    const { items, close } = this.overlay(`Для родителей.\nСколько будет ${a} × ${b}?`);
    options.forEach((v, i) => {
      items.push(
        button(this, W / 2 - 255 + i * 170, H / 2 + 20, String(v), () => {
          close();
          if (v === answer) this.parentMenu(state);
        }, { w: 150, h: 96 }),
      );
    });
    items.push(button(this, W / 2, H / 2 + 150, 'Отмена', close, { w: 240, h: 72, color: 0x6c757d }));
  }

  private parentMenu(state: GameState) {
    const { items, close } = this.overlay('Для родителей');
    if (!state.gate().allowed) {
      items.push(
        button(this, W / 2, H / 2 - 40, 'Ещё одно плавание', () => {
          close();
          void state.grantSession().then(() => this.scene.restart());
        }, { w: 520, h: 80 }),
      );
    }
    items.push(
      button(this, W / 2, H / 2 + 60, 'Начать заново', () => {
        close();
        this.confirmReset(state);
      }, { w: 520, h: 80, color: 0xc1121f }),
    );
    items.push(button(this, W / 2, H / 2 + 155, 'Закрыть', close, { w: 240, h: 64, color: 0x6c757d }));
  }

  private confirmReset(state: GameState) {
    const { items, close } = this.overlay('Стереть весь прогресс?\nИгра начнётся с самого начала.');
    items.push(
      button(this, W / 2 - 150, H / 2 + 60, 'Да, стереть', () => {
        close();
        void state.reset().then(() => this.scene.restart());
      }, { w: 260, h: 80, color: 0xc1121f }),
    );
    items.push(button(this, W / 2 + 150, H / 2 + 60, 'Нет', close, { w: 200, h: 80, color: 0x6c757d }));
  }

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
    this.add
      .text(W - 20, H - 20, 'Для родителей', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', backgroundColor: '#0b2233', padding: { x: 12, y: 8 } })
      .setOrigin(1)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.parentGate(state));
  }
}
