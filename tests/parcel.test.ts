import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import { checkLoad, choices, englishLines, LEGS, loadId, loadText, parseProgress, planLoad, VEHICLES } from '../src/games/parcel/logic';

describe('parcel', () => {
  it('every vehicle has a picture and every English line a clip', () => {
    for (const v of VEHICLES) expect(existsSync(join(__dirname, '..', 'public', 'parcel', `${v}.webp`)), v).toBe(true);
    const clips = allClips([]);
    for (const [id, text] of Object.entries(englishLines())) {
      expect(ENGLISH[id], id).toBe(text);
      expect(clips.get(`en.${id}`), id).toBe(text);
    }
  });

  it('has the Russian lines the scene asks for', () => {
    const ph = content.phrases as Record<string, string>;
    LEGS.forEach((_, i) => {
      for (const k of ['leg', 'hint', 'arrive']) expect(ph[`rumb.parcel.${k}.${i}`], `${k}.${i}`).toBeDefined();
    });
  });

  it('offers the answer once among clearly wrong vehicles', () => {
    const rng = mulberry32(5);
    for (const leg of LEGS) {
      expect(leg.wrong).not.toContain(leg.answer);
      for (let k = 0; k < 50; k++) {
        const c = choices(leg, rng);
        expect(c).toHaveLength(leg.options);
        expect(new Set(c).size).toBe(c.length);
        expect(c.filter((v) => v === leg.answer)).toHaveLength(1);
      }
    }
  });

  it('plans load tasks with enough boxes of the named colour', () => {
    const rng = mulberry32(11);
    for (const leg of LEGS) {
      for (let k = 0; k < 50; k++) {
        const t = planLoad(leg, rng);
        expect(t.n).toBeGreaterThanOrEqual(leg.load.min);
        expect(t.n).toBeLessThanOrEqual(leg.load.max);
        expect(t.pier).toHaveLength(8);
        if (leg.load.color) {
          const own = t.pier.filter((c) => c === t.color).length;
          expect(own).toBeGreaterThan(t.n);
          expect(own).toBeLessThan(8);
        } else {
          expect(t.color).toBeUndefined();
        }
        expect(ENGLISH[loadId(t.n, t.color)]).toBeDefined();
      }
    }
  });

  it('checks the load: colour first, then the count', () => {
    const t = { n: 2, color: 'red' as const, pier: [] };
    expect(checkLoad(t, ['red', 'red'])).toEqual({ ok: true });
    expect(checkLoad(t, ['red', 'blue'])).toEqual({ ok: false, why: 'color', wrong: 'blue' });
    expect(checkLoad(t, ['red', 'red', 'red'])).toEqual({ ok: false, why: 'many', count: 3 });
    expect(checkLoad(t, [])).toEqual({ ok: false, why: 'few', count: 0 });
    expect(checkLoad({ n: 3, pier: [] }, [undefined, undefined, undefined])).toEqual({ ok: true });
  });

  it('speaks plain English', () => {
    expect(loadText(1)).toBe('Load one box!');
    expect(loadText(3, 'green')).toBe('Load three green boxes!');
    expect(ENGLISH['take.camel']).toBe('Take the camel!');
  });

  it('reads saved progress defensively', () => {
    expect(parseProgress(null)).toEqual({ leg: 0, trips: 0 });
    expect(parseProgress({ leg: 3, trips: 1 })).toEqual({ leg: 3, trips: 1 });
    expect(parseProgress({ leg: 99, trips: -1 })).toEqual({ leg: 0, trips: 0 });
  });
});

describe('parcel route plan', () => {
  it('offers the right transport among three and finds the first broken leg', async () => {
    const { planOptions, checkPlan, LEGS } = await import('../src/games/parcel/logic');
    const { mulberry32 } = await import('../src/games/common/rng');
    const rng = mulberry32(3);
    for (const leg of LEGS) {
      const o = planOptions(leg, rng);
      expect(o).toHaveLength(3);
      expect(o).toContain(leg.answer);
      expect(new Set(o).size).toBe(3);
    }
    const good = LEGS.map((l) => l.answer);
    expect(checkPlan(good)).toBe(-1);
    expect(checkPlan(good.map((v, i) => (i === 3 ? 'boat' : v)))).toBe(3);
    expect(checkPlan([])).toBe(0);
  });
});
