import { freshProgress, parseProgress, recordRace, type CarId, type Progress, type RaceOutcome, type Track } from '../race/logic';

/**
 * «Полёт слов»: the plane game. It flies on the race's engine (the voice says
 * an English word, fly into the right card, two heights), but has its own
 * routes, its own save and its own hangar. A plane comes into the hangar when
 * its goal is reached: a number of flights, right words, flights without a
 * mistake, three stars on a route, a route reached. The child sees every goal
 * and how far along it is, so there is always a next plane to work for.
 */

export type PlaneShape = 'prop' | 'biplane' | 'sea' | 'twin' | 'jet';

export type Goal =
  | { kind: 'start' }
  /** Flights finished, any route. */
  | { kind: 'flights'; n: number }
  /** Right words in all flights together. */
  | { kind: 'words'; n: number }
  /** Flights without a single mistake on the own route or a harder one. */
  | { kind: 'flawless'; n: number }
  /** Three stars on this route. */
  | { kind: 'stars'; track: number }
  /** This route opened. */
  | { kind: 'route'; track: number }
  /** Three stars on every route. */
  | { kind: 'allStars' };

export interface Plane {
  id: CarId;
  name: string;
  shape: PlaneShape;
  body: string;
  dark: string;
  number: number;
  /** What the English voice calls it: the colour and the kind of plane. */
  en: string;
  goal: Goal;
}

/** The routes: from an easy first flight to a night flight in a storm. */
export const SKY_TRACKS: readonly Track[] = [
  { name: 'Первый полёт', vehicle: 'plane', time: 'day', lanes: 3, heights: 2, pool: 'easy', sameGroup: false, cones: false, minSpeed: 8, maxSpeed: 8, boost: 0 },
  { name: 'Над морем', vehicle: 'plane', time: 'day', lanes: 3, heights: 2, pool: 'sky', sameGroup: false, cones: false, minSpeed: 9, maxSpeed: 9, boost: 1 },
  { name: 'Над облаками', vehicle: 'plane', time: 'sunset', lanes: 3, heights: 2, pool: 'mix', sameGroup: true, cones: true, minSpeed: 10, maxSpeed: 10, boost: 2 },
  { name: 'Ночной рейс', vehicle: 'plane', time: 'night', lanes: 3, heights: 2, pool: 'mix', sameGroup: true, cones: true, minSpeed: 11, maxSpeed: 11, boost: 3 },
];

/** In the order the goals get harder. Ids are kept from the race's old plane tab (saves use them). */
export const PLANES: readonly Plane[] = [
  { id: 'p-red', name: 'Ласточка', shape: 'prop', body: '#e63946', dark: '#9d0208', number: 7, en: 'The red plane!', goal: { kind: 'start' } },
  { id: 'p-blue', name: 'Стриж', shape: 'prop', body: '#3a86ff', dark: '#1d3f8f', number: 3, en: 'The blue plane!', goal: { kind: 'flights', n: 2 } },
  { id: 'p-green', name: 'Кузнечик', shape: 'biplane', body: '#38b000', dark: '#1b5e20', number: 9, en: 'The green biplane!', goal: { kind: 'stars', track: 0 } },
  { id: 'p-white', name: 'Чайка', shape: 'sea', body: '#f8f9fa', dark: '#1d3557', number: 1, en: 'The white seaplane!', goal: { kind: 'route', track: 1 } },
  { id: 'p-yellow', name: 'Шмель', shape: 'biplane', body: '#ffbe0b', dark: '#b07d00', number: 5, en: 'The yellow biplane!', goal: { kind: 'words', n: 60 } },
  { id: 'p-orange', name: 'Пеликан', shape: 'sea', body: '#fb8500', dark: '#9c4a00', number: 4, en: 'The orange seaplane!', goal: { kind: 'flawless', n: 2 } },
  { id: 'p-purple', name: 'Сова', shape: 'twin', body: '#7b2cbf', dark: '#3c096c', number: 6, en: 'The big purple plane!', goal: { kind: 'route', track: 2 } },
  { id: 'p-silver', name: 'Сокол', shape: 'twin', body: '#ced4da', dark: '#6c757d', number: 10, en: 'The big silver plane!', goal: { kind: 'words', n: 150 } },
  { id: 'p-black', name: 'Ворон', shape: 'jet', body: '#343a40', dark: '#111111', number: 13, en: 'The black jet!', goal: { kind: 'stars', track: 3 } },
  { id: 'p-gold', name: 'Орёл', shape: 'jet', body: '#ffc300', dark: '#b8860b', number: 1, en: 'The gold jet!', goal: { kind: 'allStars' } },
];

export const STARTER_PLANES: readonly CarId[] = PLANES.filter((p) => p.goal.kind === 'start').map((p) => p.id);
export const planeById = (id: CarId) => PLANES.find((c) => c.id === id) ?? PLANES[0]!;
export const planeLine = (id: CarId) => `plane.${id}`;

export const freshFlight = (): Progress => freshProgress(SKY_TRACKS, STARTER_PLANES);
export const parseFlight = (raw: unknown): Progress => parseProgress(raw, SKY_TRACKS, PLANES.map((p) => p.id), STARTER_PLANES);

/**
 * The first visit after the plane left the race: take the planes won there and
 * the stars of the two old plane tracks («Над морем», «Над облаками»).
 */
export function fromRace(raw: unknown): Progress {
  const p = freshFlight();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as { planes?: unknown; plane?: unknown; stars?: unknown; level?: unknown; misses?: unknown; seen?: unknown };
  const oldStars = Array.isArray(r.stars) ? r.stars : [];
  const lvl = typeof r.level === 'number' ? r.level : 0;
  return parseFlight({
    ...p,
    planes: r.planes,
    plane: r.plane,
    stars: [0, oldStars[3] ?? 0, oldStars[4] ?? 0, 0],
    // the old plane tracks were the race's 4th and 5th: a child who flew there already flies here
    level: lvl >= 4 ? 2 : lvl >= 3 ? 1 : 0,
    misses: r.misses,
    seen: r.seen,
  });
}

const routeOpen = (p: Progress, track: number) => track === 0 || track <= p.level || (p.stars[track - 1] ?? 0) > 0;

/** How far the child is towards a goal: `have` of `need`. */
export function goalProgress(g: Goal, p: Progress): { have: number; need: number } {
  switch (g.kind) {
    case 'start':
      return { have: 1, need: 1 };
    case 'flights':
      return { have: Math.min(p.runs, g.n), need: g.n };
    case 'words':
      return { have: Math.min(p.words, g.n), need: g.n };
    case 'flawless':
      return { have: Math.min(p.flawless, g.n), need: g.n };
    case 'stars':
      return { have: p.stars[g.track] ?? 0, need: 3 };
    case 'route':
      return { have: routeOpen(p, g.track) ? 1 : 0, need: 1 };
    case 'allStars':
      return { have: SKY_TRACKS.filter((_, i) => (p.stars[i] ?? 0) >= 3).length, need: SKY_TRACKS.length };
  }
}

export const goalMet = (g: Goal, p: Progress) => {
  const { have, need } = goalProgress(g, p);
  return have >= need;
};

/** The goal in a few words for the hangar card (the child reads; the numbers show the way). */
export function goalText(g: Goal): string {
  switch (g.kind) {
    case 'start':
      return 'есть с начала';
    case 'flights':
      return `${g.n} ${plural(g.n, 'полёт', 'полёта', 'полётов')}`;
    case 'words':
      return `${g.n} слов`;
    case 'flawless':
      return `${g.n} ${plural(g.n, 'полёт', 'полёта', 'полётов')} без ошибок`;
    case 'stars':
      return `3 звезды: «${SKY_TRACKS[g.track]!.name}»`;
    case 'route':
      return `открой «${SKY_TRACKS[g.track]!.name}»`;
    case 'allStars':
      return '3 звезды везде';
  }
}

function plural(n: number, one: string, few: string, many: string) {
  const d = n % 10;
  const t = n % 100;
  if (d === 1 && t !== 11) return one;
  if (d >= 2 && d <= 4 && (t < 12 || t > 14)) return few;
  return many;
}

/** The Russian line Bolt says when the child taps a plane that is still locked. */
export const goalLine = (g: Goal) => `raccoon.sky.goal.${g.kind}`;

/** The plane the child is closest to getting, for the hint on the route screen. */
export function nextPlane(p: Progress): Plane | undefined {
  const left = PLANES.filter((pl) => !p.planes.includes(pl.id));
  return left[0];
}

/**
 * After a flight: stars, coins, word memory and counters as in the race, then
 * every plane whose goal is now reached flies into the hangar.
 */
export function recordFlight(p: Progress, track: number, o: RaceOutcome): { progress: Progress; planes: Plane[]; coins: number; practice: boolean } {
  const r = recordRace(p, track, o, SKY_TRACKS);
  const c = claimPlanes(r.progress);
  return { progress: c.progress, planes: c.planes, coins: r.coins, practice: r.practice };
}

/** Puts every plane whose goal is reached into the hangar (call again after the level moves: a route may open). */
export function claimPlanes(p: Progress): { progress: Progress; planes: Plane[] } {
  const won = PLANES.filter((pl) => !p.planes.includes(pl.id) && goalMet(pl.goal, p));
  return { progress: won.length ? { ...p, planes: [...p.planes, ...won.map((w) => w.id)] } : p, planes: won };
}

/** English lines of the flight game. */
export function englishLines(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of PLANES) out[planeLine(c.id)] = c.en;
  out['race.plane'] = 'The plane!';
  out['sky.land'] = 'Landing!';
  return out;
}
