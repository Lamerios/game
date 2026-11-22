import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, ENGLISH } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import * as jam from '../src/games/jam/logic';
import * as mc from '../src/games/machine/logic';
import * as cab from '../src/games/cabins/logic';

const ph = content.phrases as Record<string, string>;

describe('jam (harbour sliding puzzle)', () => {
  it('generated puzzles are solvable, fit the board and get harder with the level', () => {
    const rng = mulberry32(11);
    const avg: number[] = [];
    for (let level = 1; level <= jam.MAX_LEVEL; level++) {
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        // No wall-clock cut-off here: on a slow CI runner it made the result depend on machine speed.
        const p = jam.generate(level, rng, 600, Infinity);
        expect(jam.fits(p.boats)).toBe(true);
        expect(jam.solved(p.boats)).toBe(false);
        // No other horizontal boat shares the exit row.
        expect(p.boats.slice(1).some((b) => b.dir === 'h' && b.y === jam.EXIT_ROW)).toBe(false);
        const sol = jam.solve(p.boats)!;
        expect(sol).toHaveLength(p.min);
        const end = sol.reduce((s, m) => jam.apply(s, m), p.boats);
        expect(jam.solved(end) && jam.fits(end)).toBe(true);
        sum += p.min;
      }
      avg.push(sum / 4);
    }
    expect(avg[jam.MAX_LEVEL - 1]!).toBeGreaterThan(avg[0]! + 4);
  }, 30000);

  it('slides only into free cells', () => {
    const boats: jam.Boat[] = [
      { x: 0, y: 2, len: 2, dir: 'h' },
      { x: 3, y: 1, len: 3, dir: 'v' },
    ];
    expect(jam.range(boats, 0)).toEqual([0, 1]);
    expect(jam.range(boats, 1)).toEqual([-1, 2]);
    expect(jam.solve(boats)).toHaveLength(2);
  });

  it('scores and adapts', () => {
    expect(jam.stars(3, 3, 0)).toBe(3);
    expect(jam.stars(5, 3, 1)).toBe(2);
    expect(jam.stars(5, 3, 2)).toBe(1);
    expect(jam.nextLevel(2, 3)).toBe(3);
    expect(jam.nextLevel(2, 1)).toBe(1);
    for (const w of ['race.left', 'race.right', 'dir.up', 'dir.down']) expect(ENGLISH[w]).toBeDefined();
    for (const id of ['hello', 'back', 'again', 'think', 'show', 'best', 'ok', 'stuck', 'end']) expect(ph[`rumb.jam.${id}`], id).toBeDefined();
  });
});

describe('machine (marble run)', () => {
  it('a ball follows ramps, flips flippers and stops at stoppers', () => {
    const b: mc.Board = [
      ['>', '.', '.'],
      ['.', 'a', '.'],
      ['.', '.', '#'],
    ];
    const d1 = mc.drop(b, 0);
    expect(d1.path.map((s) => s.col)).toEqual([0, 1, 0, 0]);
    expect(d1.cup).toBe(0);
    expect(d1.after[1]![1]).toBe('b');
    expect(b[1]![1]).toBe('a');
    const d2 = mc.drop(d1.after, 0);
    expect(d2.cup).toBe(-1);
    // A ramp against the wall lets the ball fall straight.
    expect(mc.drop([['<']], 0).cup).toBe(0);
  });

  it('rounds are well-formed for every level', () => {
    const rng = mulberry32(5);
    for (let level = 1; level <= mc.MAX_LEVEL; level++) {
      for (let k = 0; k < 15; k++) {
        const spec = mc.LEVELS[level]!;
        const rounds = mc.planRounds(level, rng);
        expect(rounds.map((r) => r.kind)).toEqual(spec.kinds);
        for (const r of rounds) {
          if (r.kind === 'predict') expect(mc.drop(r.board, r.chute).cup).toBeGreaterThanOrEqual(0);
          if (r.kind === 'twice') {
            const a = mc.drop(r.board, r.chute);
            const b = mc.drop(a.after, r.chute);
            expect(b.cup).not.toBe(a.cup);
          }
          if (r.kind === 'chute') {
            const hits = r.board[0]!.map((_, c) => mc.drop(r.board, c).cup).filter((e) => e === r.bell);
            expect(hits).toHaveLength(1);
          }
          if (r.kind === 'fix') {
            expect(mc.drop(r.board, r.chute).cup).not.toBe(r.bell);
            let ways = 0;
            for (let m = 0; m < 1 << r.turnable.length; m++) {
              const b = mc.copy(r.board);
              r.turnable.forEach((t, i) => (b[t.row]![t.col] = m & (1 << i) ? '>' : '<'));
              if (mc.drop(b, r.chute).cup === r.bell) ways++;
            }
            expect(ways).toBe(1);
          }
        }
      }
    }
  });

  it('has its lines and English cup colours', () => {
    const clips = allClips([]);
    for (const c of mc.CUP_COLORS) expect(clips.has(`en.c-${c}`), c).toBe(true);
    for (const id of ['hello', 'back', 'predict', 'second', 'chute', 'fix', 'right', 'wrong', 'stopper', 'ring', 'again', 'helpchute', 'helpfix', 'flipper', 'end'])
      expect(ph[`raccoon.machine.${id}`], id).toBeDefined();
    expect(mc.nextLevel(2, 3, 3)).toBe(3);
    expect(mc.nextLevel(2, 1, 3)).toBe(1);
    expect(mc.nextLevel(2, 2, 3)).toBe(2);
  });
});

describe('cabins (logic puzzles)', () => {
  it('every puzzle has exactly one solution and no spare clue', () => {
    const rng = mulberry32(9);
    for (let level = 1; level <= cab.MAX_LEVEL; level++) {
      for (let k = 0; k < 8; k++) {
        const p = cab.generate(level, rng);
        const sols = cab.solutions(p.clues, p.crew, p.doors, p.layout);
        expect(sols).toEqual([p.solution]);
        for (let i = 0; i < p.clues.length; i++) {
          const rest = p.clues.filter((_, j) => j !== i);
          expect(cab.solutions(rest, p.crew, p.doors, p.layout).length).toBeGreaterThan(1);
        }
        for (const c of p.clues) expect(cab.LEVELS[level]!.kinds).toContain(c.kind);
      }
    }
  });

  it('reads clues the right way round', () => {
    const L = { rows: 2, cols: 2 };
    const doors: cab.Door[] = ['red', 'blue', 'green', 'yellow'];
    const plan: cab.Plan = ['rumb', 'kettle', 'raccoon', 'blot'];
    expect(cab.holds({ kind: 'left', a: 'rumb', b: 'kettle' }, plan, doors, L)).toBe(true);
    expect(cab.holds({ kind: 'above', a: 'rumb', b: 'raccoon' }, plan, doors, L)).toBe(true);
    expect(cab.holds({ kind: 'above', a: 'rumb', b: 'blot' }, plan, doors, L)).toBe(false);
    expect(cab.holds({ kind: 'below', a: 'blot', b: 'kettle' }, plan, doors, L)).toBe(true);
    expect(cab.holds({ kind: 'notAt', a: 'kettle', door: 'blue' }, plan, doors, L)).toBe(false);
    expect(cab.holds({ kind: 'sameFloor', a: 'raccoon', b: 'blot' }, plan, doors, L)).toBe(true);
  });

  it('every clue can be spoken', () => {
    const rng = mulberry32(4);
    const clips = allClips([]);
    for (let level = 1; level <= cab.MAX_LEVEL; level++)
      for (const c of cab.generate(level, rng).clues)
        for (const part of cab.clueParts(c)) expect(clips.has(`kettle.cab.${part}`), part).toBe(true);
    for (const w of cab.CREW) for (const k of ['n', 'g', 'i']) expect(ph[`kettle.cab.${k}.${w}`]).toBeDefined();
    for (const d of cab.DOORS) expect(ph[`kettle.cab.at.${d}`] && ph[`kettle.cab.not.${d}`]).toBeTruthy();
    for (const id of ['hello', 'back', 'next', 'listen', 'check', 'help', 'solved', 'end']) expect(ph[`kettle.cab.${id}`], id).toBeDefined();
  });
});
