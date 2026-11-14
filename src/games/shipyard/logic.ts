import { int, pick, shuffle, type Rng } from '../common/rng';

/**
 * «Верфь»: build a boat out of blocks. First copy a blueprint (spatial copying,
 * like block building, goes with later math — Verdine et al., 2014), then
 * follow the shipwright's English orders: "Add two red blocks!" — colour words
 * and numbers that have to be understood to act (comprehension before speech).
 */

export const BLOCKS = ['red', 'blue', 'yellow', 'green', 'white'] as const;
export type Block = (typeof BLOCKS)[number];
export const PAINT: Record<Block, number> = { red: 0xe63946, blue: 0x277da1, yellow: 0xffd166, green: 0x52b788, white: 0xf8f9fa };
const CODE: Record<string, Block> = { r: 'red', b: 'blue', y: 'yellow', g: 'green', w: 'white' };

export const COLS = 6;
export const ROWS = 5;
/** null = empty cell. Row 0 is the top. */
export type Grid = (Block | null)[][];

/** Blueprints as rows of letters, '.' is empty. Small ones first. */
export const BLUEPRINTS: Record<number, string[][]> = {
  1: [
    ['......', '......', '..w...', '.bbbb.', '..bb..'],
    ['......', '......', '...r..', '.yyyy.', '..yy..'],
    ['......', '......', '..g...', 'rrrr..', '.rr...'],
  ],
  2: [
    ['......', '...r..', '...w..', 'bbbbbb', '.bbbb.'],
    ['......', '..y...', '..ww..', 'rrrrrr', '.rrrr.'],
    ['......', '...g..', '..www.', '.bbbb.', '..bb..'],
  ],
  3: [
    ['...r..', '..ww..', '..www.', 'yyyyyy', '.bbbb.'],
    ['..gg..', '..w...', '.ww.w.', 'rrrrrr', '.bbbb.'],
    ['.r..r.', '.w..w.', 'wwwwww', 'bbbbbb', '.yyyy.'],
  ],
};
export const MAX_LEVEL = 4;

export function parse(rows: string[]): Grid {
  return rows.map((r) => [...r].map((c) => CODE[c] ?? null));
}

export const emptyGrid = (): Grid => Array.from({ length: ROWS }, () => Array<Block | null>(COLS).fill(null));

export function pickBlueprint(level: number, rng: Rng): Grid {
  return parse(pick(rng, BLUEPRINTS[Math.min(3, level)]!));
}

/** Cells that differ: missing (should be there), extra (should be empty), wrong colour. */
export function compare(target: Grid, built: Grid) {
  let missing = 0;
  let extra = 0;
  let wrong = 0;
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const t = target[y]![x];
      const b = built[y]![x];
      if (t && !b) missing++;
      else if (!t && b) extra++;
      else if (t && b && t !== b) wrong++;
    }
  return { missing, extra, wrong, ok: missing + extra + wrong === 0 };
}

export interface Order {
  color: Block;
  count: number;
}

/** The English orders after the blueprint: at level 1 none, then 2–3 orders, counts growing. */
export function planOrders(level: number, rng: Rng): Order[] {
  if (level < 2) return [];
  const n = level >= 4 ? 3 : 2;
  const maxCount = level >= 3 ? 4 : 3;
  return shuffle(rng, [...BLOCKS]).slice(0, n).map((color) => ({ color, count: int(rng, 1, maxCount) }));
}

export const orderLine = (o: Order) => `ship.${o.count}.${o.color}`;
export const NUM_WORD = ['zero', 'one', 'two', 'three', 'four'];

/** What a built cargo row has, by colour. */
export function countColors(cells: (Block | null)[]) {
  const c: Partial<Record<Block, number>> = {};
  for (const b of cells) if (b) c[b] = (c[b] ?? 0) + 1;
  return c;
}

export function checkOrder(o: Order, cells: (Block | null)[]) {
  const c = countColors(cells);
  const others = Object.entries(c).filter(([k]) => k !== o.color).reduce((s, [, v]) => s + (v ?? 0), 0);
  const got = c[o.color] ?? 0;
  return { ok: got === o.count && others === 0, got, others };
}

export function nextLevel(level: number, clean: boolean, poor: boolean) {
  return clean ? Math.min(MAX_LEVEL, level + 1) : poor ? Math.max(1, level - 1) : level;
}
