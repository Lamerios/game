import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Analytics, type GameEvent } from '../src/core/analytics';
import { buildReport, eventsToCsv, plural, reportToMarkdown } from '../src/core/analyticsReport';

describe('Analytics log', () => {
  it('stores a run with answers, oldest first', async () => {
    const a = new Analytics('t-an-1');
    const run = a.startRun('snake', { mode: 'words' });
    run.ask('apple');
    run.answer({ item: 'apple', correct: false, chosen: 'cat' });
    run.answer({ item: 'apple', correct: true });
    run.ask('dog');
    run.answer({ item: 'dog', correct: true });
    run.end({ stars: 3 });
    const ev = await a.all();
    expect(ev.map((e) => e.type)).toEqual(['run.start', 'ask', 'answer', 'answer', 'ask', 'answer', 'run.end']);
    const answers = ev.filter((e) => e.type === 'answer').map((e) => e.data);
    expect(answers.map((d) => d?.firstTry)).toEqual([false, false, true]);
    const end = ev.at(-1)!.data!;
    expect(end).toMatchObject({ completed: true, answers: 3, correct: 2, items: 2, stars: 3 });
    expect(new Set(ev.map((e) => e.run)).size).toBe(1);
  });

  it('closes a forgotten run as abandoned when the game starts again', async () => {
    const a = new Analytics('t-an-2');
    const first = a.startRun('race');
    a.startRun('race');
    expect(first.ended).toBe(true);
    const ends = (await a.all()).filter((e) => e.type === 'run.end');
    expect(ends[0]!.data).toMatchObject({ completed: false, reason: 'restarted' });
  });

  it('ignores answers after the end and drops undefined fields', async () => {
    const a = new Analytics('t-an-3');
    const r = a.startRun('parcel');
    r.end();
    r.answer({ item: 'x', correct: true });
    a.log('app', 'app.open', { build: 'b', hash: undefined });
    const ev = await a.all();
    expect(ev.filter((e) => e.type === 'answer')).toHaveLength(0);
    expect(ev.at(-1)!.data).toEqual({ build: 'b' });
  });

  it('trims the oldest events and imports an export without duplicates', async () => {
    const a = new Analytics('t-an-4');
    for (let i = 0; i < 12; i++) a.log('app', 'tick', { i });
    await a.flush();
    await a.trim(5);
    const kept = await a.all();
    expect(kept.map((e) => e.data!.i)).toEqual([7, 8, 9, 10, 11]);
    const b = new Analytics('t-an-5');
    expect(await b.importEvents(kept)).toBe(5);
    await b.importEvents(kept);
    expect(await b.all()).toHaveLength(5);
  });
});

const ev = (ts: number, game: string, type: string, data: GameEvent['data'], run?: string): GameEvent => ({ v: 1, ts, app: 'a', run, game, type, data });

describe('Report', () => {
  const day = new Date(2026, 10, 14, 10).getTime();
  const log: GameEvent[] = [
    ev(day, 'app', 'app.open', {}),
    ev(day, 'snake', 'run.start', {}, 'r1'),
    // thirty: wrong (picked thirteen), then right → attempt without first try
    ev(day + 1000, 'snake', 'answer', { item: 'n30', correct: false, chosen: 'n13', ms: 3000 }, 'r1'),
    ev(day + 2000, 'snake', 'answer', { item: 'n30', correct: true, firstTry: false, ms: 1000 }, 'r1'),
    ev(day + 3000, 'snake', 'answer', { item: 'apple', correct: true, firstTry: true, ms: 2000 }, 'r1'),
    ev(day + 4000, 'snake', 'repeat', {}, 'r1'),
    ev(day + 600000, 'snake', 'run.end', { completed: true, durationMs: 600000 }, 'r1'),
    ev(day, 'race', 'run.start', {}, 'r2'),
    ev(day + 1000, 'race', 'answer', { item: 'n30', correct: false, chosen: 'n13' }, 'r2'),
    ev(day + 2000, 'race', 'pit_stop.start', {}, 'r2'),
    ev(day + 5 * 3600000, 'race', 'run.end', { completed: false, durationMs: 5 * 3600000, stars: 0 }, 'r2'),
    ev(day, 'app', 'voice.fallback', { clip: 'rumb.menu.hello' }),
  ];

  it('counts time, attempts, first tries and confusions', () => {
    const r = buildReport(log);
    expect(r.totals.launches).toBe(1);
    expect(r.totals.runs).toBe(2);
    expect(r.totals.attempts).toBe(3);
    expect(r.totals.firstTry).toBe(1);
    const snake = r.byGame.find((g) => g.game === 'snake')!;
    expect(snake).toMatchObject({ runs: 1, completed: 1, attempts: 2, firstTry: 1, repeats: 1, playMs: 600000 });
    const race = r.byGame.find((g) => g.game === 'race')!;
    // A run left open for hours counts for at most 45 minutes, and an abandoned run's stars don't count.
    expect(race).toMatchObject({ abandoned: 1, pitStops: 1, playMs: 45 * 60000, avgStars: undefined });
    expect(r.items[0]!.item).toBe('n30');
    expect(r.items.find((i) => i.game === 'snake' && i.item === 'n30')!.confusions).toEqual({ n13: 1 });
    expect(r.voiceFallbacks).toEqual({ 'rumb.menu.hello': 1 });
    expect(r.byDay).toHaveLength(1);
  });

  it('raises signals for hard items, confusions and missing clips', () => {
    const many: GameEvent[] = [ev(day, 'race', 'run.start', {}, 'x')];
    for (let i = 0; i < 12; i++) many.push(ev(day + i, 'race', 'answer', { item: `w${i % 4}`, correct: i % 4 === 0, chosen: 'cat' }, `run${i}`));
    const r = buildReport([...log, ...many]);
    const text = r.signals.map((s) => s.text).join('\n');
    expect(text).toContain('трудновата');
    expect(text).toContain('Путает');
    expect(text).toContain('1 реплика прозвучала голосом браузера');
    expect(r.signals[0]!.level).toBe('warn');
  });

  it('exports CSV and Markdown', () => {
    const csv = eventsToCsv(log);
    expect(csv.split('\n')[0]).toBe('ts,time,app,run,game,type,item,correct,firstTry,chosen,ms,level,skill,data');
    expect(csv).toContain(',snake,answer,n30,false,,n13,3000,,,');
    const md = reportToMarkdown(buildReport(log));
    expect(md).toContain('## По играм');
    expect(md).toContain('| snake | 1 | 1 | 10 |');
  });

  it('declines Russian plurals', () => {
    expect([1, 2, 5, 11, 21, 22].map((n) => plural(n, 'a', 'b', 'c'))).toEqual(['a', 'b', 'c', 'c', 'a', 'b']);
  });
});
