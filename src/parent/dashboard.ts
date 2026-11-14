import { analytics, track, type GameEvent } from '../core/analytics';
import { buildReport, dayKey, eventsToCsv, minutes, pct, reportToMarkdown, type Report } from '../core/analyticsReport';
import { ENGLISH } from '../core/phrases';
import { Storage } from '../core/storage';
import type { GameState } from '../game-state';
import { GAMES, SKILL_LABEL, gameById } from '../games/registry';
import { WORDS } from '../games/snake/logic';

/**
 * Parent dashboard: an HTML overlay above the game (tables, charts, files are
 * easier in the DOM than on the canvas). Everything is computed from the local
 * event log; nothing is sent anywhere.
 */

export const BUILD: string = import.meta.env.VITE_BUILD ?? 'dev';

const EXTRA_GAMES: Record<string, string> = { voyage: 'Кругосветка', app: 'Приложение', menu: 'Меню', parent: 'Родители' };
export const gameName = (id: string) => gameById(id)?.title ?? EXTRA_GAMES[id] ?? id;

const RU = new Map(WORDS.map((w) => [w.id, w.ru]));
/** 'apple' → 'apple (яблоко)', 'take.boat' → 'Take the boat!', 'n13' → 'thirteen (13)'. */
export function itemName(item: string): string {
  const en = ENGLISH[item];
  const ru = RU.get(item);
  if (en && ru) return `${en} (${ru})`;
  return en ?? ru ?? item;
}

type Period = 7 | 30 | 0;
type Tab = 'overview' | 'games' | 'words' | 'log' | 'data';

const TABS: [Tab, string][] = [
  ['overview', 'Обзор'],
  ['games', 'Игры'],
  ['words', 'Слова и задания'],
  ['log', 'Журнал'],
  ['data', 'Данные'],
];

const CSS = `
.pd{position:fixed;inset:0;z-index:50;background:#f4f7fb;color:#14213d;font:15px/1.45 Nunito,"Trebuchet MS",Arial,sans-serif;overflow:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch}
.pd *{box-sizing:border-box}
.pd header{position:sticky;top:0;z-index:2;background:#14365a;color:#fff;padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
.pd header h1{font-size:20px;margin:0;flex:1 1 auto}
.pd header .sub{opacity:.7;font-size:13px}
.pd button{font:inherit;border:0;border-radius:10px;padding:8px 14px;cursor:pointer;background:#e9eef5;color:#14213d}
.pd button.primary{background:#ffb703;color:#3d2400;font-weight:700}
.pd button.danger{background:#e63946;color:#fff}
.pd button.on{background:#14365a;color:#fff}
.pd header button.on{background:#ffb703;color:#3d2400;font-weight:700}
.pd .close{background:#fff;color:#14365a;font-weight:700}
.pd nav{display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px;background:#fff;border-bottom:1px solid #dde3ea}
@media (max-width:700px){.pd header{position:static}.pd header .sub{display:block}.pd .kpi b{font-size:22px}}
.pd main{padding:16px;max-width:1100px;margin:0 auto}
.pd .row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.pd .kpi{flex:1 1 150px;background:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 1px 3px #14213d14}
.pd .kpi b{display:block;font-size:26px;line-height:1.2}
.pd .kpi span{color:#5c677d;font-size:13px}
.pd section{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:16px;box-shadow:0 1px 3px #14213d14}
.pd h2{font-size:17px;margin:0 0 10px}
.pd table{width:100%;border-collapse:collapse;font-size:14px}
.pd th,.pd td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef1f5;vertical-align:top}
.pd th{color:#5c677d;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
.pd td.n,.pd th.n{text-align:right;font-variant-numeric:tabular-nums}
.pd .scroll{overflow-x:auto}
.pd .sig{padding:8px 10px;border-radius:10px;margin:6px 0}
.pd .sig.warn{background:#fff1e6;border-left:4px solid #f77f00}
.pd .sig.info{background:#eef6ff;border-left:4px solid #3a86ff}
.pd .sig.good{background:#ecf9f0;border-left:4px solid #2a9d8f}
.pd .bars{display:flex;align-items:flex-end;gap:4px;height:140px;padding-top:8px}
.pd .bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.pd .bar i{display:block;width:100%;max-width:38px;background:#3a86c8;border-radius:6px 6px 0 0}
.pd .bar small{font-size:11px;color:#5c677d;white-space:nowrap}
.pd .bar em{font-style:normal;font-size:11px;color:#14213d}
.pd .meter{height:10px;background:#eef1f5;border-radius:5px;overflow:hidden;min-width:80px}
.pd .meter i{display:block;height:100%}
.pd .muted{color:#5c677d}
.pd .chip{display:inline-block;padding:1px 8px;border-radius:9px;background:#eef1f5;font-size:12px;margin:1px 2px}
.pd textarea{width:100%;min-height:200px;font:12px/1.4 ui-monospace,Menlo,monospace}
.pd .toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#14213d;color:#fff;padding:10px 16px;border-radius:10px;z-index:60}
`;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmtTime = (ts: number) => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const sec = (ms?: number) => (ms ? `${(ms / 1000).toFixed(1)} с` : '—');
const color = (rate: number) => (rate < 0.6 ? '#f77f00' : rate > 0.95 ? '#3a86ff' : '#2a9d8f');

function meter(a: number, b: number) {
  if (!b) return '<span class="muted">—</span>';
  const r = a / b;
  return `<div style="display:flex;gap:8px;align-items:center"><div class="meter" style="flex:1"><i style="width:${Math.round(r * 100)}%;background:${color(r)}"></i></div><span>${pct(a, b)}%</span></div>`;
}

function readLocal<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Game data that lives in localStorage (per-game progress), included in the export. */
const LOCAL_KEYS = ['snake-words', 'english-words', 'word-log', 'parcel-progress', 'race-progress', 'menu-opened'];

export function openDashboard(state: GameState, onChange: () => void) {
  if (document.querySelector('.pd')) return;
  if (!document.getElementById('pd-css')) {
    const st = document.createElement('style');
    st.id = 'pd-css';
    st.textContent = CSS;
    document.head.append(st);
  }
  const root = document.createElement('div');
  root.className = 'pd';
  // Keep taps and keys away from the game underneath.
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchstart', 'touchend', 'wheel']) root.addEventListener(ev, (e) => e.stopPropagation());
  document.body.append(root);
  track('parent', 'dashboard.open');

  let period: Period = 7;
  let tab: Tab = 'overview';
  let events: GameEvent[] = [];
  let changed = false;

  const close = () => {
    root.remove();
    track('parent', 'dashboard.close', { tab });
    if (changed) onChange();
  };

  const toast = (msg: string) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    root.append(t);
    setTimeout(() => t.remove(), 2500);
  };

  const report = (): Report => {
    const from = period ? Date.now() - period * 86400000 : 0;
    return buildReport(events, { from, gameName, itemName: (i) => itemName(i) });
  };

  const render = () => {
    const r = report();
    root.innerHTML = `
      <header>
        <h1>Панель родителя <span class="sub">· ${esc(state.profile.childName)} · версия ${esc(BUILD)}</span></h1>
        <div>${([[7, '7 дней'], [30, '30 дней'], [0, 'Всё время']] as [Period, string][])
          .map(([p, l]) => `<button data-period="${p}" class="${p === period ? 'on' : ''}">${l}</button>`).join(' ')}</div>
        <button class="close" data-act="close">Закрыть ✕</button>
      </header>
      <nav>${TABS.map(([t, l]) => `<button data-tab="${t}" class="${t === tab ? 'on' : ''}">${l}</button>`).join('')}</nav>
      <main>${body(r)}</main>`;
  };

  const body = (r: Report): string => {
    switch (tab) {
      case 'overview': return overview(r);
      case 'games': return gamesTab(r);
      case 'words': return wordsTab(r);
      case 'log': return logTab();
      case 'data': return dataTab();
    }
  };

  const overview = (r: Report) => {
    const t = r.totals;
    const days: string[] = [];
    const n = period || Math.max(7, Math.min(60, r.byDay.length));
    for (let i = n - 1; i >= 0; i--) days.push(dayKey(Date.now() - i * 86400000));
    const byDate = new Map(r.byDay.map((d) => [d.date, d]));
    const max = Math.max(1, ...days.map((d) => byDate.get(d)?.playMs ?? 0));
    const bars = days
      .map((d) => {
        const x = byDate.get(d);
        const m = minutes(x?.playMs ?? 0);
        const h = Math.round(((x?.playMs ?? 0) / max) * 110);
        return `<div class="bar" title="${d}: ${m} мин, ${x?.runs ?? 0} игр"><em>${m || ''}</em><i style="height:${h}px"></i><small>${d.slice(8)}.${d.slice(5, 7)}</small></div>`;
      })
      .join('');
    // Skills: answers grouped by the registry's skill tags (voyage answers carry their own skill).
    const skillAgg = new Map<string, { a: number; f: number }>();
    for (const g of r.byGame) {
      const tags = gameById(g.game)?.skills ?? [];
      for (const s of tags.slice(0, 1)) {
        const v = skillAgg.get(s) ?? { a: 0, f: 0 };
        v.a += g.attempts;
        v.f += g.firstTry;
        skillAgg.set(s, v);
      }
    }
    return `
      <div class="row">
        <div class="kpi"><b>${minutes(t.playMs)} мин</b><span>в играх за ${t.days} дн.</span></div>
        <div class="kpi"><b>${t.runs}</b><span>игр начато, доиграно ${t.completed}</span></div>
        <div class="kpi"><b>${t.attempts}</b><span>вопросов и заданий</span></div>
        <div class="kpi"><b style="color:${color(t.attempts ? t.firstTry / t.attempts : 0.8)}">${t.attempts ? `${pct(t.firstTry, t.attempts)}%` : '—'}</b><span>с первого раза (цель 70–90%)</span></div>
        <div class="kpi"><b>${sec(t.medianMs)}</b><span>медиана времени ответа</span></div>
      </div>
      <section><h2>Что заметно</h2>${r.signals.length ? r.signals.map((s) => `<div class="sig ${s.level}">${esc(s.text)}</div>`).join('') : '<p class="muted">Пока мало данных: сигналы появятся после нескольких игр.</p>'}</section>
      <section><h2>Минут в день</h2><div class="bars">${bars}</div></section>
      <section><h2>По навыкам</h2><table>${[...skillAgg.entries()]
        .map(([s, v]) => `<tr><td>${esc(SKILL_LABEL[s as keyof typeof SKILL_LABEL] ?? s)}</td><td style="width:60%">${meter(v.f, v.a)}</td><td class="n">${v.a}</td></tr>`).join('') || '<tr><td class="muted">Нет данных</td></tr>'}</table></section>`;
  };

  const gamesTab = (r: Report) => {
    const known = new Set(r.byGame.map((g) => g.game));
    const rows = r.byGame
      .map((g) => `<tr>
        <td><b>${esc(gameName(g.game))}</b><br><span class="muted">последний раз ${g.lastTs ? fmtTime(g.lastTs) : '—'}</span></td>
        <td class="n">${g.runs}</td><td class="n">${g.completed}${g.abandoned ? ` <span class="muted">/ брошено ${g.abandoned}</span>` : ''}</td>
        <td class="n">${minutes(g.playMs)}</td><td class="n">${g.attempts}</td><td style="min-width:140px">${meter(g.firstTry, g.attempts)}</td>
        <td class="n">${sec(g.medianMs)}</td><td class="n">${g.avgStars?.toFixed(1) ?? '—'}</td>
        <td>${[g.repeats && `повторов ${g.repeats}`, g.hints && `подсказок ${g.hints}`, g.pitStops && `пит-стопов ${g.pitStops}`].filter(Boolean).map((x) => `<span class="chip">${x}</span>`).join('')}</td>
      </tr>`).join('');
    const never = GAMES.filter((g) => !known.has(g.id)).map((g) => g.title);
    return `<section><h2>Игры за период</h2><div class="scroll"><table>
      <tr><th>Игра</th><th class="n">Начато</th><th class="n">Доиграно</th><th class="n">Минут</th><th class="n">Вопросов</th><th>С 1-го раза</th><th class="n">Ответ</th><th class="n">Звёзды</th><th></th></tr>
      ${rows || '<tr><td colspan="9" class="muted">Нет игр за этот период</td></tr>'}</table></div>
      ${never.length ? `<p class="muted">Ещё не открывал: ${esc(never.join(', '))}.</p>` : ''}</section>`;
  };

  const wordsTab = (r: Report) => {
    const snake = readLocal<Record<string, number>>('snake-words') ?? {};
    const log = readLocal<Record<string, { box?: number; due?: number }>>('word-log') ?? {};
    // One row per word or task across all games, hardest first.
    const merged = new Map<string, { item: string; attempts: number; firstTry: number; ms: number[]; confusions: Record<string, number>; games: Set<string>; lastTs: number }>();
    for (const i of r.items) {
      const m = merged.get(i.item) ?? { item: i.item, attempts: 0, firstTry: 0, ms: [], confusions: {}, games: new Set(), lastTs: 0 };
      m.attempts += i.attempts;
      m.firstTry += i.firstTry;
      if (i.medianMs) m.ms.push(i.medianMs);
      for (const [c, n] of Object.entries(i.confusions)) m.confusions[c] = (m.confusions[c] ?? 0) + n;
      m.games.add(i.game);
      m.lastTs = Math.max(m.lastTs, i.lastTs);
      merged.set(i.item, m);
    }
    const list = [...merged.values()]
      .map((m) => ({ ...m, medianMs: m.ms.length ? m.ms.reduce((a, b) => a + b, 0) / m.ms.length : undefined }))
      .sort((a, b) => a.firstTry / a.attempts - b.firstTry / b.attempts || b.attempts - a.attempts);
    const rows = list
      .slice(0, 300)
      .map((i) => {
        const conf = Object.entries(i.confusions).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => `<span class="chip">${esc(itemName(c))} ×${n}</span>`).join('');
        const extra = [snake[i.item] ? `Змейка ✓${snake[i.item]}` : '', log[i.item]?.box !== undefined ? `журнал: ступень ${log[i.item]!.box}` : ''].filter(Boolean).join(', ');
        return `<tr><td>${esc(itemName(i.item))}${extra ? `<br><span class="muted">${esc(extra)}</span>` : ''}</td><td>${[...i.games].map((g) => `<span class="chip">${esc(gameName(g))}</span>`).join('')}</td>
          <td class="n">${i.attempts}</td><td style="min-width:130px">${meter(i.firstTry, i.attempts)}</td><td class="n">${sec(i.medianMs)}</td><td>${conf}</td><td class="muted">${fmtTime(i.lastTs)}</td></tr>`;
      })
      .join('');
    const learnt = Object.values(snake).filter((n) => n >= 3).length;
    return `<section><h2>Слова и задания: сначала самые трудные</h2>
      <p class="muted">Попытка — один вопрос в одной игре, строки объединяют все игры. «С 1-го раза» — ответил верно без ошибок. В Змейке слово считается выученным после 3 попаданий с первого раза: выучено ${learnt} из ${Object.keys(snake).length} встреченных.</p>
      <div class="scroll"><table><tr><th>Слово / задание</th><th>Игры</th><th class="n">Попыток</th><th>С 1-го раза</th><th class="n">Ответ</th><th>Путает с</th><th>Когда</th></tr>
      ${rows || '<tr><td colspan="7" class="muted">Нет ответов за этот период</td></tr>'}</table></div></section>`;
  };

  const logTab = () => {
    const last = events.slice(-300).reverse();
    return `<section><h2>Последние события (${last.length} из ${events.length})</h2><div class="scroll"><table>
      <tr><th>Время</th><th>Игра</th><th>Событие</th><th>Подробности</th></tr>
      ${last.map((e) => `<tr><td class="muted">${fmtTime(e.ts)}</td><td>${esc(gameName(e.game))}</td><td>${esc(e.type)}</td><td>${esc(
        Object.entries(e.data ?? {}).map(([k, v]) => `${k}=${k === 'item' || k === 'chosen' ? itemName(String(v)) : v}`).join(' · '),
      )}</td></tr>`).join('')}</table></div></section>`;
  };

  const dataTab = () => `
    <section><h2>Выгрузка для анализа</h2>
      <p>Все данные хранятся только в этом браузере. Выгрузите файл и пришлите его Claude для следующего витка улучшений: JSON — полный (события, прогресс плавания, прогресс мини-игр), CSV — таблица событий для Excel/Google Sheets, отчёт — сводка в Markdown.</p>
      <div class="row">
        <button class="primary" data-act="json">Скачать JSON</button>
        <button class="primary" data-act="csv">Скачать CSV</button>
        <button class="primary" data-act="md">Скачать отчёт</button>
        ${typeof navigator.share === 'function' ? '<button data-act="share">Поделиться JSON…</button>' : ''}
        <label><button data-act="import">Загрузить JSON с другого устройства</button><input type="file" accept=".json,application/json" hidden></label>
      </div>
      <p class="muted">Событий в журнале: ${events.length}. Хранится не больше 60 000 последних.</p>
    </section>
    <section><h2>Кругосветка</h2>
      <div class="row">
        ${!state.gate().allowed ? '<button data-act="grant">Разрешить ещё одно плавание сегодня</button>' : '<span class="muted">Сегодня плавание доступно.</span>'}
        <button class="danger" data-act="reset">Начать плавание заново</button>
      </div>
    </section>
    <section><h2>Журнал событий</h2><button class="danger" data-act="clear">Очистить журнал событий</button>
      <p class="muted">Прогресс игр при этом не стирается.</p></section>`;

  const download = (name: string, mime: string, text: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    root.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  };

  const bundle = async () => {
    const local: Record<string, unknown> = {};
    for (const k of LOCAL_KEYS) {
      const v = readLocal(k);
      if (v !== undefined) local[k] = v;
    }
    let voyage: unknown;
    try {
      voyage = JSON.parse(await new Storage().exportJson());
    } catch {
      voyage = undefined;
    }
    return JSON.stringify({ format: 'yunga-analytics', version: 1, exportedAt: new Date().toISOString(), build: BUILD, events: await analytics.all(), voyage, local });
  };
  const stamp = () => dayKey(Date.now());

  root.addEventListener('click', async (e) => {
    const el = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!el) return;
    if (el.dataset.period !== undefined) {
      period = Number(el.dataset.period) as Period;
      return render();
    }
    if (el.dataset.tab) {
      tab = el.dataset.tab as Tab;
      track('parent', 'dashboard.tab', { tab });
      return render();
    }
    switch (el.dataset.act) {
      case 'close':
        return close();
      case 'json':
        track('parent', 'export', { kind: 'json' });
        return download(`yunga-${stamp()}.json`, 'application/json', await bundle());
      case 'csv':
        track('parent', 'export', { kind: 'csv' });
        return download(`yunga-events-${stamp()}.csv`, 'text/csv', '﻿' + eventsToCsv(events));
      case 'md':
        track('parent', 'export', { kind: 'md' });
        return download(`yunga-report-${stamp()}.md`, 'text/markdown', reportToMarkdown(report(), gameName, (i) => itemName(i)));
      case 'share': {
        const file = new File([await bundle()], `yunga-${stamp()}.json`, { type: 'application/json' });
        try {
          await navigator.share({ files: [file], title: 'Кругосветка: данные' });
        } catch {
          /* cancelled */
        }
        return;
      }
      case 'import':
        return (el.parentElement?.querySelector('input[type=file]') as HTMLInputElement | null)?.click();
      case 'grant':
        await state.grantSession();
        changed = true;
        toast('Ещё одно плавание разрешено');
        return render();
      case 'reset':
        if (!confirmInline(el, 'Точно стереть прогресс плавания?')) return;
        await state.reset();
        changed = true;
        toast('Прогресс плавания стёрт');
        return render();
      case 'clear':
        if (!confirmInline(el, 'Точно очистить журнал?')) return;
        await analytics.clearAll();
        events = [];
        toast('Журнал очищен');
        return render();
    }
  });
  root.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as { format?: string; events?: GameEvent[] };
      if (data.format !== 'yunga-analytics' || !Array.isArray(data.events)) throw new Error('format');
      const n = await analytics.importEvents(data.events);
      events = await analytics.all();
      toast(`Загружено событий: ${n}`);
      render();
    } catch {
      toast('Это не файл выгрузки игры');
    }
  });

  root.innerHTML = '<main><p>Загрузка…</p></main>';
  void analytics.all().then((all) => {
    events = all;
    render();
  });
}

/** Two-tap confirm without a browser dialog: the first tap changes the label. */
function confirmInline(el: HTMLButtonElement, text: string): boolean {
  if (el.dataset.armed) return true;
  const label = el.textContent;
  el.dataset.armed = '1';
  el.textContent = text;
  setTimeout(() => {
    delete el.dataset.armed;
    el.textContent = label;
  }, 4000);
  return false;
}
