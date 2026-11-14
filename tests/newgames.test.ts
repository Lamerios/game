import * as CR from '../src/games/crew/logic';
import * as SY from '../src/games/shipyard/logic';
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

describe('shipyard', () => {
  it('blueprints are full 6x5 grids with a hull on the bottom rows', () => {
    for (const lvl of [1, 2, 3])
      for (const rows of SY.BLUEPRINTS[lvl]!) {
        const g = SY.parse(rows);
        expect(g).toHaveLength(SY.ROWS);
        g.forEach((r) => expect(r).toHaveLength(SY.COLS));
        expect(g[SY.ROWS - 1]!.some(Boolean)).toBe(true);
        expect(SY.compare(g, g).ok).toBe(true);
        expect(SY.compare(g, SY.emptyGrid()).missing).toBeGreaterThan(3);
      }
  });
  it('orders have a voiced line and are checked by colour and count', () => {
    for (let lvl = 1; lvl <= 4; lvl++)
      for (const o of SY.planOrders(lvl, mulberry32(lvl))) {
        expect(ENGLISH[SY.orderLine(o)]).toBeTruthy();
        expect(o.count).toBeGreaterThanOrEqual(1);
      }
    expect(SY.planOrders(1, mulberry32(1))).toEqual([]);
    const o = { color: 'red' as const, count: 2 };
    expect(SY.checkOrder(o, ['red', null, 'red', null, null, null]).ok).toBe(true);
    expect(SY.checkOrder(o, ['red', 'blue', 'red', null, null, null]).ok).toBe(false);
    expect(SY.checkOrder(o, ['red', null, null, null, null, null]).got).toBe(1);
  });
});

describe('crew', () => {
  it('emotion trials always contain the answer and have voiced lines', () => {
    for (const lvl of [1, 2])
      for (let seed = 1; seed < 20; seed++) {
        const ts = CR.planEmotions(lvl, mulberry32(seed));
        expect(ts).toHaveLength(4);
        for (const t of ts) {
          expect(t.options).toContain(t.emo);
          expect(new Set(t.options).size).toBe(3);
          expect(CR.emotionsFor(lvl)).toEqual(expect.arrayContaining(t.options));
          expect(ENGLISH[`emo.who.${t.emo}`]).toBeTruthy();
          if (t.kind === 'situation') expect(ph[`rumb.crew.sit.${t.sit}`]).toBeTruthy();
        }
      }
  });
  it('story frames never start in order; false belief is scored', () => {
    for (let seed = 1; seed < 30; seed++) expect(CR.shuffledFrames(mulberry32(seed))).not.toEqual([0, 1, 2]);
    expect(CR.scoreTom('red', 'red', 'blue')).toEqual({ belief: true, reality: true });
    expect(CR.scoreTom('red', 'blue', 'blue')).toEqual({ belief: false, reality: true });
  });
});
