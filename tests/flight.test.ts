import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import { planeSvg } from '../src/games/flight/art';
import {
  claimPlanes, englishLines, freshFlight, fromRace, goalLine, goalMet, goalProgress, goalText, nextPlane, parseFlight, PLANES, recordFlight, SKY_TRACKS, STARTER_PLANES,
} from '../src/games/flight/logic';
import { planRace, poolOf, ROWS_PER_RACE, type RaceOutcome } from '../src/games/race/logic';

const outcome = (o: Partial<RaceOutcome>): RaceOutcome => ({ correct: 0, hits: [], missed: [], asked: [], bumps: 0, rows: ROWS_PER_RACE, ...o });
const clean = outcome({ correct: ROWS_PER_RACE });

describe('flight game', () => {
  it('flies only planes, with two heights, getting harder route by route', () => {
    expect(SKY_TRACKS.length).toBeGreaterThanOrEqual(4);
    for (const t of SKY_TRACKS) {
      expect(t.vehicle).toBe('plane');
      expect(t.heights).toBe(2);
    }
    for (let i = 1; i < SKY_TRACKS.length; i++) {
      expect(SKY_TRACKS[i]!.maxSpeed).toBeGreaterThanOrEqual(SKY_TRACKS[i - 1]!.maxSpeed);
      expect(SKY_TRACKS[i]!.boost).toBeGreaterThanOrEqual(SKY_TRACKS[i - 1]!.boost);
    }
    const rows = planRace(SKY_TRACKS[0]!, mulberry32(1));
    expect(rows).toHaveLength(ROWS_PER_RACE);
  });

  it('has a voice for every plane, every word and every Russian line it asks for', () => {
    const clips = allClips([]);
    for (const [id, text] of Object.entries(englishLines())) {
      expect(ENGLISH[id], id).toBe(text);
      expect(clips.get(`en.${id}`), id).toBe(text);
    }
    for (const t of SKY_TRACKS) for (const w of poolOf(t.pool)) expect(ENGLISH[w.id], w.id).toBeDefined();
    const ph = content.phrases as Record<string, string>;
    const ids = new Set<string>(['raccoon.sky.hello', 'raccoon.sky.rules', 'raccoon.sky.hangar', 'raccoon.sky.newplane']);
    SKY_TRACKS.forEach((_, i) => ids.add(`raccoon.sky.start.${i}`));
    for (let i = 0; i <= 3; i++) ids.add(`raccoon.sky.finish.${i}`);
    for (const p of PLANES) ids.add(goalLine(p.goal));
    for (const f of [...readdirSync('src/games/flight').map((f) => `src/games/flight/${f}`), 'src/games/race/RaceScene.ts', 'src/games/race/garage.ts']) {
      for (const m of readFileSync(f, 'utf8').matchAll(/'(raccoon\.sky\.[a-zA-Z0-9.]+)'/g)) ids.add(m[1]!);
    }
    for (const id of ids) expect(ph[id], id).toBeDefined();
  });

  it('draws every plane as an SVG with its own kind', () => {
    const shapes = new Set(PLANES.map((p) => p.shape));
    expect(shapes.size).toBe(5);
    for (const p of PLANES) {
      const svg = planeSvg(p);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('undefined');
    }
    expect(new Set(PLANES.map((p) => p.id)).size).toBe(PLANES.length);
  });

  it('starts with one plane and shows a goal for every other one', () => {
    const p = freshFlight();
    expect(p.planes).toEqual([...STARTER_PLANES]);
    expect(p.stars).toHaveLength(SKY_TRACKS.length);
    for (const pl of PLANES.slice(1)) {
      expect(goalMet(pl.goal, p), pl.id).toBe(false);
      expect(goalText(pl.goal).length).toBeGreaterThan(3);
    }
    expect(nextPlane(p)?.id).toBe(PLANES[1]!.id);
  });

  it('brings a plane when its goal is reached', () => {
    let p = freshFlight();
    // two flights, even with mistakes: the second plane
    let r = recordFlight(p, 0, outcome({ correct: 4, missed: ['cat'] }));
    expect(r.planes).toEqual([]);
    r = recordFlight(r.progress, 0, outcome({ correct: 4, missed: ['cat'] }));
    expect(r.planes.map((x) => x.id)).toEqual(['p-blue']);
    expect(r.progress.runs).toBe(2);
    expect(r.progress.words).toBe(8);
    // three stars on the first route: the biplane, and the second route opens → the seaplane
    r = recordFlight(r.progress, 0, outcome({ correct: 10, missed: ['cat', 'dog'] }));
    expect(r.planes.map((x) => x.id)).toEqual(['p-green', 'p-white']);
    p = r.progress;
    expect(goalProgress({ kind: 'words', n: 60 }, p)).toEqual({ have: 18, need: 60 });
  });

  it('counts flights without mistakes only on the own route or harder', () => {
    const p = { ...freshFlight(), level: 2 };
    expect(recordFlight(p, 0, clean).progress.flawless).toBe(0);
    expect(recordFlight(p, 2, clean).progress.flawless).toBe(1);
    expect(recordFlight(p, 3, clean).progress.flawless).toBe(1);
  });

  it('fills the hangar in the end', () => {
    let p = freshFlight();
    for (let k = 0; k < 20; k++) for (let t = 0; t < SKY_TRACKS.length; t++) p = { ...recordFlight({ ...p, level: t }, t, clean).progress };
    expect(p.planes.length).toBe(PLANES.length);
    expect(nextPlane(p)).toBeUndefined();
    expect(claimPlanes(p).planes).toEqual([]);
  });

  it('takes over the planes and plane stars from an old race save', () => {
    const old = { car: 'blue', planes: ['p-red', 'p-blue', 'p-white'], plane: 'p-white', stars: [3, 3, 2, 3, 1], level: 4, misses: { cat: 2 }, seen: { cat: 5 }, coins: 40 };
    const p = fromRace(JSON.parse(JSON.stringify(old)));
    expect(p.planes).toEqual(['p-red', 'p-blue', 'p-white']);
    expect(p.plane).toBe('p-white');
    expect(p.stars).toEqual([0, 3, 1, 0]);
    expect(p.level).toBe(2);
    expect(p.misses).toEqual({ cat: 2 });
    expect(p.coins).toBe(0);
    expect(fromRace(null)).toEqual(freshFlight());
    // unknown planes are dropped, the chosen one must be owned
    expect(parseFlight({ planes: ['p-zzz', 'p-gold'], plane: 'p-zzz' })).toMatchObject({ planes: ['p-red', 'p-gold'], plane: 'p-red' });
  });
});
