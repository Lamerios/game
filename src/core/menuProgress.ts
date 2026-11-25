/**
 * What the main menu shows as progress: stars collected in each game, how often
 * it was finished and when it was last played. Everything is derived from the
 * event log (core/analytics), so no game has to report anything extra: a
 * finished run (`run.end` with `completed`) counts.
 *
 * Stars of one finished run:
 *  - the game's own `stars` (0–3) when it gives them;
 *  - otherwise from `score / total` (≥ 90 % → 3, ≥ 60 % → 2, else 1);
 *  - otherwise 1 (Snake, the voyage: finishing is the achievement).
 *
 * Also picks Rumb's tip: which game the parrot suggests on the menu.
 */

import type { GameEvent } from './analytics';

export interface GameProgress {
  /** Stars collected over all finished runs. */
  stars: number;
  /** Finished runs. */
  plays: number;
  /** Epoch ms of the last run start or end, 0 when never played. */
  last: number;
}

export type ProgressMap = Record<string, GameProgress>;

const EMPTY: GameProgress = { stars: 0, plays: 0, last: 0 };

export const progressOf = (map: ProgressMap, game: string): GameProgress => map[game] ?? EMPTY;

/** Stars a finished run earns on the menu (see the file comment). */
export function runStars(data: GameEvent['data']): number {
  if (!data || data.completed === false) return 0;
  const s = data.stars;
  if (typeof s === 'number' && Number.isFinite(s)) return Math.max(0, Math.min(3, Math.round(s)));
  const { score, total } = data;
  if (typeof score === 'number' && typeof total === 'number' && total > 0) {
    const r = score / total;
    return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1;
  }
  return 1;
}

/** Adds one event to the map (in place). Only run.start / run.end matter. */
export function addEvent(map: ProgressMap, e: GameEvent): void {
  if (e.game === 'app' || e.game === 'menu') return;
  if (e.type !== 'run.start' && e.type !== 'run.end') return;
  const p = (map[e.game] ??= { stars: 0, plays: 0, last: 0 });
  p.last = Math.max(p.last, e.ts);
  if (e.type === 'run.end' && e.data?.completed !== false) {
    p.plays++;
    p.stars += runStars(e.data);
  }
}

export function progressFromEvents(events: readonly GameEvent[]): ProgressMap {
  const map: ProgressMap = {};
  for (const e of events) addEvent(map, e);
  return map;
}

export const totalStars = (map: ProgressMap) => Object.values(map).reduce((a, p) => a + p.stars, 0);

/**
 * Rumb's tip. A new game the child has not opened yet comes first (in menu
 * order); otherwise the game played longest ago (never played counts as
 * oldest), so the tip walks through every game instead of repeating the
 * favourite. The game just played is never the tip when there is another.
 */
export function pickTip(
  ids: readonly string[],
  map: ProgressMap,
  opts: { fresh?: readonly string[]; lastPlayed?: string } = {},
): string | undefined {
  const fresh = ids.find((id) => opts.fresh?.includes(id));
  if (fresh) return fresh;
  const pool = ids.length > 1 ? ids.filter((id) => id !== opts.lastPlayed) : ids;
  let best: string | undefined;
  let bestAt = Infinity;
  for (const id of pool) {
    const at = progressOf(map, id).last;
    if (at < bestAt) {
      best = id;
      bestAt = at;
    }
  }
  return best;
}

/** The game started most recently (ignores the menu and app events). */
export function lastPlayed(map: ProgressMap): string | undefined {
  let id: string | undefined;
  let at = 0;
  for (const [g, p] of Object.entries(map)) {
    if (p.last > at) {
      id = g;
      at = p.last;
    }
  }
  return id;
}
