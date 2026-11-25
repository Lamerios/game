/** Pure helpers for moving a focus ring between on-screen targets with arrows. */

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** How far apart two ranges are (0 when they overlap). */
const gap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, b0 - a1, a0 - b1);

/**
 * The best target in a direction, like spatial navigation on a TV: the target must lie
 * ahead of the current one, and among those the nearest wins, with sideways distance
 * counting triple so that the ring keeps to its row or column. -1 when nothing is there.
 */
export function pickNext(from: Rect, targets: Rect[], dir: Dir): number {
  const c = center(from);
  const horiz = dir === 'left' || dir === 'right';
  const sign = dir === 'right' || dir === 'down' ? 1 : -1;
  let best = -1;
  let bestScore = Infinity;
  targets.forEach((t, i) => {
    const tc = center(t);
    const ahead = ((horiz ? tc.x - c.x : tc.y - c.y) * sign);
    if (ahead < 8) return;
    // Distance along the way: from our far edge to their near edge, at least a little.
    const along = horiz
      ? Math.max(1, sign > 0 ? t.x - (from.x + from.w) : from.x - (t.x + t.w))
      : Math.max(1, sign > 0 ? t.y - (from.y + from.h) : from.y - (t.y + t.h));
    const side = horiz ? gap(from.y, from.y + from.h, t.y, t.y + t.h) : gap(from.x, from.x + from.w, t.x, t.x + t.w);
    const sideCenters = Math.abs(horiz ? tc.y - c.y : tc.x - c.x);
    // A target well off to the side only counts if it is more ahead than aside.
    if (side > 0 && sideCenters > ahead * 2.5) return;
    const score = along + side * 3 + sideCenters * 0.1;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/**
 * Where the ring starts: a target marked as preferred, else the one nearest the point
 * (screen center). Never a "Домой" button: a stray OK must not end the game. -1 if none.
 */
export function pickInitial(targets: { rect: Rect; preferred?: boolean; back?: boolean }[], near: { x: number; y: number }): number {
  const pref = targets.findIndex((t) => t.preferred);
  if (pref >= 0) return pref;
  let best = -1;
  let bestD = Infinity;
  targets.forEach((t, i) => {
    const c = center(t.rect);
    if (t.back) return;
    const d = Math.hypot(c.x - near.x, c.y - near.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** The target nearest to a point, to pick up again when the focused one disappears. */
export function pickNearest(targets: Rect[], p: { x: number; y: number }): number {
  let best = -1;
  let bestD = Infinity;
  targets.forEach((t, i) => {
    const c = center(t);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
