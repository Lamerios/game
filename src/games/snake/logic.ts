import { shuffle, type Rng } from '../common/rng';

/**
 * Snake with English words: rules without Phaser, so they can be tested.
 * The board wraps at the edges and the snake may cross itself: nothing ends
 * the game early, a wrong picture only costs a moment.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Cell {
  x: number;
  y: number;
}

export const DIRS: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export type Category = 'fruit' | 'vegetable' | 'animal' | 'thing';
export interface Word {
  /** Also the picture (public/snake/<id>.webp) and the clip (en.<id>). */
  id: string;
  ru: string;
  cat: Category;
}

export const WORDS: readonly Word[] = [
  { id: 'apple', ru: 'яблоко', cat: 'fruit' },
  { id: 'banana', ru: 'банан', cat: 'fruit' },
  { id: 'orange', ru: 'апельсин', cat: 'fruit' },
  { id: 'pear', ru: 'груша', cat: 'fruit' },
  { id: 'grapes', ru: 'виноград', cat: 'fruit' },
  { id: 'strawberry', ru: 'клубника', cat: 'fruit' },
  { id: 'cherry', ru: 'вишня', cat: 'fruit' },
  { id: 'watermelon', ru: 'арбуз', cat: 'fruit' },
  { id: 'lemon', ru: 'лимон', cat: 'fruit' },
  { id: 'carrot', ru: 'морковка', cat: 'vegetable' },
  { id: 'tomato', ru: 'помидор', cat: 'vegetable' },
  { id: 'potato', ru: 'картошка', cat: 'vegetable' },
  { id: 'cucumber', ru: 'огурец', cat: 'vegetable' },
  { id: 'corn', ru: 'кукуруза', cat: 'vegetable' },
  { id: 'onion', ru: 'лук', cat: 'vegetable' },
  { id: 'cat', ru: 'кошка', cat: 'animal' },
  { id: 'dog', ru: 'собака', cat: 'animal' },
  { id: 'fish', ru: 'рыба', cat: 'animal' },
  { id: 'bird', ru: 'птица', cat: 'animal' },
  { id: 'cow', ru: 'корова', cat: 'animal' },
  { id: 'pig', ru: 'свинья', cat: 'animal' },
  { id: 'horse', ru: 'лошадь', cat: 'animal' },
  { id: 'frog', ru: 'лягушка', cat: 'animal' },
  { id: 'duck', ru: 'утка', cat: 'animal' },
  { id: 'rabbit', ru: 'кролик', cat: 'animal' },
  { id: 'bear', ru: 'медведь', cat: 'animal' },
  { id: 'lion', ru: 'лев', cat: 'animal' },
  { id: 'monkey', ru: 'обезьяна', cat: 'animal' },
  { id: 'elephant', ru: 'слон', cat: 'animal' },
  { id: 'mouse', ru: 'мышка', cat: 'animal' },
  { id: 'turtle', ru: 'черепаха', cat: 'animal' },
  { id: 'sun', ru: 'солнце', cat: 'thing' },
  { id: 'star', ru: 'звезда', cat: 'thing' },
  { id: 'ball', ru: 'мяч', cat: 'thing' },
  { id: 'car', ru: 'машина', cat: 'thing' },
  { id: 'house', ru: 'дом', cat: 'thing' },
  { id: 'tree', ru: 'дерево', cat: 'thing' },
  { id: 'flower', ru: 'цветок', cat: 'thing' },
  { id: 'boat', ru: 'кораблик', cat: 'thing' },
  { id: 'cake', ru: 'торт', cat: 'thing' },
  { id: 'egg', ru: 'яйцо', cat: 'thing' },
];

export const wordById = (id: string) => WORDS.find((w) => w.id === id)!;

const wrap = (v: number, n: number) => ((v % n) + n) % n;

export function stepHead(head: Cell, dir: Dir, cols: number, rows: number): Cell {
  const d = DIRS[dir];
  return { x: wrap(head.x + d.x, cols), y: wrap(head.y + d.y, rows) };
}

/** One step: a new head in front, the tail follows unless the snake grows. */
export function moveSnake(body: readonly Cell[], dir: Dir, grow: boolean, cols: number, rows: number): Cell[] {
  const next = [stepHead(body[0]!, dir, cols, rows), ...body];
  if (!grow) next.pop();
  return next;
}

/** Pictures per round: two at first, then three, then four. */
export const itemsForRound = (round: number) => (round < 3 ? 2 : round < 7 ? 3 : 4);

/**
 * Free cells for `n` pictures: off the snake, not right in front of its head
 * (no accidental bites as a round starts), and apart from each other so the big
 * pictures never overlap.
 */
export function placeItems(n: number, body: readonly Cell[], dir: Dir, cols: number, rows: number, rng: Rng): Cell[] {
  const head = body[0]!;
  const blocked = new Set(body.map((c) => `${c.x},${c.y}`));
  let c = head;
  for (let i = 0; i < 4; i++) {
    c = stepHead(c, dir, cols, rows);
    blocked.add(`${c.x},${c.y}`);
  }
  const all: Cell[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) all.push({ x, y });
  const out: Cell[] = [];
  for (const cell of shuffle(rng, all)) {
    if (out.length === n) break;
    if (blocked.has(`${cell.x},${cell.y}`)) continue;
    if (Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y) < 3) continue;
    if (out.some((o) => Math.abs(o.x - cell.x) < 2 && Math.abs(o.y - cell.y) < 2)) continue;
    out.push(cell);
  }
  return out;
}

/**
 * Words for one game: the least practised first (with some shuffle), so new
 * words keep coming and the tricky ones come back. `stats` = id → times eaten
 * right on the first try.
 */
export function pickWords(stats: Record<string, number>, n: number, rng: Rng): string[] {
  return shuffle(rng, WORDS)
    .map((w) => ({ id: w.id, score: (stats[w.id] ?? 0) + rng() * 1.5 }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map((w) => w.id);
}

/** Other pictures to choose from; in later rounds one is from the same group (fruit among fruit). */
export function distractors(target: string, k: number, round: number, rng: Rng): string[] {
  const t = wordById(target);
  const others = shuffle(rng, WORDS.filter((w) => w.id !== target));
  const out: string[] = [];
  if (round >= 5) {
    const same = others.find((w) => w.cat === t.cat);
    if (same) out.push(same.id);
  }
  for (const w of others) {
    if (out.length >= k) break;
    if (!out.includes(w.id)) out.push(w.id);
  }
  return out.slice(0, k);
}
