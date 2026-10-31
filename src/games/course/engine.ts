/** Sea-grid interpreter for "Course plotting" (SDD 3.3). Pure, no Phaser. */

export type Dir = 0 | 1 | 2 | 3; // N, E, S, W
export type Cmd = 'F' | 'L' | 'R';
export interface Block {
  cmd: Cmd;
  /** "Repeat ×N" badge; 1 means no repeat. */
  times: number;
}
export type Program = Block[];

export interface Cell {
  x: number;
  y: number;
}

export interface CourseMap {
  level: number;
  w: number;
  h: number;
  start: Cell & { dir: Dir };
  goal: Cell;
  reefs: Cell[];
  coins: Cell[];
  /** Max number of blocks in the program (L4+), undefined = no limit. */
  maxBlocks?: number;
  /** Repeat badges available (L4+). */
  allowRepeat: boolean;
  /** A known valid program, used for hints and tests. */
  solution: Program;
  itemId: string;
}

export interface Step {
  x: number;
  y: number;
  dir: Dir;
  /** Index of the block being executed. */
  block: number;
}

export type RunResult =
  | { ok: true; steps: Step[] }
  | { ok: false; reason: 'crash' | 'not_at_goal' | 'coins_left' | 'too_long'; steps: Step[]; block: number };

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

const key = (c: Cell) => `${c.x},${c.y}`;

export function run(map: CourseMap, program: Program): RunResult {
  if (map.maxBlocks !== undefined && program.length > map.maxBlocks) {
    return { ok: false, reason: 'too_long', steps: [], block: program.length - 1 };
  }
  const reefs = new Set(map.reefs.map(key));
  const coins = new Set(map.coins.map(key));
  let { x, y, dir } = map.start;
  const steps: Step[] = [{ x, y, dir, block: -1 }];
  for (let b = 0; b < program.length; b++) {
    const { cmd, times } = program[b]!;
    for (let t = 0; t < times; t++) {
      if (cmd === 'L') dir = ((dir + 3) % 4) as Dir;
      else if (cmd === 'R') dir = ((dir + 1) % 4) as Dir;
      else {
        const nx = x + DX[dir]!;
        const ny = y + DY[dir]!;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || reefs.has(`${nx},${ny}`)) {
          return { ok: false, reason: 'crash', steps, block: b };
        }
        x = nx;
        y = ny;
        coins.delete(`${x},${y}`);
      }
      steps.push({ x, y, dir, block: b });
    }
  }
  const last = program.length - 1;
  if (x !== map.goal.x || y !== map.goal.y) return { ok: false, reason: 'not_at_goal', steps, block: last };
  if (coins.size > 0) return { ok: false, reason: 'coins_left', steps, block: last };
  return { ok: true, steps };
}

/** Number of single commands (after expanding repeats). */
export const expandedLength = (p: Program) => p.reduce((s, b) => s + b.times, 0);
