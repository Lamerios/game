import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import { PICTURES } from '../src/games/snake/logic';
import {
  BOOST_AFTER, boosterTask, boostSteps, CARS, englishLines, freshProgress, isFlawless, landingOptions, LINE_MAX, makeMaze, mazeDistances, mazeSize,
  nextCar, nitroPrice, numberWords, parseProgress, planRace, poolOf, PRAISE_LINES, recordRace, ROWS_PER_RACE, starsFor, STARTER_CARS, TRACKS, unlocked,
  type RaceOutcome,
} from '../src/games/race/logic';

const outcome = (o: Partial<RaceOutcome>): RaceOutcome => ({ correct: 0, hits: [], missed: [], asked: [], bumps: 0, rows: ROWS_PER_RACE, ...o });

describe('race', () => {
  it('gives stars for 5, 7 and 10 right words', () => {
    expect([0, 4, 5, 6, 7, 9, 10, 12].map(starsFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('has a clip for every English line and every word on the boards', () => {
    const clips = allClips([]);
    for (const [id, text] of Object.entries(englishLines())) {
      expect(ENGLISH[id], id).toBe(text);
      expect(clips.get(`en.${id}`), id).toBe(text);
    }
    for (const id of PRAISE_LINES) expect(ENGLISH[id], id).toBeDefined();
    for (const t of TRACKS) for (const w of poolOf(t.pool)) expect(ENGLISH[w.id], w.id).toBeDefined();
    for (let n = 1; n <= LINE_MAX; n++) expect(ENGLISH[`n${n}`], `n${n}`).toBeDefined();
    expect(numberWords(21)).toBe('twenty-one');
    expect(numberWords(40)).toBe('forty');
  });

  it('has a picture for every word', () => {
    const files = new Set(readdirSync('public/snake'));
    for (const w of PICTURES) expect(files.has(`${w.id}.webp`), w.id).toBe(true);
  });

  it('has every Russian line the race code asks for', () => {
    const ph = content.phrases as Record<string, string>;
    const dir = 'src/games/race';
    const ids = new Set<string>();
    for (const f of readdirSync(dir)) for (const m of readFileSync(`${dir}/${f}`, 'utf8').matchAll(/'(raccoon\.race\.[a-z0-9.]+)'/g)) ids.add(m[1]!);
    expect(ids.size).toBeGreaterThan(30);
    TRACKS.forEach((_, i) => ids.add(`raccoon.race.start.${i}`));
    for (let i = 0; i < 3; i++) ids.add(`raccoon.race.crash.${i}`);
    for (let i = 0; i <= 3; i++) ids.add(`raccoon.race.finish.${i}`);
    for (const id of ids) expect(ph[id], id).toBeDefined();
  });

  it('plans rows: the target once, no two cards on a spot, cones never block every way', () => {
    const rng = mulberry32(3);
    TRACKS.forEach((t) => {
      for (let k = 0; k < 30; k++) {
        const rows = planRace(t, rng, { apple: 3 }, {});
        expect(rows).toHaveLength(ROWS_PER_RACE);
        rows.forEach((r, i) => {
          expect(r.cards).toHaveLength(t.lanes);
          expect(new Set(r.cards.map((c) => c.word)).size).toBe(t.lanes);
          expect(new Set(r.cards.map((c) => `${c.lane}/${c.h}`)).size).toBe(t.lanes);
          expect(r.cards.filter((c) => c.word === r.target)).toHaveLength(1);
          for (const c of [...r.cards, ...r.cones]) {
            expect(c.lane >= 0 && c.lane < t.lanes).toBe(true);
            expect(c.h >= 0 && c.h < t.heights).toBe(true);
          }
          if (t.heights === 1) expect(r.cards.map((c) => c.lane).sort()).toEqual([...Array(t.lanes).keys()]);
          expect(r.cones.length).toBeLessThan(t.lanes * t.heights);
          if (!t.cones) expect(r.cones).toEqual([]);
          if (i > 0) expect(r.target).not.toBe(rows[i - 1]!.target);
        });
      }
    });
  });

  it('brings only a few never-seen words into a race', () => {
    const rng = mulberry32(5);
    const t = TRACKS[1]!;
    const seen = Object.fromEntries(poolOf(t.pool).slice(0, 40).map((w) => [w.id, 1]));
    for (let k = 0; k < 20; k++) {
      const fresh = new Set(planRace(t, rng, {}, seen).map((r) => r.target).filter((id) => !seen[id]));
      expect(fresh.size).toBeLessThanOrEqual(3);
    }
  });

  it('keeps the best stars, opens tracks in order, counts coins and remembers missed words', () => {
    let p = freshProgress();
    expect(unlocked(p, 1)).toBe(false);
    let r = recordRace(p, 0, outcome({ correct: 8, hits: ['cat'], missed: ['dog', 'dog'], asked: ['cat', 'dog'] }));
    p = r.progress;
    expect(r.coins).toBe(8);
    expect(r.newCar).toBeUndefined();
    expect(p.stars[0]).toBe(2);
    expect(p.misses.dog).toBe(2);
    expect(p.seen).toEqual({ cat: 1, dog: 1 });
    expect(unlocked(p, 1)).toBe(true);
    r = recordRace(p, 0, outcome({ correct: 3, hits: ['dog'] }));
    p = r.progress;
    expect(p.stars[0]).toBe(2);
    expect(p.misses.dog).toBe(1);
    expect(p.coins).toBe(11);
    expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(parseProgress({ car: 'pink', stars: [9, 'x'], misses: { a: -1 } })).toEqual(freshProgress());
    expect(parseProgress({ nitro: 99 }).nitro).toBe(3);
    expect(CARS.map((c) => c.id)).toContain(parseProgress(null).car);
  });

  it('gives a new car for a race without a single mistake', () => {
    let p = freshProgress();
    expect(p.cars).toEqual([...STARTER_CARS]);
    const clean = outcome({ correct: ROWS_PER_RACE });
    expect(isFlawless(clean)).toBe(true);
    expect(isFlawless({ ...clean, bumps: 1 })).toBe(false);
    expect(isFlawless({ ...clean, correct: 11, missed: ['cat'] })).toBe(false);
    const got: string[] = [];
    for (let i = 0; i < CARS.length; i++) {
      const r = recordRace(p, 0, clean);
      if (r.newCar) got.push(r.newCar.id);
      p = r.progress;
    }
    expect(p.cars).toHaveLength(CARS.length);
    expect(got).toEqual(CARS.slice(STARTER_CARS.length).map((c) => c.id));
    expect(nextCar(p)).toBeUndefined();
    expect(p.flawless).toBe(CARS.length);
    expect(p.coins).toBe(CARS.length * (ROWS_PER_RACE + 5));
    // a car won is kept and can be chosen
    expect(parseProgress({ ...p, car: 'gold' }).car).toBe('gold');
  });

  it('opens the plane after the car tracks', () => {
    const plane = TRACKS.findIndex((t) => t.vehicle === 'plane');
    expect(plane).toBeGreaterThan(0);
    expect(TRACKS.slice(0, plane).every((t) => t.vehicle === 'car')).toBe(true);
    for (const t of TRACKS.filter((x) => x.vehicle === 'plane')) expect(t.heights).toBe(2);
  });

  it('prices nitro at 3 to 9 coins', () => {
    const rng = mulberry32(1);
    const seen = new Set(Array.from({ length: 200 }, () => nitroPrice(rng)));
    expect([...seen].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('race number line', () => {
  it('booster landing options hold the right place and stay on the line', () => {
    const rng = mulberry32(8);
    for (let pos = 0; pos <= 40; pos++) for (const v of [2, 3, 5, 9, -2, -4]) {
      if (pos + v < 0) continue;
      const o = landingOptions(pos, v, rng);
      expect(o).toContain(Math.min(LINE_MAX, pos + v));
      expect(new Set(o).size).toBe(o.length);
      for (const x of o) expect(v > 0 ? x > pos && x <= LINE_MAX : x < pos && x >= 0).toBe(true);
    }
  });

  it('boosters get harder from track to track and always land on the line', () => {
    const rng = mulberry32(11);
    const kinds = TRACKS.map(() => new Set<string>());
    TRACKS.forEach((t, i) => {
      for (let k = 0; k < 200; k++) {
        const pos = Math.floor(rng() * 12);
        for (const after of BOOST_AFTER) {
          const task = boosterTask(t.boost, after, pos, rng);
          kinds[i]!.add(task.kind);
          const right = pos + boostSteps(task);
          expect(task.right, JSON.stringify(task)).toBe(Math.max(0, Math.min(LINE_MAX, right)));
          expect(task.right).toBeGreaterThanOrEqual(0);
          if (task.kind === 'compare') expect(task.a).not.toBe(task.b);
          if (task.kind === 'pairs') expect(task.a[0] + task.a[1]).not.toBe(task.b[0] + task.b[1]);
        }
      }
    });
    expect([...kinds[0]!]).toEqual(['compare']);
    expect(kinds[1]!.has('sum')).toBe(true);
    expect(kinds[2]!.has('minus')).toBe(true);
    expect(kinds[4]!.has('pairs')).toBe(true);
  });
});

describe('race maze', () => {
  it('is a perfect maze with the part in a dead end on the way', () => {
    const rng = mulberry32(21);
    for (let track = 0; track < TRACKS.length; track++) {
      for (let k = 0; k < 30; k++) {
        const [cols, rows] = mazeSize(track);
        const m = makeMaze(cols, rows, rng);
        const d = mazeDistances(m, m.start);
        // every cell is reachable
        for (const row of d) for (const v of row) expect(v).toBeGreaterThanOrEqual(0);
        // a tree: cells - 1 openings
        let open = 0;
        m.walls.forEach((r) => r.forEach((w) => (open += w.filter((b) => !b).length)));
        expect(open / 2).toBe(cols * rows - 1);
        // walls agree on both sides
        for (let y = 0; y < rows; y++) for (let x = 0; x + 1 < cols; x++) expect(m.walls[y]![x]![1]).toBe(m.walls[y]![x + 1]![3]);
        for (let y = 0; y + 1 < rows; y++) for (let x = 0; x < cols; x++) expect(m.walls[y]![x]![2]).toBe(m.walls[y + 1]![x]![0]);
        expect(m.walls[m.part.y]![m.part.x]!.filter((b) => !b)).toHaveLength(1);
        expect(m.part).not.toEqual(m.start);
        expect(m.part).not.toEqual(m.exit);
      }
    }
  });
});
