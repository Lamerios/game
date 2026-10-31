import Phaser from 'phaser';
import type { SkillId } from '../core/types';
import type { GameState } from '../game-state';
import { button, COLORS, FONT, H, title, W } from './ui';

const SKILL_NAME: Record<SkillId, string> = {
  reading: 'Записка в бутылке',
  math: 'Загрузка трюма',
  algo: 'Прокладка курса',
  chess: 'Шахматный форт',
  writing: 'Судовой журнал',
};

/**
 * Runs the island: first the sea crossing (Course), then the island's tasks,
 * each in its own mini-game scene. The stub buttons below remain only as a
 * fallback for a skill without a scene.
 */
export class IslandScene extends Phaser.Scene {
  constructor() {
    super('Island');
  }

  create() {
    const state = this.registry.get('state') as GameState;
    this.cameras.main.setBackgroundColor(COLORS.sand);
    const task = state.currentTask();
    if (!task || state.timeUp()) {
      this.scene.start('Night');
      return;
    }
    const session = state.profile.currentSession!;
    if (!session.crossingDone) {
      const algo = state.profile.skills.algo;
      this.scene.start('Course', { task: { skill: 'algo', level: algo.level, isReview: false } });
      return;
    }
    title(this, `Остров ${session.islandIndex + 1}: задание ${session.done + 1} из ${session.tasks.length}`);
    this.add
      .text(W / 2, 220, `${SKILL_NAME[task.skill]} · уровень ${task.level}${task.isReview ? ' · повтор' : ''}`, {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#0b2233',
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 290, 'Заглушка: мини-игра появится на следующих этапах', { fontFamily: FONT, fontSize: '28px', color: '#5c3317' })
      .setOrigin(0.5);

    const real: Partial<Record<SkillId, string>> = { reading: 'Note', math: 'Hold', chess: 'Chess' };
    const sceneKey = real[task.skill];
    if (sceneKey) {
      this.scene.start(sceneKey, { task });
      return;
    }

    const started = Date.now();
    const done = async (outcome: 'first_try' | 'with_hint' | 'shown', hints: number) => {
      await state.completeTask(outcome, `stub-${task.skill}-${task.level}`, hints, Date.now() - started);
      this.scene.restart();
    };
    button(this, W / 2 - 400, H / 2 + 120, 'Сразу', () => void done('first_try', 0), { w: 340, color: COLORS.leaf });
    button(this, W / 2, H / 2 + 120, 'С подсказкой', () => void done('with_hint', 1), { w: 340 });
    button(this, W / 2 + 400, H / 2 + 120, 'Показали', () => void done('shown', 4), { w: 340, color: 0x9b2226 });
  }
}
