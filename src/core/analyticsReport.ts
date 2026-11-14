import type { GameEvent, Primitive } from './analytics';

/**
 * Turns the raw event log into what a parent (or the next improvement cycle)
 * needs: time played, accuracy per game and per item, confusions, and plain
 * "signals" — places where the game is too hard, too easy, or broken.
 * Pure functions: the dashboard, tests and tools/analyze.ts all use them.
 */

/** A single run never counts for more than this (a tab left open overnight). */
export const MAX_RUN_MS = 45 * 60 * 1000;
/** The zone where a child learns best: mostly right, sometimes wrong (~85%, Wilson et al. 2019). */
export const TARGET_FIRST_TRY = { low: 0.6, high: 0.95 };

export interface GameStats {
  game: string;
  runs: number;
  completed: number;
  abandoned: number;
  playMs: number;
  /** Distinct questions answered (run × item). */
  attempts: number;
  /** Of those, answered right with no earlier miss. */
  firstTry: number;
  answers: number;
  wrong: number;
  medianMs?: number;
  avgStars?: number;
  repeats: number;
  hints: number;
  pitStops: number;
  lastTs: number;
}

export interface ItemStats {
  game: string;
  item: string;
  attempts: number;
  firstTry: number;
  wrong: number;
  medianMs?: number;
  /** What was picked instead, and how often. */
  confusions: Record<string, number>;
  lastTs: number;
}

export interface DayStats {
  /** Local date, YYYY-MM-DD. */
  date: string;
  playMs: number;
  runs: number;
  attempts: number;
  firstTry: number;
  games: Record<string, number>;
}

export interface Signal {
  level: 'warn' | 'info' | 'good';
  text: string;
}

export interface Report {
  from: number;
  to: number;
  events: number;
  totals: { playMs: number; days: number; runs: number; completed: number; attempts: number; firstTry: number; medianMs?: number; launches: number };
  byDay: DayStats[];
  byGame: GameStats[];
  items: ItemStats[];
  voiceFallbacks: Record<string, number>;
  errors: { ts: number; msg: string }[];
  signals: Signal[];
}

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1]! + s[m]!) / 2;
}

const num = (v: Primitive | undefined) => (typeof v === 'number' ? v : undefined);
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export const minutes = (ms: number) => Math.round(ms / 60000);

export interface ReportOptions {
  from?: number;
  to?: number;
  /** Human name of a game id. */
  gameName?: (id: string) => string;
  /** Human name of an item id (word, task). */
  itemName?: (item: string, game: string) => string;
}

export function buildReport(all: GameEvent[], opts: ReportOptions = {}): Report {
  const from = opts.from ?? 0;
  const to = opts.to ?? Number.MAX_SAFE_INTEGER;
  const events = all.filter((e) => e.ts >= from && e.ts <= to);
  const gameName = opts.gameName ?? ((g) => g);
  const itemName = opts.itemName ?? ((i) => i);

  const games = new Map<string, GameStats & { ms: number[]; stars: number[] }>();
  const items = new Map<string, ItemStats & { ms: number[] }>();
  const days = new Map<string, DayStats>();
  const voiceFallbacks: Record<string, number> = {};
  const errors: Report['errors'] = [];
  const runStartDay = new Map<string, string>();
  const allMs: number[] = [];
  let launches = 0;

  const g = (id: string) => {
    let s = games.get(id);
    if (!s) {
      s = { game: id, runs: 0, completed: 0, abandoned: 0, playMs: 0, attempts: 0, firstTry: 0, answers: 0, wrong: 0, repeats: 0, hints: 0, pitStops: 0, lastTs: 0, ms: [], stars: [] };
      games.set(id, s);
    }
    return s;
  };
  const d = (ts: number) => {
    const k = dayKey(ts);
    let s = days.get(k);
    if (!s) {
      s = { date: k, playMs: 0, runs: 0, attempts: 0, firstTry: 0, games: {} };
      days.set(k, s);
    }
    return s;
  };
  // An item is "attempted" once per run: its first answer decides first try.
  const seen = new Set<string>();

  for (const e of events) {
    const data = e.data ?? {};
    if (e.type === 'app.open') launches++;
    if (e.type === 'voice.fallback') {
      const clip = String(data.clip ?? '?');
      voiceFallbacks[clip] = (voiceFallbacks[clip] ?? 0) + 1;
      continue;
    }
    if (e.type === 'app.error') {
      errors.push({ ts: e.ts, msg: String(data.msg ?? '') });
      continue;
    }
    if (e.game === 'app' || e.game === 'menu' || e.game === 'parent') continue;
    const gs = g(e.game);
    gs.lastTs = Math.max(gs.lastTs, e.ts);
    switch (e.type) {
      case 'run.start': {
        gs.runs++;
        const day = d(e.ts);
        day.runs++;
        day.games[e.game] = (day.games[e.game] ?? 0) + 1;
        if (e.run) runStartDay.set(e.run, day.date);
        break;
      }
      case 'run.end': {
        const ms = Math.min(MAX_RUN_MS, num(data.durationMs) ?? 0);
        gs.playMs += ms;
        const day = days.get((e.run && runStartDay.get(e.run)) || dayKey(e.ts)) ?? d(e.ts);
        day.playMs += ms;
        if (data.completed === false) gs.abandoned++;
        else gs.completed++;
        const stars = num(data.stars);
        if (stars !== undefined && data.completed !== false) gs.stars.push(stars);
        break;
      }
      case 'answer': {
        const item = String(data.item ?? '?');
        gs.answers++;
        if (data.correct === false) gs.wrong++;
        const ik = `${e.game}|${item}`;
        let is = items.get(ik);
        if (!is) {
          is = { game: e.game, item, attempts: 0, firstTry: 0, wrong: 0, confusions: {}, lastTs: 0, ms: [] };
          items.set(ik, is);
        }
        is.lastTs = e.ts;
        if (data.correct === false) {
          is.wrong++;
          if (data.chosen !== undefined && data.chosen !== null) is.confusions[String(data.chosen)] = (is.confusions[String(data.chosen)] ?? 0) + 1;
        }
        const ms = num(data.ms);
        if (ms !== undefined && ms > 0 && ms < 120000) {
          is.ms.push(ms);
          gs.ms.push(ms);
          allMs.push(ms);
        }
        const hints = num(data.hints);
        if (hints) gs.hints += hints;
        const once = `${e.run ?? e.app}|${ik}`;
        if (!seen.has(once)) {
          seen.add(once);
          const ok = data.correct === true && data.firstTry !== false;
          is.attempts++;
          gs.attempts++;
          const day = d(e.ts);
          day.attempts++;
          if (ok) {
            is.firstTry++;
            gs.firstTry++;
            day.firstTry++;
          }
        }
        break;
      }
      case 'repeat':
        gs.repeats++;
        break;
      case 'hint':
        gs.hints++;
        break;
      case 'pit_stop.start':
        gs.pitStops++;
        break;
    }
  }

  const byGame: GameStats[] = [...games.values()]
    .map(({ ms, stars, ...s }) => ({ ...s, medianMs: median(ms), avgStars: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : undefined }))
    .sort((a, b) => b.playMs - a.playMs || b.runs - a.runs);
  const itemList: ItemStats[] = [...items.values()]
    .map(({ ms, ...s }) => ({ ...s, medianMs: median(ms) }))
    .sort((a, b) => a.firstTry / a.attempts - b.firstTry / b.attempts || b.attempts - a.attempts);
  const byDay = [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  const totals = {
    playMs: byGame.reduce((a, s) => a + s.playMs, 0),
    days: byDay.filter((x) => x.runs > 0).length,
    runs: byGame.reduce((a, s) => a + s.runs, 0),
    completed: byGame.reduce((a, s) => a + s.completed, 0),
    attempts: byGame.reduce((a, s) => a + s.attempts, 0),
    firstTry: byGame.reduce((a, s) => a + s.firstTry, 0),
    medianMs: median(allMs),
    launches,
  };

  const report: Report = { from, to, events: events.length, totals, byDay, byGame, items: itemList, voiceFallbacks, errors, signals: [] };
  report.signals = signals(report, gameName, itemName);
  return report;
}

/** Plain-language findings, worst first. Thresholds are deliberately simple and documented in docs/analytics.md. */
export function signals(r: Report, gameName: (id: string) => string, itemName: (item: string, game: string) => string): Signal[] {
  const out: Signal[] = [];
  for (const s of r.byGame) {
    const rate = s.attempts ? s.firstTry / s.attempts : 0;
    if (s.attempts >= 10 && rate < TARGET_FIRST_TRY.low) {
      out.push({ level: 'warn', text: `«${gameName(s.game)}» сейчас трудновата: с первого раза ${pct(s.firstTry, s.attempts)}% (лучше 70–90%). Стоит упростить уровень или добавить подсказку.` });
    } else if (s.attempts >= 15 && rate > TARGET_FIRST_TRY.high) {
      out.push({ level: 'info', text: `«${gameName(s.game)}» даётся слишком легко: ${pct(s.firstTry, s.attempts)}% с первого раза. Можно усложнить.` });
    } else if (s.attempts >= 10) {
      out.push({ level: 'good', text: `«${gameName(s.game)}» в зоне роста: ${pct(s.firstTry, s.attempts)}% с первого раза.` });
    }
    if (s.runs >= 3 && s.abandoned / s.runs > 0.4) {
      out.push({ level: 'warn', text: `«${gameName(s.game)}» часто бросает на середине: ${s.abandoned} из ${s.runs}. Возможно, длинно или скучно.` });
    }
    if (s.answers >= 10 && s.repeats / s.answers > 0.5) {
      out.push({ level: 'info', text: `В «${gameName(s.game)}» часто просит повторить (${s.repeats} раз на ${s.answers} ответов): слово плохо слышно или незнакомо.` });
    }
  }
  // Words and tasks are merged across games: «thirty» is hard whether it is asked in Snake or in the race.
  const byItem = new Map<string, { item: string; game: string; attempts: number; firstTry: number }>();
  const pairCount = new Map<string, { item: string; game: string; c: string; n: number }>();
  for (const i of r.items) {
    const m = byItem.get(i.item) ?? { item: i.item, game: i.game, attempts: 0, firstTry: 0 };
    m.attempts += i.attempts;
    m.firstTry += i.firstTry;
    byItem.set(i.item, m);
    for (const [c, n] of Object.entries(i.confusions)) {
      const k = `${i.item}|${c}`;
      const p = pairCount.get(k) ?? { item: i.item, game: i.game, c, n: 0 };
      p.n += n;
      pairCount.set(k, p);
    }
  }
  const hard = [...byItem.values()]
    .filter((i) => i.attempts >= 3 && i.firstTry / i.attempts < 0.34)
    .sort((a, b) => a.firstTry / a.attempts - b.firstTry / b.attempts)
    .slice(0, 6);
  if (hard.length) out.push({ level: 'warn', text: `Трудные задания: ${hard.map((i) => `${itemName(i.item, i.game)} (${i.firstTry} из ${i.attempts})`).join(', ')}.` });
  const pairs = [...pairCount.values()].filter((p) => p.n >= 2).sort((a, b) => b.n - a.n).slice(0, 5);
  if (pairs.length) out.push({ level: 'info', text: `Путает: ${pairs.map((p) => `${itemName(p.item, p.game)} → ${itemName(p.c, p.game)} (${p.n})`).join(', ')}.` });
  const days = r.byDay.filter((x) => x.runs > 0);
  const maxDay = days.reduce((m, x) => Math.max(m, x.playMs), 0);
  if (maxDay > 60 * 60000) out.push({ level: 'warn', text: `Был день с игрой больше часа (${minutes(maxDay)} мин). Для 6 лет лучше короткие сессии 15–20 минут.` });
  const fb = Object.entries(r.voiceFallbacks).sort((a, b) => b[1] - a[1]);
  if (fb.length) {
    const n = fb.reduce((a, [, k]) => a + k, 0);
    out.push({ level: 'warn', text: `${n} ${plural(n, 'реплика прозвучала', 'реплики прозвучали', 'реплик прозвучали')} голосом браузера вместо записанного: ${fb.slice(0, 5).map(([c]) => c).join(', ')}${fb.length > 5 ? '…' : ''}.` });
  }
  if (r.errors.length) out.push({ level: 'warn', text: `Ошибок в игре: ${r.errors.length}. Последняя: ${r.errors.at(-1)!.msg}` });
  const order = { warn: 0, info: 1, good: 2 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Russian plural: 1 реплика, 2 реплики, 5 реплик. */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

// ---------- export ----------

const CSV_COLS = ['ts', 'time', 'app', 'run', 'game', 'type', 'item', 'correct', 'firstTry', 'chosen', 'ms', 'level', 'skill', 'data'] as const;

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per event; the common answer fields get their own columns, the rest goes to `data` as JSON. */
export function eventsToCsv(events: GameEvent[]): string {
  const rows = [CSV_COLS.join(',')];
  for (const e of events) {
    const { item, correct, firstTry, chosen, ms, level, skill, ...rest } = e.data ?? {};
    const d = new Date(e.ts);
    rows.push(
      [
        e.ts, `${dayKey(e.ts)} ${d.toTimeString().slice(0, 8)}`, e.app, e.run, e.game, e.type, item, correct, firstTry, chosen, ms, level, skill,
        Object.keys(rest).length ? JSON.stringify(rest) : '',
      ].map(csvCell).join(','),
    );
  }
  return rows.join('\n') + '\n';
}

/** Markdown summary for an improvement cycle (tools/analyze.ts prints it). */
export function reportToMarkdown(r: Report, gameName: (id: string) => string = (g) => g, itemName: (i: string, g: string) => string = (i) => i): string {
  const L: string[] = [];
  const t = r.totals;
  L.push(`# Отчёт по игре`, '');
  L.push(`Период: ${r.byDay[0]?.date ?? '—'} … ${r.byDay.at(-1)?.date ?? '—'}, событий: ${r.events}, запусков: ${t.launches}.`, '');
  L.push(`- Время в играх: ${minutes(t.playMs)} мин за ${t.days} дн.`);
  L.push(`- Игр начато: ${t.runs}, доиграно: ${t.completed}.`);
  L.push(`- Вопросов: ${t.attempts}, с первого раза: ${pct(t.firstTry, t.attempts)}%.`);
  if (t.medianMs) L.push(`- Медианное время ответа: ${(t.medianMs / 1000).toFixed(1)} с.`);
  L.push('', '## Сигналы', '');
  for (const s of r.signals) L.push(`- ${s.level === 'warn' ? '⚠️' : s.level === 'good' ? '✅' : 'ℹ️'} ${s.text}`);
  if (!r.signals.length) L.push('- Пока мало данных.');
  L.push('', '## По играм', '', '| Игра | Игр | Доиграно | Минут | Вопросов | С 1-го раза | Медиана ответа | Звёзды |', '|---|---|---|---|---|---|---|---|');
  for (const s of r.byGame) {
    L.push(`| ${gameName(s.game)} | ${s.runs} | ${s.completed} | ${minutes(s.playMs)} | ${s.attempts} | ${pct(s.firstTry, s.attempts)}% | ${s.medianMs ? (s.medianMs / 1000).toFixed(1) + ' с' : '—'} | ${s.avgStars?.toFixed(1) ?? '—'} |`);
  }
  L.push('', '## По дням', '', '| День | Минут | Игр | Вопросов | С 1-го раза |', '|---|---|---|---|---|');
  for (const x of r.byDay) L.push(`| ${x.date} | ${minutes(x.playMs)} | ${x.runs} | ${x.attempts} | ${pct(x.firstTry, x.attempts)}% |`);
  L.push('', '## Самые трудные задания', '', '| Игра | Задание | Попыток | С 1-го раза | Путает с |', '|---|---|---|---|---|');
  for (const i of r.items.filter((x) => x.attempts >= 2).slice(0, 20)) {
    const conf = Object.entries(i.confusions).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `${itemName(c, i.game)} ×${n}`).join(', ');
    L.push(`| ${gameName(i.game)} | ${itemName(i.item, i.game)} | ${i.attempts} | ${pct(i.firstTry, i.attempts)}% | ${conf || '—'} |`);
  }
  const fb = Object.entries(r.voiceFallbacks);
  if (fb.length) {
    L.push('', '## Озвучка: реплики без клипа', '');
    for (const [c, n] of fb.sort((a, b) => b[1] - a[1])) L.push(`- ${c}: ${n}`);
  }
  return L.join('\n') + '\n';
}
