import Phaser from 'phaser';
import type { SkillId } from '../core/types';
import type { GameState } from '../game-state';
import { finds, islandOf, strelkaParts } from '../story/script';
import { usePuzzle } from '../games/puzzle/mix';
import { button, COLORS, FONT, H, title, W } from './ui';

const SCENE: Partial<Record<SkillId, string>> = { reading: 'Note', math: 'Hold', chess: 'Chess', algo: 'Course' };

/**
 * Router of an episode: sea crossing (Course) → the island's tasks → what was
 * found (a story beat on an island's 2nd episode, the chest lock on the last) → Night.
 */
export class IslandScene extends Phaser.Scene {
  constructor() {
    super('Island');
  }

  create() {
    const state = this.registry.get('state') as GameState;
    const session = state.profile.currentSession;
    const task = state.currentTask();
    if (!session) {
      this.scene.start('Harbor');
      return;
    }
    if (!task || state.timeUp()) {
      this.end(state, !task);
      return;
    }
    const ep = state.episode;
    if (!session.crossingDone) {
      const algo = state.profile.skills.algo;
      // Klyaksa's broken routes: always in the Foggy Reefs, otherwise every other episode.
      const variant = islandOf(ep) === 2 || ep % 2 === 1 ? 'debug' : undefined;
      this.scene.start('Course', { task: { skill: 'algo', level: algo.level, isReview: false, variant } });
      return;
    }
    if (usePuzzle(task, session.done + ep)) {
      this.scene.start('Puzzle', { task });
      return;
    }
    const sceneKey = SCENE[task.skill];
    if (sceneKey) {
      this.scene.start(sceneKey, { task });
      return;
    }
    // Fallback for a skill without a scene yet.
    this.cameras.main.setBackgroundColor(COLORS.sand);
    title(this, `Задание ${session.done + 1} из ${session.tasks.length}`);
    this.add.text(W / 2, 260, 'Это задание ещё строится', { fontFamily: FONT, fontSize: '32px', color: '#5c3317' }).setOrigin(0.5);
    button(this, W / 2, H / 2 + 120, 'Дальше', () => {
      void state.completeTask('first_try', `stub-${task.skill}`, 0, 0).then(() => this.scene.restart());
    });
  }

  /** All tasks done (or time is up): the story beat, then the night. */
  private end(state: GameState, completed: boolean) {
    const ep = state.episode;
    const found = finds(ep);
    if (completed && ep === 9 && !state.seen('chest')) {
      this.scene.start('Lock');
      return;
    }
    if (found.length) {
      this.scene.start('Story', { lines: found, next: 'Night', bg: 'bg-beach', strelka: strelkaParts(ep + 1) });
      return;
    }
    this.scene.start('Night');
  }
}
