/**
 * Умное усложнение: общий для всех мини-игр выбор уровня на следующую игру.
 *
 * Раньше каждая игра решала сама и одинаково грубо: «≥ 90 % верно → +1, мало →
 * −1». Ребёнок, которому уже легко, проходил каждую ступеньку по очереди и
 * скучал. Здесь правило учитывает три вещи:
 *
 *  1. Точность этой игры (как и раньше, пороги у каждой игры свои).
 *  2. Скорость: медиана времени ответа против целевой для игры и против
 *     собственного прошлого темпа ребёнка на этом уровне. Быстро и без ошибок =
 *     уровень явно лёгкий.
 *  3. Разгон между играми: если прошлая игра уже подняла уровень и эта снова
 *     безошибочная, следующая ступенька пропускается (+2). Длинная серия ответов
 *     с первой попытки в одной игре даёт тот же перескок.
 *
 * Откат тоже стал умнее: очень плохая игра (< 40 %) опускает на два уровня,
 * а две шаткие игры подряд на одном уровне (< 75 %) — на один, даже если каждая
 * по отдельности не дотянула до порога отката. Верно, но очень медленно — уровень
 * держится, чтобы закрепить, а не растёт.
 *
 * Цель та же, что в SDD (раздел 5) и отчёте по механикам: держать ребёнка около
 * 85 % успеха (Wilson et al., 2019), просто попадать туда быстрее.
 *
 * Модуль чистый (decideLevel) плюс тонкая обёртка с памятью в localStorage
 * (nextLevelSmart). Сам уровень игра по-прежнему хранит у себя.
 */

import type { Run } from './analytics';

export interface RunStats {
  /** Сколько заданий засчитано верными (как игра считает сама). */
  right: number;
  /** Сколько заданий засчитано всего. */
  total: number;
  /** Время ответов в мс (можно пусто: тогда скорость не учитывается). */
  ms?: readonly number[];
  /** Самая длинная серия ответов с первой попытки подряд в этой игре. */
  streak?: number;
}

export interface LevelRules {
  maxLevel: number;
  minLevel?: number;
  /** Доля верных для подъёма. По умолчанию 0.9. */
  up?: number;
  /** Ниже этой доли — уровень назад. По умолчанию 0.6. */
  down?: number;
  /** Ниже этой доли — два уровня назад. По умолчанию 0.4. */
  drop?: number;
  /** Ниже этой доли игра «шаткая»: две такие подряд на одном уровне — назад. По умолчанию 0.75. */
  shaky?: number;
  /** Медиана ответа (мс), которую для этой игры считаем «быстро». Без неё — только свой прошлый темп. */
  fastMs?: number;
  /** Серия первых попыток подряд, которая сама по себе даёт перескок. По умолчанию 8. */
  skipStreak?: number;
  /** Наибольший шаг за одну игру. По умолчанию 2. */
  maxJump?: number;
}

export type LevelReason = 'skip' | 'up' | 'steady' | 'stay' | 'shaky' | 'down' | 'drop';

export interface PastRun {
  level: number;
  acc: number;
  /** Медиана времени ответа, мс. */
  med?: number;
  /** На сколько уровней сдвинула эта игра. */
  change: number;
  at: number;
}

export interface LevelMemory {
  runs: PastRun[];
}

export interface LevelDecision {
  level: number;
  /** Новый уровень минус старый: +2, +1, 0, −1, −2. */
  change: number;
  reason: LevelReason;
  acc: number;
  med?: number;
  fast: boolean;
  slow: boolean;
  memory: LevelMemory;
}

export const MEMORY_RUNS = 8;
/** Быстрее своего прошлого темпа на этом уровне хотя бы на 20 % — «быстро». */
export const FAST_VS_OWN = 0.8;
/** Медленнее своего прошлого темпа в полтора раза — «медленно». */
export const SLOW_VS_OWN = 1.5;
/** Медленнее целевой скорости игры в 2,5 раза — «медленно». */
export const SLOW_VS_TARGET = 2.5;

export const emptyMemory = (): LevelMemory => ({ runs: [] });

export function median(xs: readonly number[]): number | undefined {
  const v = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return undefined;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/** Самая длинная серия `true` подряд. */
export function longestStreak(oks: readonly boolean[]): number {
  let best = 0;
  let cur = 0;
  for (const ok of oks) {
    cur = ok ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

/**
 * Решает уровень на следующую игру. Чистая функция: память на вход и на выход.
 */
export function decideLevel(level: number, stats: RunStats, memory: LevelMemory, rules: LevelRules, now = Date.now()): LevelDecision {
  const min = rules.minLevel ?? 1;
  const max = rules.maxLevel;
  const up = rules.up ?? 0.9;
  const down = rules.down ?? 0.6;
  const drop = rules.drop ?? 0.4;
  const shakyAt = rules.shaky ?? 0.75;
  const skipStreak = rules.skipStreak ?? 8;
  const maxJump = rules.maxJump ?? 2;

  const acc = stats.total > 0 ? stats.right / stats.total : 0;
  // Меньше трёх ответов — темп не надёжен.
  const med = (stats.ms?.length ?? 0) >= 3 ? median(stats.ms!) : undefined;
  const past = memory.runs;
  const own = median(past.filter((r) => r.level === level && r.med !== undefined).map((r) => r.med!));
  // На новом уровне своего темпа ещё нет: тогда сравниваем с уровнями ниже.
  // Отвечать на трудном уровне так же быстро, как на лёгких, — явный знак, что легко.
  const lower = own === undefined ? median(past.filter((r) => r.level < level && r.med !== undefined).map((r) => r.med!)) : undefined;
  const fast =
    med !== undefined &&
    ((rules.fastMs !== undefined && med <= rules.fastMs) || (own !== undefined && med <= own * FAST_VS_OWN) || (lower !== undefined && med <= lower));
  const slow =
    med !== undefined && !fast && ((own !== undefined && med >= own * SLOW_VS_OWN) || (rules.fastMs !== undefined && med >= rules.fastMs * SLOW_VS_TARGET));
  const prev = past.at(-1);

  let step = 0;
  let reason: LevelReason = 'stay';
  if (stats.total === 0) {
    reason = 'stay';
  } else if (acc >= up) {
    const perfect = stats.right >= stats.total;
    const momentum = !!prev && prev.change > 0 && prev.acc >= up;
    const longRun = (stats.streak ?? 0) >= skipStreak;
    if (perfect && (fast || momentum || longRun)) {
      step = 2;
      reason = 'skip';
    } else if (slow && !perfect) {
      // Верно, но с трудом: пусть уровень закрепится.
      reason = 'steady';
    } else {
      step = 1;
      reason = 'up';
    }
  } else if (acc < drop) {
    step = -2;
    reason = 'drop';
  } else if (acc < down) {
    step = -1;
    reason = 'down';
  } else if (acc < shakyAt && prev && prev.level === level && prev.change === 0 && prev.acc < shakyAt) {
    step = -1;
    reason = 'shaky';
  }

  step = Math.max(-maxJump, Math.min(maxJump, step));
  const nextLevel = Math.max(min, Math.min(max, level + step));
  const change = nextLevel - level;
  // Упёрлись в край — честно говорим «остался».
  if (change === 0 && step !== 0) reason = 'stay';
  else if (change === 1 && reason === 'skip') reason = 'up';
  else if (change === -1 && reason === 'drop') reason = 'down';

  const run: PastRun = { level, acc: Math.round(acc * 100) / 100, change, at: now };
  if (med !== undefined) run.med = Math.round(med);
  return { level: nextLevel, change, reason, acc, med, fast, slow, memory: { runs: [...past, run].slice(-MEMORY_RUNS) } };
}

/**
 * Собирает RunStats из журнала игры: время ответов и серию первых попыток
 * берутся из run.answer(), а «верно из скольких» игра передаёт сама, потому что
 * у каждой игры свой счёт (вторые попытки, проверки чертежа и т. п.).
 */
export function statsFromRun(run: Pick<Run, 'results'> | undefined, right: number, total: number): RunStats {
  const res = run?.results() ?? [];
  return { right, total, ms: res.map((r) => r.ms), streak: longestStreak(res.map((r) => r.firstTry)) };
}

// ---------- память между играми ----------

export const MEMORY_KEY = 'yunga-smart-level';

function readAll(): Record<string, LevelMemory> {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as Record<string, LevelMemory>) : {};
  } catch {
    return {};
  }
}

export function parseMemory(raw: unknown): LevelMemory {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as LevelMemory).runs)) return emptyMemory();
  const runs = (raw as LevelMemory).runs.filter(
    (r): r is PastRun => !!r && typeof r.level === 'number' && typeof r.acc === 'number' && typeof r.change === 'number',
  );
  return { runs: runs.slice(-MEMORY_RUNS) };
}

export function loadMemory(game: string): LevelMemory {
  return parseMemory(readAll()[game]);
}

export function saveMemory(game: string, memory: LevelMemory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify({ ...readAll(), [game]: memory }));
  } catch {
    /* private mode */
  }
}

/** Стирает память умного уровня (сброс прогресса из панели родителя). */
export function clearMemory() {
  try {
    localStorage.removeItem(MEMORY_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * Главная точка входа для игр: решает уровень с учётом прошлых игр и сохраняет
 * память. `game` — id из реестра (src/games/registry.ts).
 */
export function nextLevelSmart(game: string, level: number, stats: RunStats, rules: LevelRules, now = Date.now()): LevelDecision {
  const d = decideLevel(level, stats, loadMemory(game), rules, now);
  saveMemory(game, d.memory);
  return d;
}

/** Короткая подпись для экрана итогов. Пусто, если уровень не сменился. */
export function levelNote(from: number, d: Pick<LevelDecision, 'level' | 'change' | 'reason'>): string {
  if (d.change >= 2) return `Перескок! Уровень ${from} → ${d.level}`;
  if (d.change === 1) return `Новый уровень: ${d.level}`;
  if (d.change < 0) return `Потренируемся на уровне ${d.level}`;
  return '';
}

/** Поля для run.end(), чтобы в журнале было видно, почему сменился уровень. */
export function levelLog(d: LevelDecision) {
  return { levelChange: d.change, levelReason: d.reason, newLevel: d.level, medMs: d.med === undefined ? undefined : Math.round(d.med), fast: d.fast, slow: d.slow };
}
