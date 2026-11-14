import * as MP from '../src/games/mappuzzle/logic';
import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import * as anchor from '../src/games/anchor/logic';
import * as galley from '../src/games/galley/logic';

const ph = content.phrases as Record<string, string>;

describe('anchor', () => {
  it('targets stay inside the line, never at the ends, and have English clips', () => {
    const rng = mulberry32(1);
    const clips = allClips([]);
    for (let level = 1; level <= anchor.MAX_LEVEL; level++) {
      const s = anchor.LEVELS[level]!;
      for (const t of anchor.planTargets(level, rng, 50)) {
        expect(t > 0 && t < s.max && t % s.step === 0).toBe(true);
        expect(clips.has(`en.${anchor.numberWord(t)}`), String(t)).toBe(true);
      }
    }
    expect(clips.has('en.anchor.drop')).toBe(true);
  });
  it('scores percent error and adapts', () => {
    expect(anchor.pae(7, 6, 10)).toBe(10);
    expect(anchor.verdict(4)).toBe('exact');
    expect(anchor.verdict(20)).toBe('far');
    expect(anchor.nextLevel(1, 5)).toBe(2);
    expect(anchor.nextLevel(2, 25)).toBe(1);
    for (const id of ['hello', 'again', 'exact', 'close', 'far', 'more', 'less', 'end', 'levelup']) expect(ph[`rumb.anchor.${id}`], id).toBeDefined();
  });
});

describe('galley', () => {
  it('orders are on the shelf, the length grows with the level', () => {
    const rng = mulberry32(2);
    for (let level = 1; level <= galley.MAX_LEVEL; level++) {
      for (const r of galley.planOrders(level, rng, 20)) {
        expect(r.order).toHaveLength(galley.orderLength(level));
        for (const id of r.order) expect(r.shelf).toContain(id);
        expect(r.shelf.length).toBeGreaterThan(r.order.length);
        for (const id of r.shelf) expect(ENGLISH[id], id).toBeDefined();
      }
    }
    expect(galley.checkTray(['a', 'b'], ['b', 'a'])).toEqual({ all: true, inOrder: false });
  });
  it('sort cards always conflict with the bins, and the rule decides the bin', () => {
    const rng = mulberry32(3);
    const phases = galley.planSort(2, rng);
    expect(phases.map((p) => p.rule)).toEqual(['color', 'shape', 'mixed']);
    for (const p of phases) for (const c of p.cards) {
      expect(galley.binFor(c, 'color')).not.toBe(galley.binFor(c, 'shape'));
    }
    expect(galley.planSort(1, rng)).toHaveLength(2);
    for (const id of ['cook.need', 'sort.color', 'sort.shape', 'sort.mixed']) expect(ENGLISH[id], id).toBeDefined();
  });
});

describe('mappuzzle', () => {
  it('plans every piece once, half turned when rotation is on', () => {
    for (const lvl of [1, 2, 3, 4]) {
      const s = MP.LEVELS[lvl]!;
      const ps = MP.planPieces(lvl, mulberry32(lvl));
      expect(ps.map((p) => p.index).sort((a, b) => a - b)).toEqual(Array.from({ length: s.cols * s.rows }, (_, i) => i));
      if (!s.rotate) expect(ps.every((p) => p.turns === 0)).toBe(true);
      else expect(ps.filter((p) => p.turns !== 0).length).toBeGreaterThanOrEqual(Math.floor(ps.length / 2));
    }
  });
  it('routes stay on the grid and never cross', () => {
    for (let seed = 1; seed < 40; seed++) {
      const r = MP.planRoute(mulberry32(seed), 6, 6);
      expect(r.steps).toHaveLength(6);
      const seen = new Set<string>();
      let p = r.start;
      seen.add(`${p.x},${p.y}`);
      for (const d of r.steps) {
        p = { x: p.x + MP.STEP[d].x, y: p.y + MP.STEP[d].y };
        expect(p.x >= 0 && p.x < 6 && p.y >= 0 && p.y < 6).toBe(true);
        expect(seen.has(`${p.x},${p.y}`)).toBe(false);
        seen.add(`${p.x},${p.y}`);
      }
      expect(MP.endOf(r)).toEqual(p);
    }
  });
});
