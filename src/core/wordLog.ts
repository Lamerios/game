/**
 * «Судовой журнал»: one English vocabulary shared by every mini-game, with
 * spaced repetition (Leitner boxes).
 *
 * Why: spaced practice beats massed practice for word learning, including in
 * preschoolers (Cepeda et al., 2006; Vlach & Sandhofer, 2012), and recalling a
 * word beats seeing it again (Roediger & Karpicke, 2006). So a word met in the
 * Snake comes back a day later in the Race, three days later in the Logbook…
 *
 * Every game reports each English word it asked with `recordWord(id, ok, game)`;
 * games that pick words ask `dueWords()` first. Pure TS + localStorage, no Phaser.
 */

import { addAsk, loadStats, saveStats } from './wordStats';

/** Days until the next review, by box. Box 0 = met today, not learnt yet. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = BOX_DAYS.length - 1;
/** A word in this box or higher counts as learnt (it survived a 3-day gap). */
export const LEARNT_BOX = 3;
export const WORD_LOG_KEY = 'word-log';

const DAY = 24 * 60 * 60 * 1000;
/** A miss brings the word back soon, the same day (within the next game). */
const RETRY_MS = 10 * 60 * 1000;

export interface WordEntry {
  box: number;
  /** Epoch ms when the word is due for review. */
  due: number;
  /** Times asked / answered right first try / missed. */
  seen: number;
  right: number;
  wrong: number;
  /** First and last time met. */
  first: number;
  last: number;
  /** Games the word was met in. */
  games: string[];
}

export type WordLog = Record<string, WordEntry>;

export function readWordLog(): WordLog {
  try {
    const raw = localStorage.getItem(WORD_LOG_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as WordLog) : {};
  } catch {
    return {};
  }
}

function writeWordLog(log: WordLog) {
  try {
    localStorage.setItem(WORD_LOG_KEY, JSON.stringify(log));
  } catch {
    /* private mode: the log just isn't kept */
  }
}

/**
 * Pure step of the Leitner schedule. Answering right on time moves the word up
 * a box; answering right before it is due counts but doesn't move it (no credit
 * for massed repetition); a miss sends it back to box 1, due again soon.
 */
export function review(entry: WordEntry | undefined, ok: boolean, game: string, now: number): WordEntry {
  const e: WordEntry = entry
    ? { ...entry, games: entry.games.includes(game) ? entry.games : [...entry.games, game] }
    : { box: 0, due: now, seen: 0, right: 0, wrong: 0, first: now, last: now, games: [game] };
  e.seen++;
  e.last = now;
  if (!ok) {
    e.wrong++;
    e.box = Math.min(e.box, 1);
    e.due = now + RETRY_MS;
    return e;
  }
  e.right++;
  if (!entry || now >= entry.due) e.box = Math.min(MAX_BOX, e.box + 1);
  e.due = now + BOX_DAYS[e.box]! * DAY;
  return e;
}

/** Records one asked word: `ok` = picked / said right on the first try. */
/**
 * Records one ask of an English word, in both books: the review schedule here
 * and the parents' word statistics (core/wordStats). `wrong` = what was picked
 * instead, when the game knows it; a miss without it counts as one miss.
 */
export function recordWord(id: string, ok: boolean, game: string, now = Date.now(), wrong?: readonly string[]): WordEntry {
  const log = readWordLog();
  const e = review(log[id], ok, game, now);
  log[id] = e;
  writeWordLog(log);
  saveStats(addAsk(loadStats(), id, wrong ?? (ok ? [] : ['']), now));
  return e;
}

/** Russian labels for the parents' screen, for words that aren't Snake pictures. */
const RU_LABEL: Record<string, string> = {
  'dir.north': 'север', 'dir.south': 'юг', 'dir.east': 'восток', 'dir.west': 'запад',
  'piece.k': 'король', 'piece.q': 'ферзь', 'piece.r': 'ладья', 'piece.b': 'слон', 'piece.n': 'конь', 'piece.p': 'пешка',
  'emo.happy': 'радостный', 'emo.sad': 'грустный', 'emo.angry': 'сердитый', 'emo.scared': 'испуганный', 'emo.surprised': 'удивлённый',
};
export function ruLabel(id: string): string {
  if (RU_LABEL[id]) return RU_LABEL[id]!;
  const n = /^n(\d+)$/.exec(id);
  return n ? `число ${n[1]}` : '';
}

/** Words due for review now, most overdue first. `pool` limits them to what a game can show. */
export function dueWords(now = Date.now(), pool?: readonly string[], log = readWordLog()): string[] {
  const allowed = pool ? new Set(pool) : undefined;
  return Object.entries(log)
    .filter(([id, e]) => e.due <= now && (!allowed || allowed.has(id)))
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

export interface LogSummary {
  /** Words ever met. */
  met: number;
  /** In LEARNT_BOX or higher. */
  learnt: number;
  /** Due now. */
  due: number;
  /** Words per box, index = box. */
  boxes: number[];
}

export function summary(now = Date.now(), log = readWordLog()): LogSummary {
  const boxes: number[] = BOX_DAYS.map(() => 0);
  let learnt = 0;
  let due = 0;
  for (const e of Object.values(log)) {
    boxes[e.box] = (boxes[e.box] ?? 0) + 1;
    if (e.box >= LEARNT_BOX) learnt++;
    if (e.due <= now) due++;
  }
  return { met: Object.keys(log).length, learnt, due, boxes };
}

/**
 * Words for a game of `n` rounds from `pool` (ordered simple → hard): due
 * reviews first, then up to `maxNew` new words, then the least-known ones
 * already met. Interleaving old and new is what makes the spacing work.
 */
export function planWords(pool: readonly string[], n: number, maxNew: number, rng: () => number, now = Date.now(), log = readWordLog()): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (out.length < n && !out.includes(id)) out.push(id);
  };
  dueWords(now, pool, log).forEach(add);
  const fresh = pool.filter((id) => !log[id]);
  fresh.slice(0, Math.min(maxNew, Math.max(0, n - out.length))).forEach(add);
  const met = pool
    .filter((id) => log[id] && !out.includes(id))
    .map((id) => ({ id, s: log[id]!.box + rng() * 1.5 }))
    .sort((a, b) => a.s - b.s)
    .map((x) => x.id);
  met.forEach(add);
  fresh.forEach(add);
  // Shuffle so reviews don't always come first.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
