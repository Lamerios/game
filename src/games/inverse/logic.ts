import { int, pick, shuffle, type Rng } from '../common/rng';

/**
 * «Наоборот, юнга!»: the captain shouts English commands, the flag on the mast
 * says how to obey them.
 *
 *   white flag — do what was said (English directions, listening)
 *   black flag — do the opposite ("Left!" → press right): inhibitory control,
 *                holding a rule in mind (Head-Toes-Knees-Shoulders type games,
 *                Ponitz, McClelland et al., 2009; Tominey & McClelland, 2011)
 *   red flag   — freeze, press nothing (go / no-go)
 *
 * The flag changes in the middle of the game: switching between rules is the
 * cognitive-flexibility part (DCCS, Zelazo, 2006). Body commands ("Jump!",
 * "Clap your hands!") are total physical response: the child does them in the
 * room (Toumpaniari et al., 2015), and one "Storm!" break gets them moving.
 *
 * Difficulty adapts to keep the child at ~70–90 % right (Wilson et al., 2019).
 */

export type Dir = 'left' | 'right' | 'up' | 'down';
export type Flag = 'white' | 'black' | 'red';
export type Body = 'jump' | 'clap' | 'sit' | 'stand' | 'turn' | 'wave';

export const DIRS: readonly Dir[] = ['left', 'right', 'up', 'down'];
export const OPPOSITE: Record<Dir, Dir> = { left: 'right', right: 'left', up: 'down', down: 'up' };
export const BODY: readonly Body[] = ['jump', 'clap', 'sit', 'stand', 'turn', 'wave'];

export const MAX_LEVEL = 5;
export const COMMANDS_PER_GAME = 14;

export type Step =
  | { kind: 'dir'; dir: Dir; flag: Flag; /** The flag shows only after the command (L5: hold the word in mind). */ late: boolean; limitMs?: number }
  | { kind: 'body'; body: Body }
  | { kind: 'storm' };

export interface LevelSpec {
  dirs: readonly Dir[];
  /** Commands under the white flag before anything else (warm-up, learn the words). */
  warmup: number;
  /** Black-only commands after the warm-up, before the flags start to mix. */
  blackOnly: number;
  noGo: boolean;
  /** Chance that the flag changes between two mixed commands. */
  switchRate: number;
  limitMs?: number;
  late: boolean;
}

export const LEVELS: Record<number, LevelSpec> = {
  1: { dirs: ['left', 'right'], warmup: 4, blackOnly: 4, noGo: false, switchRate: 0.3, late: false },
  2: { dirs: DIRS, warmup: 3, blackOnly: 3, noGo: false, switchRate: 0.4, late: false },
  3: { dirs: DIRS, warmup: 2, blackOnly: 2, noGo: true, switchRate: 0.5, late: false },
  4: { dirs: DIRS, warmup: 1, blackOnly: 1, noGo: true, switchRate: 0.6, limitMs: 3500, late: false },
  5: { dirs: DIRS, warmup: 1, blackOnly: 0, noGo: true, switchRate: 0.6, limitMs: 3500, late: true },
};

/** English line ids (content/phrases.json "english"): what the captain shouts. */
export const dirLine = (d: Dir) => `cmd.${d}`;
export const bodyLine = (b: Body) => `cmd.${b}`;
export const STORM_LINE = 'cmd.storm';

export function englishLines(): Record<string, string> {
  return {
    'cmd.left': 'Left!',
    'cmd.right': 'Right!',
    'cmd.up': 'Up!',
    'cmd.down': 'Down!',
    'cmd.jump': 'Jump!',
    'cmd.clap': 'Clap your hands!',
    'cmd.sit': 'Sit down!',
    'cmd.stand': 'Stand up!',
    'cmd.turn': 'Turn around!',
    'cmd.wave': 'Wave your hand!',
    'cmd.storm': 'Storm! Sway like a ship!',
  };
}

/** The key the child must press, or null for "press nothing". */
export function expected(dir: Dir, flag: Flag): Dir | null {
  if (flag === 'red') return null;
  return flag === 'black' ? OPPOSITE[dir] : dir;
}

/** Whether a press (or no press = null) is right for this command. */
export function isRight(step: Extract<Step, { kind: 'dir' }>, pressed: Dir | null): boolean {
  return expected(step.dir, step.flag) === pressed;
}

/**
 * One game: warm-up under the white flag, then black, then mixed flags with
 * a couple of body commands and one storm break in the middle. No direction
 * twice in a row under the same flag (so it never becomes pure tapping).
 */
export function planGame(level: number, rng: Rng, n = COMMANDS_PER_GAME): Step[] {
  const spec = LEVELS[Math.min(MAX_LEVEL, Math.max(1, level))]!;
  const dirSteps: Extract<Step, { kind: 'dir' }>[] = [];
  let flag: Flag = 'white';
  let last: Dir | undefined;
  const nextDir = () => {
    const d = pick(rng, spec.dirs.filter((x) => x !== last));
    last = d;
    return d;
  };
  for (let i = 0; i < n; i++) {
    if (i < spec.warmup) flag = 'white';
    else if (i < spec.warmup + spec.blackOnly) flag = 'black';
    else if (i === spec.warmup + spec.blackOnly && spec.blackOnly === 0 && spec.warmup > 0) flag = 'black';
    else if (rng() < spec.switchRate) {
      const options: Flag[] = spec.noGo ? ['white', 'black', 'red'] : ['white', 'black'];
      // Red is rarer: freezing is the exception, not the rule.
      const weighted = options.flatMap((f) => (f === 'red' ? [f] : [f, f])).filter((f) => f !== flag);
      flag = pick(rng, weighted);
    }
    // Never two reds in a row: a no-go only works against a habit of going.
    if (flag === 'red' && dirSteps.at(-1)?.flag === 'red') flag = rng() < 0.5 ? 'white' : 'black';
    const mixed = i >= spec.warmup + spec.blackOnly;
    dirSteps.push({ kind: 'dir', dir: nextDir(), flag, late: spec.late && mixed, limitMs: spec.limitMs });
  }
  // The game must contain both rules, and a switch, whatever the dice say.
  const flags = new Set(dirSteps.map((s) => s.flag));
  if (!flags.has('black')) dirSteps[dirSteps.length - 2]!.flag = 'black';
  if (!flags.has('white')) dirSteps[0]!.flag = 'white';
  if (spec.noGo && !dirSteps.some((s) => s.flag === 'red')) dirSteps[int(rng, Math.ceil(n / 2), n - 2)]!.flag = 'red';

  const body = shuffle(rng, BODY).slice(0, 2);
  const out: Step[] = [...dirSteps];
  // Body commands at about one third and two thirds, the storm in the middle.
  out.splice(Math.round((n * 2) / 3), 0, { kind: 'body', body: body[1]! });
  out.splice(Math.round(n / 2), 0, { kind: 'storm' });
  out.splice(Math.round(n / 3), 0, { kind: 'body', body: body[0]! });
  return out;
}

/** Index pairs where the flag changes: the moments the rule switches. */
export function switches(steps: readonly Step[]): number[] {
  const out: number[] = [];
  let prev: Flag | undefined;
  steps.forEach((s, i) => {
    if (s.kind !== 'dir') return;
    if (prev && s.flag !== prev) out.push(i);
    prev = s.flag;
  });
  return out;
}

export function starsFor(right: number, total: number): 1 | 2 | 3 {
  const r = total ? right / total : 0;
  // Finishing always earns a star: effort counts.
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1;
}

export interface Progress {
  level: number;
  games: number;
  best: number;
  /** Accuracy of the last games, newest last (for the level rule). */
  recent: number[];
}

export const freshProgress = (): Progress => ({ level: 1, games: 0, best: 0, recent: [] });

export function parseProgress(raw: unknown): Progress {
  const p = freshProgress();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as Partial<Progress>;
  if (typeof r.level === 'number' && r.level >= 1 && r.level <= MAX_LEVEL) p.level = Math.round(r.level);
  if (typeof r.games === 'number' && r.games >= 0) p.games = r.games;
  if (typeof r.best === 'number') p.best = r.best;
  if (Array.isArray(r.recent)) p.recent = r.recent.filter((x) => typeof x === 'number').slice(-3);
  return p;
}

/**
 * After a game: ≥ 90 % right → next level (it was too easy), < 65 % → back a
 * level (too hard), otherwise stay. Aims at the zone where the child errs
 * sometimes but mostly succeeds.
 */
export function recordGame(p: Progress, right: number, total: number): { progress: Progress; change: 'up' | 'down' | 'none' } {
  const acc = total ? right / total : 0;
  const next: Progress = { ...p, games: p.games + 1, best: Math.max(p.best, right), recent: [...p.recent, acc].slice(-3) };
  if (acc >= 0.9 && p.level < MAX_LEVEL) return { progress: { ...next, level: p.level + 1, recent: [] }, change: 'up' };
  if (acc < 0.65 && p.level > 1) return { progress: { ...next, level: p.level - 1, recent: [] }, change: 'down' };
  return { progress: next, change: 'none' };
}
