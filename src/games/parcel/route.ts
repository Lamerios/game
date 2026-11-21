import { shuffle, type Rng } from '../common/rng';

/**
 * «Посылка», механика «Штурман маршрута»: rules without Phaser, so they can be tested.
 *
 * The map is a small graph: towns joined by ways of different kinds (sea, road,
 * rails, sand, snow, mountains, air). The garage holds a few vehicles, one token
 * each. The child lays vehicles on ways to make a whole route from the harbour to
 * the animal the dispatcher names in English, then presses «Поехали!»: the plan
 * runs and stops visibly where it breaks. The garage never covers the shortest
 * way (from level 2), so the obvious route is a trap and the child has to plan:
 * which ways can my vehicles take, and is there a longer way round that fits?
 */

export type Terrain = 'sea' | 'road' | 'rails' | 'sand' | 'snow' | 'mountains' | 'air';
export type Vehicle = 'boat' | 'car' | 'bus' | 'train' | 'camel' | 'sled' | 'helicopter' | 'plane';

export const ROUTE_VEHICLES: readonly Vehicle[] = ['boat', 'car', 'bus', 'train', 'camel', 'sled', 'helicopter', 'plane'];

/** Where each vehicle can go. The helicopter goes anywhere but the long air ways; the plane only there. */
export const CAN: Record<Vehicle, readonly Terrain[]> = {
  boat: ['sea'],
  car: ['road'],
  bus: ['road'],
  train: ['rails'],
  camel: ['sand'],
  sled: ['snow'],
  helicopter: ['sea', 'road', 'rails', 'sand', 'snow', 'mountains'],
  plane: ['air'],
};

export const canGo = (v: Vehicle, t: Terrain) => CAN[v].includes(t);

/** Who waits for parcels: picture public/snake/<id>.webp, English word clip en.<id>. */
export const ANIMALS = ['lion', 'penguin', 'giraffe', 'kangaroo', 'tiger', 'zebra', 'elephant', 'monkey', 'bear', 'crocodile', 'owl', 'fox'] as const;
export type Animal = (typeof ANIMALS)[number];

export interface Town {
  x: number;
  y: number;
  airport: boolean;
}

export interface Way {
  a: number;
  b: number;
  terrain: Terrain;
}

export interface Puzzle {
  level: number;
  towns: Town[];
  ways: Way[];
  start: number;
  goal: number;
  /** town → animal living there; the goal's animal is the one to deliver to. */
  animals: Partial<Record<number, Animal>>;
  target: Animal;
  /** Vehicles in the garage, one token each. */
  garage: Vehicle[];
  /** One working route (ways in order) with the vehicle for each, for hints and tests. */
  solution: { way: number; vehicle: Vehicle }[];
}

export interface LevelSpec {
  cols: number;
  rows: number;
  terrains: Terrain[];
  /** Spare tokens beyond the solution. */
  extras: number;
  /** Other animals on the map besides the one to deliver to. */
  decoys: number;
  /**
   * The trap: 'all' — no shortest route is drivable with the garage, the way
   * round is the only one; 'some' — at least one shortest route is not, so the
   * child has to choose between routes that look the same.
   */
  trap: 'none' | 'some' | 'all';
  minLen: number;
  /** Longest route the solution may take (keeps the garage small). */
  maxLen: number;
}

export const MAX_LEVEL = 8;

export function levelSpec(level: number): LevelSpec {
  const L = Math.max(1, Math.min(MAX_LEVEL, level));
  const base: Terrain[] = ['sea', 'road', 'rails', 'sand', 'snow'];
  switch (L) {
    case 1: return { cols: 3, rows: 1, terrains: ['sea', 'road', 'sand'], extras: 1, decoys: 0, trap: 'none', minLen: 2, maxLen: 2 };
    case 2: return { cols: 3, rows: 2, terrains: ['sea', 'road', 'rails', 'sand'], extras: 1, decoys: 1, trap: 'some', minLen: 2, maxLen: 3 };
    case 3: return { cols: 4, rows: 2, terrains: base, extras: 1, decoys: 1, trap: 'some', minLen: 3, maxLen: 4 };
    case 4: return { cols: 4, rows: 2, terrains: [...base, 'mountains'], extras: 2, decoys: 2, trap: 'all', minLen: 3, maxLen: 5 };
    case 5: return { cols: 4, rows: 3, terrains: [...base, 'mountains'], extras: 2, decoys: 2, trap: 'all', minLen: 4, maxLen: 5 };
    case 6: return { cols: 4, rows: 3, terrains: [...base, 'mountains', 'air'], extras: 2, decoys: 2, trap: 'all', minLen: 4, maxLen: 6 };
    case 7: return { cols: 5, rows: 3, terrains: [...base, 'mountains', 'air'], extras: 3, decoys: 3, trap: 'all', minLen: 4, maxLen: 6 };
    default: return { cols: 5, rows: 3, terrains: [...base, 'mountains', 'air'], extras: 3, decoys: 3, trap: 'all', minLen: 5, maxLen: 6 };
  }
}

/** Map area on screen (the scene draws inside it). */
export const MAP = { x0: 150, x1: 1130, y0: 180, y1: 500 };

const other = (w: Way, t: number) => (w.a === t ? w.b : w.a);

/** All simple routes (as way indices) from `from` to `to`. Small graphs only. */
export function allRoutes(towns: number, ways: readonly Way[], from: number, to: number, limit = 5000): number[][] {
  const out: number[][] = [];
  const seen = new Set<number>([from]);
  const path: number[] = [];
  const go = (t: number) => {
    if (out.length >= limit) return;
    if (t === to) {
      out.push([...path]);
      return;
    }
    ways.forEach((w, i) => {
      if (w.a !== t && w.b !== t) return;
      const n = other(w, t);
      if (seen.has(n)) return;
      seen.add(n);
      path.push(i);
      go(n);
      path.pop();
      seen.delete(n);
    });
  };
  if (towns > 0) go(from);
  return out;
}

/** Vehicles from `garage` for each way of `route` (one token per way), or undefined if they don't fit. */
export function cover(route: readonly number[], ways: readonly Way[], garage: readonly Vehicle[]): Vehicle[] | undefined {
  const used = garage.map(() => false);
  const pick: Vehicle[] = [];
  // Narrow ways first (fewest vehicles fit), so the helicopter is kept for where it is needed.
  const order = [...route.keys()].sort((i, j) => fitCount(ways[route[i]!]!.terrain, garage) - fitCount(ways[route[j]!]!.terrain, garage));
  const go = (k: number): boolean => {
    if (k === order.length) return true;
    const i = order[k]!;
    const t = ways[route[i]!]!.terrain;
    for (let g = 0; g < garage.length; g++) {
      if (used[g] || !canGo(garage[g]!, t)) continue;
      used[g] = true;
      pick[i] = garage[g]!;
      if (go(k + 1)) return true;
      used[g] = false;
    }
    return false;
  };
  return go(0) ? pick : undefined;
}

const fitCount = (t: Terrain, garage: readonly Vehicle[]) => garage.filter((v) => canGo(v, t)).length;

/** Routes from start to goal the garage can drive. */
export function workingRoutes(p: Pick<Puzzle, 'towns' | 'ways' | 'start' | 'goal' | 'garage'>): number[][] {
  return allRoutes(p.towns.length, p.ways, p.start, p.goal).filter((r) => cover(r, p.ways, p.garage));
}

/** The one vehicle that is "the" vehicle for a terrain (road: car or bus). */
function vehicleFor(t: Terrain, rng: Rng): Vehicle {
  switch (t) {
    case 'sea': return 'boat';
    case 'road': return rng() < 0.5 ? 'car' : 'bus';
    case 'rails': return 'train';
    case 'sand': return 'camel';
    case 'snow': return 'sled';
    case 'mountains': return 'helicopter';
    case 'air': return 'plane';
  }
}

function lattice(spec: LevelSpec, rng: Rng): { towns: Town[]; ways: Way[] } {
  const { cols, rows } = spec;
  const towns: Town[] = [];
  const dx = (MAP.x1 - MAP.x0) / (cols - 1);
  const dy = rows > 1 ? (MAP.y1 - MAP.y0) / (rows - 1) : 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = c === 0 || c === cols - 1 ? 0 : (rng() - 0.5) * dx * 0.25;
      // No vertical jitter: rows are close enough already for the badges between them.
      const jy = 0;
      towns.push({ x: Math.round(MAP.x0 + c * dx + jx), y: Math.round((rows > 1 ? MAP.y0 + r * dy : (MAP.y0 + MAP.y1) / 2) + jy), airport: false });
    }
  }
  const id = (c: number, r: number) => r * cols + c;
  const ways: Way[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c + 1 < cols; c++) ways.push({ a: id(c, r), b: id(c + 1, r), terrain: 'road' });
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c < cols; c++) ways.push({ a: id(c, r), b: id(c, r + 1), terrain: 'road' });
  // Drop a few ways at random, keeping the map connected, so it is not a plain grid.
  const drop = rows > 1 ? Math.floor(ways.length * 0.2) : 0;
  for (const i of shuffle(rng, [...ways.keys()]).slice(0, drop)) {
    const rest = ways.filter((_, k) => k !== i && ways[k]!.terrain !== ('x' as Terrain));
    if (connected(towns.length, rest)) ways[i]!.terrain = 'x' as Terrain;
  }
  return { towns, ways: ways.filter((w) => w.terrain !== ('x' as Terrain)) };
}

function connected(n: number, ways: readonly Way[]): boolean {
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const t = stack.pop()!;
    for (const w of ways) {
      if (w.a !== t && w.b !== t) continue;
      const o = other(w, t);
      if (!seen.has(o)) {
        seen.add(o);
        stack.push(o);
      }
    }
  }
  return seen.size === n;
}

/**
 * A new delivery for this level. Tries random maps until one fits the level's
 * rules: a working route of at least minLen ways and, with `trap`, no working
 * route among the shortest ones.
 */
export function makePuzzle(level: number, rng: Rng): Puzzle {
  const spec = levelSpec(level);
  for (let attempt = 0; attempt < 400; attempt++) {
    const { towns, ways } = lattice(spec, rng);
    const rows = spec.rows;
    const cols = spec.cols;
    const start = Math.floor(rng() * rows) * cols;
    const goal = Math.floor(rng() * rows) * cols + cols - 1;
    // Terrains: air ways only between two airports, far apart on the map.
    const land = spec.terrains.filter((t) => t !== 'air');
    for (const w of ways) w.terrain = land[Math.floor(rng() * land.length)]!;
    if (spec.terrains.includes('air')) {
      const a = towns.findIndex((_, i) => i !== start && i !== goal && i % cols === 1);
      const b = towns.findIndex((_, i) => i !== start && i % cols === cols - 2 && Math.floor(i / cols) !== Math.floor(a / cols));
      if (a >= 0 && b >= 0 && !ways.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) {
        towns[a]!.airport = true;
        towns[b]!.airport = true;
        ways.push({ a, b, terrain: 'air' });
      }
    }
    const routes = allRoutes(towns.length, ways, start, goal);
    if (!routes.length) continue;
    const shortest = Math.min(...routes.map((r) => r.length));
    const long = routes.filter((r) => r.length >= spec.minLen && r.length <= spec.maxLen && (spec.trap !== 'all' || r.length > shortest));
    if (!long.length) continue;
    const route = long[Math.floor(rng() * long.length)]!;
    // A route of one kind only (all road) is no puzzle: at least two kinds of way on it.
    if (new Set(route.map((w) => ways[w]!.terrain)).size < Math.min(2, route.length)) continue;
    const solution = route.map((way) => ({ way, vehicle: vehicleFor(ways[way]!.terrain, rng) }));
    // Spares: vehicles for ways that are not on this route (so they look useful).
    const offRoute = ways.filter((_, i) => !route.includes(i)).map((w) => vehicleFor(w.terrain, rng));
    const anyLand = spec.terrains.filter((t) => t !== 'mountains' && t !== 'air').map((t) => vehicleFor(t, rng));
    const spares = [...shuffle(rng, offRoute.filter((v) => v !== 'helicopter')), ...shuffle(rng, anyLand)].slice(0, spec.extras);
    if (spares.length < spec.extras) continue;
    const garage = shuffle(rng, [...solution.map((s) => s.vehicle), ...spares]);
    const p = { towns, ways, start, goal, garage };
    const working = workingRoutes(p);
    if (!working.length) continue;
    const works = new Set(working.map((r) => r.join(',')));
    const blocked = routes.filter((r) => r.length === shortest && !works.has(r.join(',')));
    if (spec.trap === 'all' && working.some((r) => r.length === shortest)) continue;
    if (spec.trap === 'some' && blocked.length === 0) continue;
    // Animals: the one to deliver to at the goal, others at other towns (never at the harbour).
    const zoo = shuffle(rng, ANIMALS);
    const target = zoo[0]!;
    const animals: Partial<Record<number, Animal>> = { [goal]: target };
    const places = shuffle(rng, towns.map((_, i) => i).filter((i) => i !== start && i !== goal));
    places.slice(0, spec.decoys).forEach((t, k) => (animals[t] = zoo[k + 1]!));
    return { level, towns, ways, start, goal, animals, target, garage, solution };
  }
  throw new Error(`No puzzle for level ${level}`);
}

// ---------- running a plan ----------

export type RunResult =
  | { ok: true; route: number[] }
  /** Stopped on `way`: the vehicle laid there can't go on that terrain. `route` = ways driven before it. */
  | { ok: false; why: 'wrong'; route: number[]; way: number; vehicle: Vehicle }
  /** Ran out of laid ways before the goal. `route` = ways driven. */
  | { ok: false; why: 'gap'; route: number[] };

/**
 * Runs the plan (way → vehicle). The parcel follows laid ways from the start:
 * if they lead to the goal it takes that route, otherwise the longest laid
 * route. On the way it stops at the first vehicle that can't go there.
 */
export function runPlan(p: Pick<Puzzle, 'towns' | 'ways' | 'start' | 'goal'>, plan: ReadonlyMap<number, Vehicle>): RunResult {
  const laid = p.ways.map((w, i) => (plan.has(i) ? w : undefined));
  const sub = laid.map((w) => w ?? { a: -1, b: -1, terrain: 'road' as Terrain });
  let route = allRoutes(p.towns.length, sub, p.start, p.goal, 200).sort((a, b) => a.length - b.length)[0];
  let reached = !!route;
  if (!route) {
    // Longest laid route from the start.
    let best: number[] = [];
    const seen = new Set([p.start]);
    const path: number[] = [];
    const go = (t: number) => {
      if (path.length > best.length) best = [...path];
      sub.forEach((w, i) => {
        if (w.a !== t && w.b !== t) return;
        const n = other(w, t);
        if (seen.has(n)) return;
        seen.add(n);
        path.push(i);
        go(n);
        path.pop();
        seen.delete(n);
      });
    };
    go(p.start);
    route = best;
    reached = false;
  }
  for (let k = 0; k < route.length; k++) {
    const way = route[k]!;
    const v = plan.get(way)!;
    if (!canGo(v, p.ways[way]!.terrain)) return { ok: false, why: 'wrong', route: route.slice(0, k), way, vehicle: v };
  }
  return reached ? { ok: true, route } : { ok: false, why: 'gap', route };
}

/** Towns along a route, starting at `from`. */
export function townsOf(ways: readonly Way[], route: readonly number[], from: number): number[] {
  const out = [from];
  for (const i of route) out.push(other(ways[i]!, out.at(-1)!));
  return out;
}

/** The next step of a hint: the first way of the solution not laid with a fitting vehicle. */
export function nextHint(p: Puzzle, plan: ReadonlyMap<number, Vehicle>): { way: number; vehicle: Vehicle } | undefined {
  return p.solution.find((s) => {
    const v = plan.get(s.way);
    return !v || !canGo(v, p.ways[s.way]!.terrain);
  });
}

/**
 * The magpie steals one spare token (from level 3), only if the puzzle stays
 * solvable without it. Returns the garage index taken, or -1.
 */
export function magpieSteal(p: Puzzle, rng: Rng): number {
  if (p.level < 3) return -1;
  const tries = shuffle(rng, [...p.garage.keys()]);
  for (const i of tries) {
    const garage = p.garage.filter((_, k) => k !== i);
    const working = workingRoutes({ ...p, garage });
    if (working.length && !working.some((r) => r.length === Math.min(...allRoutes(p.towns.length, p.ways, p.start, p.goal).map((x) => x.length)))) {
      return i;
    }
  }
  return -1;
}

/** English lines of this game: id → text, merged into phrases.json "english.words". */
export function routeEnglish(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of ROUTE_VEHICLES) out[v] = v;
  for (const a of ANIMALS) {
    out[a] = a;
    out[`to.${a}`] = `Take the parcel to the ${a}!`;
  }
  out['thanks'] = 'Thank you!';
  out['notme'] = 'Not for me!';
  return out;
}

/** Saved level. */
export const LEVEL_KEY = 'parcel-route-level';

export function parseLevel(raw: unknown): number {
  const l = (raw as { level?: unknown } | null)?.level;
  return typeof l === 'number' && Number.isInteger(l) && l >= 1 && l <= MAX_LEVEL ? l : 1;
}
