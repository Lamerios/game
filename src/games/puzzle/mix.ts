import type { SessionTask } from '../../core/types';
import { NOTE_MAX_LEVEL } from '../note/generator';
import { HOLD_MAX_LEVEL } from '../hold/generator';

/**
 * Reading and math alternate between the classic game and a story puzzle;
 * the star task and levels above the classic game's range are always puzzles.
 */
export function usePuzzle(task: SessionTask, turn: number): boolean {
  if (task.skill !== 'reading' && task.skill !== 'math') return false;
  if (task.star) return true;
  if (task.skill === 'reading' && task.level > NOTE_MAX_LEVEL) return true;
  if (task.skill === 'math' && task.level > HOLD_MAX_LEVEL) return true;
  return turn % 2 === 0;
}

/**
 * At most one text to read per episode: a reading task after an earlier one
 * becomes the letter-catching game instead (playtest: two notes from Beard in a
 * row made the child want to stop).
 */
export function lettersInstead(tasks: readonly SessionTask[], idx: number): boolean {
  return tasks[idx]?.skill === 'reading' && tasks.slice(0, idx).some((t) => t.skill === 'reading');
}
