import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import {
  allRoutes, ANIMALS, canGo, cover, levelSpec, magpieSteal, makePuzzle, MAX_LEVEL, nextHint, parseLevel, ROUTE_VEHICLES, routeEnglish, runPlan,
  workingRoutes, type Terrain, type Vehicle, type Way,
} from '../src/games/parcel/route';

describe('parcel: route planner', () => {
  it('has pictures, English clips and Russian lines', () => {
    for (const v of ROUTE_VEHICLES) expect(existsSync(join(__dirname, '..', 'public', 'parcel', `${v}.webp`)), v).toBe(true);
    for (const a of ANIMALS) expect(existsSync(join(__dirname, '..', 'public', 'snake', `${a}.webp`)), a).toBe(true);
    const clips = allClips([]);
    for (const [id, text] of Object.entries(routeEnglish())) {
      expect(ENGLISH[id], id).toBe(text);
      expect(clips.get(`en.${id}`), id).toBe(text);
    }
    const ph = content.phrases as Record<string, string>;
    for (const t of ['sea', 'road', 'rails', 'sand', 'snow', 'mountains', 'air'] as Terrain[]) expect(ph[`rumb.route.bad.${t}`], t).toBeDefined();
  });

  it('every terrain has a vehicle, and only the helicopter goes over mountains', () => {
    for (const t of ['sea', 'road', 'rails', 'sand', 'snow', 'mountains', 'air'] as Terrain[]) {
      expect(ROUTE_VEHICLES.some((v) => canGo(v, t)), t).toBe(true);
    }
    expect(ROUTE_VEHICLES.filter((v) => canGo(v, 'mountains'))).toEqual(['helicopter']);
    expect(ROUTE_VEHICLES.filter((v) => canGo(v, 'air'))).toEqual(['plane']);
  });

  it('covers a route with the garage, keeping the helicopter for the mountains', () => {
    const ways: Way[] = [{ a: 0, b: 1, terrain: 'sea' }, { a: 1, b: 2, terrain: 'mountains' }];
    expect(cover([0, 1], ways, ['helicopter', 'boat'])).toEqual(['boat', 'helicopter']);
    expect(cover([0, 1], ways, ['helicopter', 'car'])).toBeUndefined();
  });

  it('makes solvable puzzles at every level; from level 2 the shortest way is a trap', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const rng = mulberry32(level * 31);
      const spec = levelSpec(level);
      for (let k = 0; k < 30; k++) {
        const p = makePuzzle(level, rng);
        const routes = allRoutes(p.towns.length, p.ways, p.start, p.goal);
        const shortest = Math.min(...routes.map((r) => r.length));
        const working = workingRoutes(p);
        expect(working.length, `L${level}`).toBeGreaterThan(0);
        // The solution works and uses garage tokens.
        const plan = new Map(p.solution.map((s) => [s.way, s.vehicle] as [number, Vehicle]));
        expect(runPlan(p, plan).ok).toBe(true);
        expect(p.solution.length).toBeLessThanOrEqual(spec.maxLen);
        const pool = [...p.garage];
        for (const s of p.solution) {
          const i = pool.indexOf(s.vehicle);
          expect(i, `${s.vehicle} in garage`).toBeGreaterThanOrEqual(0);
          pool.splice(i, 1);
        }
        if (spec.trap === 'all') expect(working.every((r) => r.length > shortest), `L${level} trap`).toBe(true);
        if (spec.trap === 'some') expect(routes.filter((r) => r.length === shortest).some((r) => !cover(r, p.ways, p.garage))).toBe(true);
        expect(p.animals[p.goal]).toBe(p.target);
        expect(p.animals[p.start]).toBeUndefined();
        expect(Object.keys(p.animals)).toHaveLength(1 + spec.decoys);
      }
    }
  });

  it('runs a plan: stops on a vehicle that cannot go, or where the laid ways end', () => {
    const towns = [0, 1, 2].map((i) => ({ x: i * 100, y: 0, airport: false }));
    const ways: Way[] = [{ a: 0, b: 1, terrain: 'sea' }, { a: 1, b: 2, terrain: 'sand' }];
    const p = { towns, ways, start: 0, goal: 2 };
    expect(runPlan(p, new Map<number, Vehicle>([[0, 'boat'], [1, 'camel']]))).toEqual({ ok: true, route: [0, 1] });
    expect(runPlan(p, new Map<number, Vehicle>([[0, 'boat'], [1, 'car']]))).toEqual({ ok: false, why: 'wrong', route: [0], way: 1, vehicle: 'car' });
    expect(runPlan(p, new Map<number, Vehicle>([[0, 'boat']]))).toEqual({ ok: false, why: 'gap', route: [0] });
    expect(runPlan(p, new Map<number, Vehicle>([[1, 'camel']]))).toEqual({ ok: false, why: 'gap', route: [] });
  });

  it('hints the first way of the solution that is not laid right', () => {
    const p = makePuzzle(3, mulberry32(4));
    const first = p.solution[0]!;
    expect(nextHint(p, new Map())).toEqual(first);
    expect(nextHint(p, new Map([[first.way, first.vehicle]]))).toEqual(p.solution[1]);
  });

  it('the magpie only steals what the puzzle can do without', () => {
    for (let k = 0; k < 30; k++) {
      const rng = mulberry32(100 + k);
      const p = makePuzzle(5, rng);
      const i = magpieSteal(p, rng);
      if (i < 0) continue;
      expect(workingRoutes({ ...p, garage: p.garage.filter((_, j) => j !== i) }).length).toBeGreaterThan(0);
    }
    expect(magpieSteal(makePuzzle(2, mulberry32(1)), mulberry32(2))).toBe(-1);
  });

  it('reads the saved level defensively', () => {
    expect(parseLevel(null)).toBe(1);
    expect(parseLevel({ level: 4 })).toBe(4);
    expect(parseLevel({ level: 99 })).toBe(1);
  });
});
