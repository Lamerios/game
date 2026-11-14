import { int, pick, shuffle, type Rng } from '../common/rng';
import { PICTURES } from '../snake/logic';

/**
 * «Камбуз» (the galley), two short parts:
 *
 * 1. The cook's order: Pykhtelkin says 2–4 foods in English, once; the child
 *    brings them from the shelf. Holding a list in mind is working memory —
 *    trained here only together with useful words, since memory drills alone
 *    don't transfer (Melby-Lervåg & Hulme, 2013).
 * 2. Loading the hold: cards sorted by colour, then by shape, then by a cue on
 *    the card (black frame = shape). The Dimensional Change Card Sort, the
 *    standard task of cognitive flexibility at 5–6 (Zelazo, 2006).
 */

export const FOODS: readonly string[] = PICTURES.filter((w) => w.cat === 'fruit' || w.cat === 'food' || w.cat === 'vegetable').map((w) => w.id);

export interface OrderRound {
  order: string[];
  /** What is on the shelf: the order plus distractors. */
  shelf: string[];
}

/** Order length by level: 2, 3, 3, 4. */
export const orderLength = (level: number) => (level <= 1 ? 2 : level <= 3 ? 3 : 4);
export const MAX_LEVEL = 4;

export function planOrders(level: number, rng: Rng, rounds = 3, pool: readonly string[] = FOODS): OrderRound[] {
  return Array.from({ length: rounds }, () => {
    const all = shuffle(rng, pool);
    const n = orderLength(level);
    const order = all.slice(0, n);
    return { order, shelf: shuffle(rng, all.slice(0, n + (level <= 1 ? 3 : 4))) };
  });
}

/** Whether the tray holds exactly the order; `inOrder` also checks the sequence. */
export function checkTray(order: readonly string[], tray: readonly string[]) {
  const all = order.length === tray.length && order.every((id) => tray.includes(id));
  return { all, inOrder: all && order.every((id, i) => tray[i] === id) };
}

// ---------- card sort ----------

export type CardColor = 'red' | 'blue';
export type CardShape = 'star' | 'circle';
export type SortRule = 'color' | 'shape';
export interface Card {
  color: CardColor;
  shape: CardShape;
  /** Mixed part: a black frame means "sort by shape". */
  frame?: boolean;
}

/** The two bins: left is a red star, right a blue circle. Cards are the conflicting kinds. */
export const BINS: readonly Card[] = [{ color: 'red', shape: 'star' }, { color: 'blue', shape: 'circle' }];

export function ruleOf(card: Card, phase: SortRule | 'mixed'): SortRule {
  return phase === 'mixed' ? (card.frame ? 'shape' : 'color') : phase;
}

/** 0 = left bin, 1 = right bin. */
export function binFor(card: Card, rule: SortRule): 0 | 1 {
  return rule === 'color' ? (card.color === 'red' ? 0 : 1) : card.shape === 'star' ? 0 : 1;
}

export interface SortPhase {
  rule: SortRule | 'mixed';
  cards: Card[];
}

/** Colour, then shape (the switch), then mixed from level 2. Cards always conflict with the bins. */
export function planSort(level: number, rng: Rng): SortPhase[] {
  const conflict = (): Card => pick(rng, [{ color: 'red', shape: 'circle' }, { color: 'blue', shape: 'star' }] as Card[]);
  const phases: SortPhase[] = [
    { rule: 'color', cards: Array.from({ length: 5 }, conflict) },
    { rule: 'shape', cards: Array.from({ length: 5 }, conflict) },
  ];
  if (level >= 2) {
    const n = 6;
    const framed = shuffle(rng, Array.from({ length: n }, (_, i) => i < n / 2));
    phases.push({ rule: 'mixed', cards: framed.map((f) => ({ ...conflict(), frame: f })) });
  }
  // Never all cards of one kind in a phase.
  for (const p of phases) {
    if (p.cards.every((c) => c.color === p.cards[0]!.color)) {
      const i = int(rng, 0, p.cards.length - 1);
      const c = p.cards[i]!;
      p.cards[i] = { color: c.color === 'red' ? 'blue' : 'red', shape: c.shape === 'star' ? 'circle' : 'star', frame: c.frame };
    }
  }
  return phases;
}

export function nextLevel(level: number, accuracy: number) {
  if (accuracy >= 0.9) return Math.min(MAX_LEVEL, level + 1);
  if (accuracy < 0.6) return Math.max(1, level - 1);
  return level;
}
