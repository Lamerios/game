/**
 * Прогресс «как в гонке» для остальных мини-игр.
 *
 * В гонке ребёнок видит свои трассы со звёздами, знает «свою трассу» и за
 * заезд без ошибок получает следующую машину в гараж. Здесь то же для всех
 * игр с уровнями:
 *
 *  - лучшие звёзды на каждом уровне (лесенка уровней на экране итогов);
 *  - коллекция игры: за игру на три звезды — следующий предмет коллекции
 *    (наклейки со словами, у змейки — шкурки, которые можно надеть);
 *  - выбранный предмет (шкурка змейки).
 *
 * Сам уровень игра по-прежнему хранит у себя и меняет через smartLevel; сюда
 * она приносит только итог: на каком уровне играла и сколько звёзд.
 * Модуль чистый плюс тонкая обёртка над localStorage (ключ PROGRESS_KEY).
 */

export const PROGRESS_KEY = 'yunga-progress';

export interface GameProgress {
  /** Лучшие звёзды на уровне: best[0] — уровень 1. */
  best: number[];
  /** Полученные предметы коллекции, по порядку. */
  prizes: string[];
  /** Выбранный предмет (если коллекцию можно «надеть»). */
  chosen?: string;
  /** Сколько игр закончено и сколько из них на три звезды. */
  played: number;
  perfect: number;
  /** Самый высокий уровень, на котором ребёнок играл. */
  peak: number;
}

export type AllProgress = Record<string, GameProgress>;

export const freshGame = (): GameProgress => ({ best: [], prizes: [], played: 0, perfect: 0, peak: 0 });

const nat = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Чистит сохранение (чужое, старое или битое) до нужной формы. */
export function parseGame(raw: unknown): GameProgress {
  const p = (raw ?? {}) as Partial<GameProgress>;
  return {
    best: Array.isArray(p.best) ? p.best.map((s) => Math.min(3, nat(s))) : [],
    prizes: Array.isArray(p.prizes) ? [...new Set(p.prizes.filter((x): x is string => typeof x === 'string'))] : [],
    ...(typeof p.chosen === 'string' ? { chosen: p.chosen } : {}),
    played: nat(p.played),
    perfect: nat(p.perfect),
    peak: nat(p.peak),
  };
}

export function parseAll(raw: unknown): AllProgress {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, parseGame(v)]));
}

export interface GameResult {
  /** Уровень, на котором шла игра (1…). 0 — у игры нет уровней. */
  level: number;
  stars: number;
}

export interface Recorded {
  progress: GameProgress;
  /** Новый предмет коллекции, если игра его дала. */
  prize?: string;
  /** Звёзд на этом уровне стало больше, чем было. */
  newBest: boolean;
}

/**
 * Записывает итог игры. Предмет коллекции даёт игра на три звезды, как машину
 * в гонке — заезд без ошибок; если коллекция собрана, просто растёт счётчик.
 */
export function recordResult(p: GameProgress, r: GameResult, collection: readonly string[]): Recorded {
  const stars = Math.max(0, Math.min(3, Math.floor(r.stars)));
  const best = [...p.best];
  let newBest = false;
  if (r.level >= 1) {
    while (best.length < r.level) best.push(0);
    if (stars > best[r.level - 1]!) {
      best[r.level - 1] = stars;
      newBest = true;
    }
  }
  const prize = stars === 3 ? nextPrize(p, collection) : undefined;
  return {
    progress: {
      ...p,
      best,
      prizes: prize ? [...p.prizes, prize] : p.prizes,
      played: p.played + 1,
      perfect: p.perfect + (stars === 3 ? 1 : 0),
      peak: Math.max(p.peak, r.level),
    },
    ...(prize ? { prize } : {}),
    newBest,
  };
}

/** Следующий предмет коллекции (тот, что показан как «следующий»), или undefined, если всё собрано. */
export const nextPrize = (p: GameProgress, collection: readonly string[]) => collection.find((id) => !p.prizes.includes(id));

/** Сколько звёзд всего собрано по уровням (для значка в меню). */
export const totalStars = (p: GameProgress) => p.best.reduce((a, b) => a + b, 0);

// ---------- localStorage ----------

function store(): globalThis.Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function loadAll(): AllProgress {
  try {
    return parseAll(JSON.parse(store()?.getItem(PROGRESS_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export const loadGame = (game: string): GameProgress => loadAll()[game] ?? freshGame();

export function saveGame(game: string, p: GameProgress) {
  try {
    store()?.setItem(PROGRESS_KEY, JSON.stringify({ ...loadAll(), [game]: p }));
  } catch {
    /* private mode */
  }
}

/** Записывает итог игры в хранилище и возвращает, что получилось. */
export function finishGame(game: string, r: GameResult, collection: readonly string[]): Recorded {
  const out = recordResult(loadGame(game), r, collection);
  saveGame(game, out.progress);
  return out;
}

/** Коротко для меню и для родителя: звёзды, предметы коллекции, лучший уровень. */
export function progressSummary(game: string, collectionSize: number) {
  const p = loadGame(game);
  return { stars: totalStars(p), prizes: p.prizes.length, of: collectionSize, peak: p.peak, played: p.played };
}
