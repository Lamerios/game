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
