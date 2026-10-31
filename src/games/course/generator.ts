import { int, pick, shuffle, type Rng } from '../common/rng';
import { run, type Block, type Cell, type CourseMap, type Dir, type Program } from './engine';

export const COURSE_MAX_LEVEL = 5;

interface LevelSpec {
  size: number;
  turns: number;
  seg: [number, number];
  reefs: number;
  repeat: boolean;
  coins: number;
}

const SPECS: Record<number, LevelSpec> = {
  1: { size: 5, turns: 0, seg: [2, 3], reefs: 3, repeat: false, coins: 0 },
  2: { size: 5, turns: 1, seg: [1, 3], reefs: 4, repeat: false, coins: 0 },
  3: { size: 6, turns: 2, seg: [1, 2], reefs: 6, repeat: false, coins: 0 },
  4: { size: 7, turns: 1, seg: [3, 5], reefs: 7, repeat: true, coins: 0 },
  5: { size: 8, turns: 2, seg: [2, 4], reefs: 9, repeat: true, coins: 2 },
};

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

/** Turns a list of single commands into blocks, folding runs into repeats when allowed. */
function compress(cmds: ('F' | 'L' | 'R')[], repeat: boolean): Program {
  const out: Block[] = [];
  for (const c of cmds) {
    const last = out[out.length - 1];
    if (repeat && last && last.cmd === c) last.times++;
    else out.push({ cmd: c, times: 1 });
  }
  return out;
}

function tryGenerate(level: number, rng: Rng): CourseMap | undefined {
  const spec = SPECS[level]!;
  const n = spec.size;
  const dir0 = int(rng, 0, 3) as Dir;
  const start = { x: int(rng, 0, n - 1), y: int(rng, 0, n - 1), dir: dir0 };
  let { x, y } = start;
  let dir: Dir = dir0;
  const path: Cell[] = [{ x, y }];
  const cmds: ('F' | 'L' | 'R')[] = [];
  for (let s = 0; s <= spec.turns; s++) {
    if (s > 0) {
      const turn = pick(rng, ['L', 'R'] as const);
      cmds.push(turn);
      dir = ((dir + (turn === 'L' ? 3 : 1)) % 4) as Dir;
    }
    const len = int(rng, spec.seg[0], spec.seg[1]);
    for (let i = 0; i < len; i++) {
      x += DX[dir]!;
      y += DY[dir]!;
      if (x < 0 || y < 0 || x >= n || y >= n) return undefined;
      if (path.some((c) => c.x === x && c.y === y)) return undefined;
      path.push({ x, y });
      cmds.push('F');
    }
  }
  const onPath = new Set(path.map((c) => `${c.x},${c.y}`));
  const free: Cell[] = [];
  for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) if (!onPath.has(`${xx},${yy}`)) free.push({ x: xx, y: yy });
  const reefs = shuffle(rng, free).slice(0, spec.reefs);
  const mid = path.slice(1, -1);
  const coins = shuffle(rng, mid).slice(0, spec.coins);
  const solution = compress(cmds, spec.repeat);
  const map: CourseMap = {
    level,
    w: n,
    h: n,
    start,
    goal: path[path.length - 1]!,
    reefs,
    coins,
    // With repeats, the limit is the compressed program: one block per straight run and turn.
    maxBlocks: spec.repeat ? solution.length : undefined,
    allowRepeat: spec.repeat,
    solution,
    itemId: `course${level}-${start.x}${start.y}${start.dir}-${cmds.join('')}`,
  };
  return run(map, solution).ok ? map : undefined;
}

export function generateCourse(level: number, rng: Rng): CourseMap {
  const lvl = Math.min(COURSE_MAX_LEVEL, Math.max(1, level));
  for (let i = 0; i < 500; i++) {
    const m = tryGenerate(lvl, rng);
    if (m) return m;
  }
  throw new Error(`could not generate course level ${lvl}`);
}
