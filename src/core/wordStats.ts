/**
 * English word statistics for parents, shared by every game that asks the
 * child for an English word (Snake now; other games call recordWord too).
 * Kept in localStorage, per device, apart from the voyage profile.
 *
 * One "ask" = the game said a word and waited until the child found it.
 * firstTry = found it with no wrong pick; misses = wrong picks while it was asked;
 * confused = what the child picked instead, and how often.
 */

export interface WordStat {
  asked: number;
  firstTry: number;
  misses: number;
  confused: Record<string, number>;
  /** ms timestamp of the last ask. */
  last: number;
}

export type WordStats = Record<string, WordStat>;

/** Found on the first try this many times = learnt. */
export const LEARNT_AT = 3;

export const STATS_KEY = 'english-words';
/** Snake's first version kept only first-try counts under this key. */
const OLD_SNAKE_KEY = 'snake-words';

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): Store | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

const empty = (): WordStat => ({ asked: 0, firstTry: 0, misses: 0, confused: {}, last: 0 });

export function loadStats(store = defaultStore()): WordStats {
  if (!store) return {};
  try {
    const raw = store.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw) as WordStats;
    // Carry over what Snake counted before (first tries only).
    const old = store.getItem(OLD_SNAKE_KEY);
    if (!old) return {};
    const out: WordStats = {};
    for (const [id, n] of Object.entries(JSON.parse(old) as Record<string, number>)) {
      out[id] = { ...empty(), asked: n, firstTry: n };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveStats(stats: WordStats, store = defaultStore()) {
  try {
    store?.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* private mode or full storage: stats just aren't kept */
  }
}

/** Adds one finished ask to `stats` (mutates and returns it). `wrong` = what was picked instead, in order. */
export function addAsk(stats: WordStats, id: string, wrong: readonly string[], now = Date.now()): WordStats {
  const s = (stats[id] ??= empty());
  s.asked++;
  if (wrong.length === 0) s.firstTry++;
  s.misses += wrong.length;
  for (const w of wrong) s.confused[w] = (s.confused[w] ?? 0) + 1;
  s.last = now;
  return stats;
}

/** Records one finished ask and saves. */
export function recordWord(id: string, wrong: readonly string[], store = defaultStore()) {
  saveStats(addAsk(loadStats(store), id, wrong), store);
}

/** First-try counts, which is what word pickers use to choose new / learning / known words. */
export function firstTries(stats: WordStats): Record<string, number> {
  return Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, s.firstTry]));
}

export type Status = 'learnt' | 'learning' | 'hard';

export interface Row {
  id: string;
  stat: WordStat;
  /** Share of asks found on the first try, 0..1. */
  accuracy: number;
  status: Status;
  /** The word picked instead most often. */
  topConfusion?: string;
}

/**
 * Rows for the parent screen: hardest first (lowest first-try share, then most
 * misses), learnt words last. "Hard" = asked at least twice and found on the
 * first try less than half the time.
 */
export function report(stats: WordStats): { rows: Row[]; asked: number; firstTry: number; learnt: number; hard: number } {
  const rows: Row[] = Object.entries(stats)
    .filter(([, s]) => s.asked > 0)
    .map(([id, s]) => {
      const accuracy = s.firstTry / s.asked;
      const status: Status = s.firstTry >= LEARNT_AT ? 'learnt' : s.asked >= 2 && accuracy < 0.5 ? 'hard' : 'learning';
      const top = Object.entries(s.confused).sort((a, b) => b[1] - a[1])[0]?.[0];
      return { id, stat: s, accuracy, status, topConfusion: top };
    });
  const rank: Record<Status, number> = { hard: 0, learning: 1, learnt: 2 };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || a.accuracy - b.accuracy || b.stat.misses - a.stat.misses || a.id.localeCompare(b.id));
  return {
    rows,
    asked: rows.reduce((n, r) => n + r.stat.asked, 0),
    firstTry: rows.reduce((n, r) => n + r.stat.firstTry, 0),
    learnt: rows.filter((r) => r.status === 'learnt').length,
    hard: rows.filter((r) => r.status === 'hard').length,
  };
}
