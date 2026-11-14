import { createStore, entries, setMany, clear, delMany, keys, type UseStore } from 'idb-keyval';

/**
 * Event log for parents and for improvement cycles ("what happened, when, how well").
 *
 * Local only: events live in this browser's IndexedDB and leave it only when a
 * parent exports them (JSON/CSV) from the parent dashboard. No names, no free
 * text from the child: game ids, item ids, numbers and short codes.
 *
 * Mini-games use one small API:
 *
 *   const run = startRun('snake', { mode: 'words' });       // a game started
 *   run.ask('apple');                                       // a question (starts the answer timer)
 *   run.answer({ item: 'apple', correct: true });            // every answer / choice
 *   run.event('hint', { step: 2 });                          // anything else worth counting
 *   run.end({ completed: true, stars: 3, score: 10 });       // finished (or left: completed false)
 *
 * A run that is never ended (the child closed the tab, went "Домой") is closed as
 * abandoned automatically on the next startRun of the same game or when the page hides.
 * The event dictionary is in docs/analytics.md.
 */

export type Primitive = string | number | boolean | null;
export type EventData = Record<string, Primitive | undefined>;

/** One stored event. Kept flat so it exports to CSV as is. */
export interface GameEvent {
  /** Schema version of the event record. */
  v: 1;
  /** Epoch ms. */
  ts: number;
  /** One app launch (page load). */
  app: string;
  /** One play-through of a game, if the event belongs to one. */
  run?: string;
  /** Registry id of the game ('snake', 'race', 'voyage', …) or 'app'. */
  game: string;
  /** 'app.open', 'run.start', 'answer', 'run.end', 'hint', 'pit_stop', … */
  type: string;
  data?: Record<string, Primitive>;
}

export interface AnswerData {
  /** What was asked: word id, task id, level item. */
  item: string;
  correct: boolean;
  /** Whether this is the first answer to this item in the run (no earlier mistakes). */
  firstTry?: boolean;
  /** What the child picked when wrong (word id, number…), for confusion stats. */
  chosen?: string;
  /** Time from the question to this answer. */
  ms?: number;
  level?: number;
  skill?: string;
  hints?: number;
  [k: string]: Primitive | undefined;
}

export interface RunEnd {
  /** True when the child reached the end; false when they left in the middle. */
  completed?: boolean;
  stars?: number;
  score?: number;
  [k: string]: Primitive | undefined;
}

export interface Run {
  readonly id: string;
  readonly game: string;
  /** A question was put to the child: starts the response timer for the next answer. */
  ask(item: string, data?: EventData): void;
  answer(a: AnswerData): void;
  event(type: string, data?: EventData): void;
  end(result?: RunEnd): void;
  readonly ended: boolean;
}

const SCHEMA = 1;
/** Keeps the log bounded on a phone: the oldest events go first. ~60 bytes each in IDB. */
export const MAX_EVENTS = 60_000;
const FLUSH_MS = 1500;

const rid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

function clean(d?: EventData): Record<string, Primitive> | undefined {
  if (!d) return undefined;
  const out: Record<string, Primitive> = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) out[k] = typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  return Object.keys(out).length ? out : undefined;
}

/** Storage and buffering. One instance per page (`analytics` below); tests make their own. */
export class Analytics {
  readonly app = rid();
  private store?: UseStore;
  private buffer: [string, GameEvent][] = [];
  private seq = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private open = new Map<string, RunImpl>();
  private listeners: ((e: GameEvent) => void)[] = [];
  /** Set from the dashboard etc.; no-op when IndexedDB is missing (private mode on old Safari). */
  enabled = typeof indexedDB !== 'undefined';

  constructor(private readonly dbName = 'yunga-events', private readonly now = () => Date.now()) {}

  private db(): UseStore {
    this.store ??= createStore(this.dbName, 'events');
    return this.store;
  }

  /** Low-level: log one event. Prefer startRun()/Run for game events. */
  log(game: string, type: string, data?: EventData, run?: string): GameEvent {
    const e: GameEvent = { v: SCHEMA, ts: this.now(), app: this.app, game, type };
    if (run) e.run = run;
    const d = clean(data);
    if (d) e.data = d;
    // Sortable key: time, then a counter for events in the same millisecond.
    const key = `${e.ts.toString(36).padStart(9, '0')}-${(this.seq++).toString(36).padStart(4, '0')}`;
    this.buffer.push([key, e]);
    this.listeners.forEach((l) => l(e));
    if (this.enabled && !this.timer) this.timer = setTimeout(() => void this.flush(), FLUSH_MS);
    return e;
  }

  onEvent(l: (e: GameEvent) => void) {
    this.listeners.push(l);
  }

  startRun(game: string, meta?: EventData): Run {
    // One open run per game: a forgotten one is closed as abandoned.
    this.open.get(game)?.end({ completed: false, reason: 'restarted' });
    const run = new RunImpl(this, game, rid());
    this.open.set(game, run);
    this.log(game, 'run.start', meta, run.id);
    return run;
  }

  /** @internal */
  closed(run: RunImpl) {
    if (this.open.get(run.game) === run) this.open.delete(run.game);
  }

  /** Ends every open run as abandoned (page hidden for good, app reset). */
  abandonAll(reason: string) {
    for (const r of [...this.open.values()]) r.end({ completed: false, reason });
  }

  async flush(): Promise<void> {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.enabled || !this.buffer.length) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await setMany(batch, this.db());
    } catch {
      // Storage full or blocked: keep the events in memory for the next try.
      this.buffer = batch.concat(this.buffer).slice(-MAX_EVENTS);
    }
  }

  /** All events, oldest first (stored + not yet flushed). */
  async all(): Promise<GameEvent[]> {
    await this.flush();
    if (!this.enabled) return this.buffer.map(([, e]) => e);
    const rows = await entries<string, GameEvent>(this.db());
    rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return rows.map(([, e]) => e).concat(this.buffer.map(([, e]) => e));
  }

  /** Drops the oldest events above MAX_EVENTS. Called once per launch. */
  async trim(max = MAX_EVENTS): Promise<void> {
    if (!this.enabled) return;
    const ks = (await keys<string>(this.db())).sort();
    if (ks.length > max) await delMany(ks.slice(0, ks.length - max), this.db());
  }

  async clearAll(): Promise<void> {
    this.buffer = [];
    if (this.enabled) await clear(this.db());
  }

  /** Puts events from an export back (moving to a new device). Duplicates are skipped by key. */
  async importEvents(events: GameEvent[]): Promise<number> {
    if (!this.enabled) return 0;
    const rows: [string, GameEvent][] = events
      .filter((e) => e && e.v === SCHEMA && typeof e.ts === 'number' && typeof e.type === 'string')
      .map((e, i) => [`${e.ts.toString(36).padStart(9, '0')}-i${(e.run ?? e.app ?? '').slice(0, 6)}${i.toString(36)}`, e]);
    await setMany(rows, this.db());
    return rows.length;
  }
}

class RunImpl implements Run {
  ended = false;
  private readonly started: number;
  private answers = 0;
  private right = 0;
  private lastAt: number;
  private seen = new Set<string>();
  private missed = new Set<string>();

  constructor(private readonly a: Analytics, readonly game: string, readonly id: string) {
    this.started = Date.now();
    this.lastAt = this.started;
  }

  ask(item: string, data?: EventData) {
    if (this.ended) return;
    this.lastAt = Date.now();
    this.a.log(this.game, 'ask', { item, ...data }, this.id);
  }

  answer(x: AnswerData) {
    if (this.ended) return;
    const now = Date.now();
    const firstTry = x.firstTry ?? (x.correct && !this.missed.has(x.item));
    if (!x.correct) this.missed.add(x.item);
    this.seen.add(x.item);
    this.answers++;
    if (x.correct) this.right++;
    this.a.log(this.game, 'answer', { ...x, firstTry, ms: x.ms ?? now - this.lastAt }, this.id);
    this.lastAt = now;
  }

  event(type: string, data?: EventData) {
    if (this.ended) return;
    this.a.log(this.game, type, data, this.id);
  }

  end(result: RunEnd = {}) {
    if (this.ended) return;
    this.ended = true;
    this.a.log(
      this.game,
      'run.end',
      { completed: true, answers: this.answers, correct: this.right, items: this.seen.size, durationMs: Date.now() - this.started, ...result },
      this.id,
    );
    this.a.closed(this);
  }
}

/** The page's analytics. */
export const analytics = new Analytics();

/** Shorthand for mini-games: `const run = startRun('snake', { mode })`. */
export const startRun = (game: string, meta?: EventData) => analytics.startRun(game, meta);

/** Shorthand for a one-off event outside a run: `track('menu', 'open', { from: 'boot' })`. */
export const track = (game: string, type: string, data?: EventData) => analytics.log(game, type, data);

/** Device and launch info, logged once per page load. Wired from main.ts. */
export function startAppTracking(build: string) {
  if (typeof window === 'undefined') return;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  analytics.log('app', 'app.open', {
    build,
    device: coarse ? 'touch' : 'desktop',
    w: window.innerWidth,
    h: window.innerHeight,
    lang: navigator.language,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    hash: location.hash || undefined,
  });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      analytics.log('app', 'app.hidden');
      void analytics.flush();
    } else if (hiddenAt) {
      analytics.log('app', 'app.visible', { awayMs: Date.now() - hiddenAt });
    }
  });
  window.addEventListener('pagehide', () => {
    analytics.abandonAll('page_closed');
    void analytics.flush();
  });
  window.addEventListener('error', (e) => analytics.log('app', 'app.error', { msg: String(e.message).slice(0, 160), src: `${e.filename?.split('/').pop()}:${e.lineno}` }));
  window.addEventListener('unhandledrejection', (e) => analytics.log('app', 'app.error', { msg: String((e.reason as Error)?.message ?? e.reason).slice(0, 160) }));
  void analytics.trim();
}
