import type { GameEvent } from '../../core/analytics';
import { int, pick, shuffle, type Rng } from '../common/rng';

/**
 * «Тир канонира Пломбира»: rules without Phaser, so they can be tested.
 *
 * The walrus names a target (an English word, a sum, a shape by its features,
 * a cell of the sea-battle grid) and the child hits the right one. Targets are
 * things only: bottles, balloons, sails, tin boards. Weapons are toys (water,
 * bubbles, confetti, fireworks) and are opened by achievements in the other games,
 * read from the event log.
 */

export const GAME_ID = 'range';
export const MAX_LEVEL = 6;
export const TASKS_PER_ROUND = 8;
/** Shots on top of one per task: enough to miss a few, too few to spray at everything. */
export const SPARE_AMMO = 5;
export const RELOAD_AMMO = 6;

// ---------- weapons ----------

export type WeaponId = 'water' | 'bubble' | 'twins' | 'cannon' | 'blaster' | 'confetti' | 'mortar' | 'golden';

export interface Weapon {
  id: WeaponId;
  name: string;
  /** One line on how it shoots, for the arsenal card. */
  how: string;
  /** Flight time to a point: fixed for arcs, by distance for straight shots. */
  flight: { arc: boolean; ms: number; perPx: number };
  /** Splash radius: how close to a target's centre the shot must land. */
  radius: number;
  /** Projectiles per trigger pull, spread sideways. */
  shots: number;
  /** Ammo per trigger pull (the confetti gun fires in bursts of small shots). */
  cost: number;
  /** Fires while the finger is held. */
  auto?: boolean;
  /** Delay between pulls, ms. */
  cooldown: number;
  color: number;
}

export const WEAPONS: readonly Weapon[] = [
  { id: 'water', name: 'Водяной пистолет', how: 'Струя воды', flight: { arc: false, ms: 120, perPx: 0.35 }, radius: 34, shots: 1, cost: 1, cooldown: 350, color: 0x4cc9f0 },
  { id: 'bubble', name: 'Пузырьковый пистолет', how: 'Большие медленные пузыри', flight: { arc: false, ms: 300, perPx: 0.8 }, radius: 58, shots: 1, cost: 1, cooldown: 450, color: 0xb8f2e6 },
  { id: 'twins', name: 'Два пистолета-присоски', how: 'Две присоски сразу', flight: { arc: false, ms: 110, perPx: 0.32 }, radius: 30, shots: 2, cost: 1, cooldown: 400, color: 0xf15bb5 },
  { id: 'cannon', name: 'Пиратская пушка', how: 'Ядро летит дугой: целься вперёд', flight: { arc: true, ms: 900, perPx: 0 }, radius: 62, shots: 1, cost: 1, cooldown: 700, color: 0x495057 },
  { id: 'blaster', name: 'Бластер', how: 'Луч летит мгновенно', flight: { arc: false, ms: 40, perPx: 0 }, radius: 28, shots: 1, cost: 1, cooldown: 300, color: 0x80ffdb },
  { id: 'confetti', name: 'Автомат с конфетти', how: 'Держи палец: очередь', flight: { arc: false, ms: 90, perPx: 0.3 }, radius: 26, shots: 1, cost: 0.25, auto: true, cooldown: 110, color: 0xffd166 },
  { id: 'mortar', name: 'Мортира-салют', how: 'Высокий салют, большой взрыв', flight: { arc: true, ms: 1100, perPx: 0 }, radius: 90, shots: 1, cost: 1, cooldown: 800, color: 0x9d4edd },
  { id: 'golden', name: 'Золотая пушка капитана', how: 'Быстрое золотое ядро', flight: { arc: true, ms: 520, perPx: 0 }, radius: 78, shots: 1, cost: 1, cooldown: 450, color: 0xffb703 },
];

export const weapon = (id: WeaponId) => WEAPONS.find((w) => w.id === id)!;

export function flightMs(w: Weapon, dist: number): number {
  return Math.round(w.flight.ms + w.flight.perPx * dist);
}

// ---------- achievements from the event log ----------

/** What the child has done in the other games (the range itself does not count, except for the golden cannon). */
export interface Achievements {
  /** Games with a ★★★ finish. */
  starGames: string[];
  /** Games played to the end at least once. */
  finished: string[];
  /** Right answers in all other games together. */
  correct: number;
  /** Best range result: highest level finished with ★★★ (0 if none). */
  rangeTopLevel: number;
}

const NOT_GAMES = new Set(['app', GAME_ID]);

export function achievementsFrom(events: readonly GameEvent[]): Achievements {
  const stars = new Set<string>();
  const finished = new Set<string>();
  let correct = 0;
  let rangeTop = 0;
  for (const e of events) {
    if (e.type === 'run.end' && e.data?.completed === true) {
      const s = Number(e.data.stars ?? 0);
      if (e.game === GAME_ID) {
        if (s >= 3) rangeTop = Math.max(rangeTop, Number(e.data.level ?? 0));
        continue;
      }
      if (NOT_GAMES.has(e.game)) continue;
      finished.add(e.game);
      if (s >= 3) stars.add(e.game);
    } else if (e.type === 'answer' && e.data?.correct === true && !NOT_GAMES.has(e.game)) {
      correct++;
    }
  }
  return { starGames: [...stars].sort(), finished: [...finished].sort(), correct, rangeTopLevel: rangeTop };
}

export interface Unlock {
  id: WeaponId;
  /** The condition, as the arsenal card says it. */
  rule: string;
  open: boolean;
  /** Progress for the card: «1 из 3». */
  have: number;
  need: number;
}

export const GOLDEN_LEVEL = 5;
export const CONFETTI_ANSWERS = 150;

export function unlocks(a: Achievements, ever: readonly WeaponId[] = []): Unlock[] {
  const has = (g: string, list: string[]) => (list.includes(g) ? 1 : 0);
  const base: Unlock[] = [
    { id: 'water', rule: 'Есть сразу', open: true, have: 1, need: 1 },
    { id: 'bubble', rule: '★★★ в трёх разных играх', open: false, have: Math.min(3, a.starGames.length), need: 3 },
    { id: 'twins', rule: 'Пройди до конца 5 разных игр', open: false, have: Math.min(5, a.finished.length), need: 5 },
    { id: 'cannon', rule: '★★★ в «Гонке слов» или «Полёте слов»', open: false, have: Math.min(1, has('race', a.starGames) + has('flight', a.starGames)), need: 1 },
    { id: 'blaster', rule: 'Пройди до конца «Змейку» и «Посылку»', open: false, have: has('snake', a.finished) + has('parcel', a.finished), need: 2 },
    { id: 'confetti', rule: `${CONFETTI_ANSWERS} верных ответов в других играх`, open: false, have: Math.min(CONFETTI_ANSWERS, a.correct), need: CONFETTI_ANSWERS },
    { id: 'mortar', rule: '★★★ в «Верфи» или «Порванной карте»', open: false, have: Math.min(1, has('shipyard', a.starGames) + has('mappuzzle', a.starGames)), need: 1 },
  ];
  for (const u of base) u.open = u.open || u.have >= u.need || ever.includes(u.id);
  const others = base.filter((u) => u.open).length;
  const top = a.rangeTopLevel >= GOLDEN_LEVEL ? 1 : 0;
  base.push({
    id: 'golden',
    rule: `Открой всё оружие и пройди тир на ★★★ на уровне ${GOLDEN_LEVEL}`,
    open: ever.includes('golden') || (others === base.length && top === 1),
    have: others + top,
    need: base.length + 1,
  });
  return base;
}

// ---------- tasks ----------

export type Color = 'red' | 'blue' | 'green' | 'yellow';
export type Shape = 'circle' | 'square' | 'triangle' | 'star';
export type Size = 'big' | 'small';
export const COLORS: readonly Color[] = ['red', 'blue', 'green', 'yellow'];
export const SHAPES: readonly Shape[] = ['circle', 'square', 'triangle', 'star'];

/** What is drawn on one target. */
export type Face =
  | { kind: 'word'; id: string }
  | { kind: 'number'; n: number }
  | { kind: 'shape'; color: Color; shape: Shape; size: Size };

export type Task =
  | { kind: 'word'; word: string; faces: Face[]; answer: number }
  | { kind: 'sum'; a: number; b: number; op: '+' | '-'; faces: Face[]; answer: number }
  | { kind: 'attr'; color?: Color; shape?: Shape; size?: Size; not?: Color; faces: Face[]; answer: number }
  | { kind: 'grid'; col: number; row: number; cols: number; rows: number };

export type TaskKind = Task['kind'];

export interface LevelSpec {
  kinds: TaskKind[];
  targets: number;
  /** Target speed, px/s (0 = standing still). */
  speed: number;
  /** Ships in lanes (they all move) instead of a shelf and balloons. */
  ships: boolean;
  /** A ghost circle shows where a moving target will be when the shot lands. */
  aimHelp: boolean;
  sumMax: number;
  minus: boolean;
  attrSize: boolean;
  attrNot: boolean;
  grid: number;
  /** English text under word pictures (reading support). */
  showWord: boolean;
}

export const LEVELS: Record<number, LevelSpec> = {
  1: { kinds: ['word', 'word', 'sum', 'word'], targets: 3, speed: 0, ships: false, aimHelp: true, sumMax: 5, minus: false, attrSize: false, attrNot: false, grid: 0, showWord: true },
  2: { kinds: ['word', 'sum', 'attr'], targets: 4, speed: 35, ships: false, aimHelp: true, sumMax: 10, minus: false, attrSize: false, attrNot: false, grid: 0, showWord: true },
  3: { kinds: ['word', 'sum', 'attr'], targets: 4, speed: 80, ships: true, aimHelp: true, sumMax: 10, minus: true, attrSize: false, attrNot: false, grid: 0, showWord: false },
  4: { kinds: ['word', 'sum', 'attr', 'grid'], targets: 4, speed: 110, ships: true, aimHelp: false, sumMax: 10, minus: true, attrSize: true, attrNot: false, grid: 4, showWord: false },
  5: { kinds: ['word', 'sum', 'attr', 'grid'], targets: 5, speed: 140, ships: true, aimHelp: false, sumMax: 20, minus: true, attrSize: true, attrNot: true, grid: 5, showWord: false },
  6: { kinds: ['word', 'sum', 'attr', 'grid'], targets: 5, speed: 180, ships: true, aimHelp: false, sumMax: 20, minus: true, attrSize: true, attrNot: true, grid: 5, showWord: false },
};

export const spec = (level: number) => LEVELS[Math.max(1, Math.min(MAX_LEVEL, Math.round(level)))]!;

/**
 * Words with pictures that are fine to aim at: things, food, toys, transport.
 * No animals or body parts.
 */
export const RANGE_WORDS: readonly string[] = [
  'apple', 'banana', 'orange', 'pear', 'grapes', 'strawberry', 'cherry', 'watermelon', 'lemon',
  'carrot', 'tomato', 'potato', 'cucumber', 'corn', 'onion',
  'ball', 'balloon', 'book', 'bus', 'car', 'boat', 'bicycle', 'cake', 'candy', 'cookie', 'cheese', 'bread',
  'chair', 'clock', 'cloud', 'crown', 'cap', 'door', 'backpack', 'chocolate', 'bed',
];

const sameWord = (f: Face, id: string) => f.kind === 'word' && f.id === id;

function wordTask(s: LevelSpec, rng: Rng, pool: readonly string[], used: Set<string>): Task {
  const fresh = pool.filter((w) => !used.has(w));
  const word = pick(rng, fresh.length ? fresh : pool);
  used.add(word);
  const others = shuffle(rng, pool.filter((w) => w !== word)).slice(0, s.targets - 1);
  const faces = shuffle(rng, [word, ...others]).map((id): Face => ({ kind: 'word', id }));
  return { kind: 'word', word, faces, answer: faces.findIndex((f) => sameWord(f, word)) };
}

function sumTask(s: LevelSpec, rng: Rng): Task {
  const minus = s.minus && rng() < 0.4;
  let a: number;
  let b: number;
  if (minus) {
    a = int(rng, 3, s.sumMax);
    b = int(rng, 1, a - 1);
  } else {
    a = int(rng, 1, s.sumMax - 1);
    b = int(rng, 1, s.sumMax - a);
  }
  const res = minus ? a - b : a + b;
  // Distractors: the near misses a child makes (±1, ±2, the other operation, one of the addends).
  const near = [res - 1, res + 1, res + 2, res - 2, minus ? a + b : Math.abs(a - b), a, b];
  const opts = [...new Set(near.filter((n) => n >= 0 && n <= 20 && n !== res))];
  const distract = shuffle(rng, opts).slice(0, s.targets - 1);
  for (let n = 0; distract.length < s.targets - 1 && n <= 20; n++) if (n !== res && !distract.includes(n)) distract.push(n);
  const faces = shuffle(rng, [res, ...distract]).map((n): Face => ({ kind: 'number', n }));
  return { kind: 'sum', a, b, op: minus ? '-' : '+', faces, answer: faces.findIndex((f) => f.kind === 'number' && f.n === res) };
}

function matches(f: Face, t: { color?: Color; shape?: Shape; size?: Size; not?: Color }) {
  if (f.kind !== 'shape') return false;
  if (t.not) return f.color !== t.not;
  return (!t.color || f.color === t.color) && (!t.shape || f.shape === t.shape) && (!t.size || f.size === t.size);
}

function attrTask(s: LevelSpec, rng: Rng): Task {
  const randFace = (): Face => ({ kind: 'shape', color: pick(rng, COLORS), shape: pick(rng, SHAPES), size: s.attrSize ? pick(rng, ['big', 'small'] as const) : 'big' });
  if (s.attrNot && rng() < 0.35) {
    // "Not red!": every target is red but one.
    const not = pick(rng, COLORS);
    const odd: Face = { kind: 'shape', color: pick(rng, COLORS.filter((c) => c !== not)), shape: pick(rng, SHAPES), size: 'big' };
    const rest = Array.from({ length: s.targets - 1 }, (): Face => ({ kind: 'shape', color: not, shape: pick(rng, SHAPES), size: s.attrSize ? pick(rng, ['big', 'small'] as const) : 'big' }));
    const faces = shuffle(rng, [odd, ...rest]);
    return { kind: 'attr', not, faces, answer: faces.indexOf(odd) };
  }
  const want = randFace() as Extract<Face, { kind: 'shape' }>;
  // Which features the walrus names: two of them (size only where sizes differ), so a single feature never decides alone.
  const named: { color?: Color; shape?: Shape; size?: Size } = { color: want.color, shape: want.shape };
  if (s.attrSize) named.size = want.size;
  const faces: Face[] = [want];
  // Distractors share one named feature with the answer: hits on "only red" or "only star" are real confusions.
  let guard = 0;
  while (faces.length < s.targets && guard++ < 200) {
    const f = randFace() as Extract<Face, { kind: 'shape' }>;
    if (rng() < 0.5) f.color = want.color;
    else f.shape = want.shape;
    if (matches(f, named)) continue;
    if (faces.some((g) => g.kind === 'shape' && g.color === f.color && g.shape === f.shape && g.size === f.size)) continue;
    faces.push(f);
  }
  const all = shuffle(rng, faces);
  return { kind: 'attr', ...named, faces: all, answer: all.indexOf(want) };
}

function gridTask(s: LevelSpec, rng: Rng): Task {
  return { kind: 'grid', col: int(rng, 0, s.grid - 1), row: int(rng, 0, s.grid - 1), cols: s.grid, rows: s.grid };
}

/** One round: TASKS_PER_ROUND tasks, kinds dealt evenly from the level's list, no two sea battles in a row. */
export function planRound(level: number, rng: Rng, words: readonly string[] = RANGE_WORDS): Task[] {
  const s = spec(level);
  const used = new Set<string>();
  const kinds: TaskKind[] = [];
  while (kinds.length < TASKS_PER_ROUND) kinds.push(...shuffle(rng, s.kinds));
  kinds.length = TASKS_PER_ROUND;
  // Start with a word: the easiest way in.
  const firstWord = kinds.indexOf('word');
  if (firstWord > 0) [kinds[0], kinds[firstWord]] = [kinds[firstWord]!, kinds[0]!];
  for (let i = 1; i < kinds.length; i++) {
    if (kinds[i] === 'grid' && kinds[i - 1] === 'grid') {
      const j = kinds.findIndex((k, n) => n > i && k !== 'grid');
      if (j > 0) [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
    }
  }
  return kinds.map((k) => (k === 'word' ? wordTask(s, rng, words, used) : k === 'sum' ? sumTask(s, rng) : k === 'attr' ? attrTask(s, rng) : gridTask(s, rng)));
}

export const COL_NAMES = ['A', 'B', 'C', 'D', 'E'] as const;
export const cellName = (col: number, row: number) => `${COL_NAMES[col]}${row + 1}`;

/** Item id for the event log. */
export function itemOf(t: Task): string {
  switch (t.kind) {
    case 'word':
      return t.word;
    case 'sum':
      return `${t.a}${t.op}${t.b}`;
    case 'attr':
      return t.not ? `not-${t.not}` : [t.size, t.color, t.shape].filter(Boolean).join('-');
    case 'grid':
      return cellName(t.col, t.row);
  }
}

export function faceId(f: Face): string {
  return f.kind === 'word' ? f.id : f.kind === 'number' ? String(f.n) : `${f.size}-${f.color}-${f.shape}`;
}

// ---------- aiming ----------

/** Where a target moving at vx (px/s) along a lane of [x0, x1) will be in ms, wrapping at the ends. */
export function leadX(x: number, vx: number, ms: number, x0: number, x1: number): number {
  const span = x1 - x0;
  const nx = x + (vx * ms) / 1000 - x0;
  return x0 + (((nx % span) + span) % span);
}

/** The target hit by a shot landing at (x, y): the nearest one within reach, or -1. */
export function hitTest(x: number, y: number, radius: number, targets: readonly { x: number; y: number; r: number }[]): number {
  let best = -1;
  let bestD = Infinity;
  targets.forEach((t, i) => {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d <= radius + t.r * 0.6 && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

export function starsFor(right: number, total: number, reloaded: boolean): number {
  const acc = total ? right / total : 0;
  const s = acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : 1;
  return reloaded ? Math.min(2, s) : s;
}

// ---------- saved progress ----------

export interface RangeSave {
  level: number;
  weapon: WeaponId;
  /** Weapons the child has already been shown as opened (a new one gets a fanfare once). */
  seen: WeaponId[];
}

export const SAVE_KEY = 'range-progress';

export function readSave(raw: string | null): RangeSave {
  try {
    const v = JSON.parse(raw ?? '{}') as Partial<RangeSave>;
    const level = Number(v.level);
    const ids = new Set(WEAPONS.map((w) => w.id));
    return {
      level: level >= 1 && level <= MAX_LEVEL ? Math.round(level) : 1,
      weapon: v.weapon && ids.has(v.weapon) ? v.weapon : 'water',
      seen: (Array.isArray(v.seen) ? v.seen : []).filter((w): w is WeaponId => ids.has(w as WeaponId)),
    };
  } catch {
    return { level: 1, weapon: 'water', seen: [] };
  }
}
