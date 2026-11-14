import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import {
  CARS, englishLines, freshProgress, parseProgress, planRace, poolOf, PRAISE_LINES, recordRace, ROWS_PER_RACE, starsFor, TRACKS, unlocked,
} from '../src/games/race/logic';

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
    for (const n of [1, 2, 3, ...Array.from({ length: 10 }, (_, i) => i + 1)]) expect(ENGLISH[`n${n}`]).toBeDefined();
  });

  it('has the Russian lines the scene asks for', () => {
    const ph = content.phrases as Record<string, string>;
    const ids = ['hello', 'rules', 'locked', 'need', 'cone', 'warn', 'pit.0', 'pit.1', 'pit.ten', 'pit.done', 'unlock'];
    TRACKS.forEach((_, i) => ids.push(`start.${i}`));
    for (let i = 0; i < 3; i++) ids.push(`crash.${i}`);
    for (let i = 0; i <= 3; i++) ids.push(`finish.${i}`);
    for (const id of ids) expect(ph[`raccoon.race.${id}`], id).toBeDefined();
  });

  it('plans rows with the target in exactly one lane and passable cones', () => {
    const rng = mulberry32(3);
    TRACKS.forEach((t) => {
      for (let k = 0; k < 30; k++) {
        const rows = planRace(t, rng, { apple: 3 });
        expect(rows).toHaveLength(ROWS_PER_RACE);
        rows.forEach((r, i) => {
          expect(r.lanes).toHaveLength(t.lanes);
          expect(new Set(r.lanes).size).toBe(t.lanes);
          expect(r.lanes.filter((w) => w === r.target)).toHaveLength(1);
          expect(r.cones.length).toBeLessThan(t.lanes);
          if (!t.cones) expect(r.cones).toEqual([]);
          if (i > 0) expect(r.target).not.toBe(rows[i - 1]!.target);
        });
      }
    });
  });

  it('keeps the best stars, opens tracks in order and remembers missed words', () => {
    let p = freshProgress();
    expect(unlocked(p, 1)).toBe(false);
    p = recordRace(p, 0, 8, ['cat'], ['dog', 'dog']);
    expect(p.stars[0]).toBe(2);
    expect(p.misses.dog).toBe(2);
    expect(unlocked(p, 1)).toBe(true);
    p = recordRace(p, 0, 3, ['dog'], []);
    expect(p.stars[0]).toBe(2);
    expect(p.misses.dog).toBe(1);
    expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(parseProgress({ car: 'pink', stars: [9, 'x'], misses: { a: -1 } })).toEqual(freshProgress());
    expect(CARS.map((c) => c.id)).toContain(parseProgress(null).car);
  });
});
