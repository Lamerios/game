import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import type { GameEvent } from '../src/core/analytics';
import { mulberry32 } from '../src/games/common/rng';
import {
  achievementsFrom, cellName, CONFETTI_ANSWERS, hitTest, leadX, LEVELS, MAX_LEVEL, planRound, RANGE_WORDS, readSave, starsFor,
  TASKS_PER_ROUND, unlocks, WEAPONS, type Face, type Task,
} from '../src/games/range/logic';

const ev = (game: string, type: string, data: GameEvent['data'] = {}): GameEvent => ({ v: 1, ts: 1, app: 'a', game, type, data });
const end = (game: string, stars?: number, extra: GameEvent['data'] = {}) => ev(game, 'run.end', { completed: true, ...(stars ? { stars } : {}), ...extra });
const words = content.english.words as Record<string, string>;
const phrases = content.phrases as Record<string, string>;

function matchesAttr(f: Face, t: Extract<Task, { kind: 'attr' }>) {
  if (f.kind !== 'shape') return false;
  if (t.not) return f.color !== t.not;
  return (!t.color || f.color === t.color) && (!t.shape || f.shape === t.shape) && (!t.size || f.size === t.size);
}

describe('Range: achievements open weapons', () => {
  it('starts with only the water pistol', () => {
    const u = unlocks(achievementsFrom([]));
    expect(u.filter((x) => x.open).map((x) => x.id)).toEqual(['water']);
    expect(u.map((x) => x.id)).toEqual(WEAPONS.map((w) => w.id));
  });

  it('reads stars, finished games and right answers from the event log, ignoring the range itself', () => {
    const events = [
      end('race', 3), end('galley', 3), end('crew', 3), end('snake'), end('parcel'),
      end('range', 3, { level: 6 }), ev('race', 'run.end', { completed: false, stars: 3 }),
      ...Array.from({ length: CONFETTI_ANSWERS }, () => ev('snake', 'answer', { correct: true })),
      ev('range', 'answer', { correct: true }), ev('snake', 'answer', { correct: false }),
    ];
    const a = achievementsFrom(events);
    expect(a.starGames).toEqual(['crew', 'galley', 'race']);
    expect(a.finished).toEqual(['crew', 'galley', 'parcel', 'race', 'snake']);
    expect(a.correct).toBe(CONFETTI_ANSWERS);
    expect(a.rangeTopLevel).toBe(6);
    const open = unlocks(a).filter((x) => x.open).map((x) => x.id);
    expect(open).toEqual(['water', 'bubble', 'twins', 'cannon', 'blaster', 'confetti']);
  });

  it('gives the golden cannon only when everything else is open and the range is ★★★ at level 5+', () => {
    const all = [end('race', 3), end('shipyard', 3), end('galley', 3), end('snake'), end('parcel'), ...Array.from({ length: 200 }, () => ev('crew', 'answer', { correct: true }))];
    expect(unlocks(achievementsFrom([...all, end('range', 3, { level: 4 })])).find((u) => u.id === 'golden')!.open).toBe(false);
    expect(unlocks(achievementsFrom([...all, end('range', 3, { level: 5 })])).find((u) => u.id === 'golden')!.open).toBe(true);
  });

  it('keeps a weapon once it was opened, even if old events were trimmed', () => {
    expect(unlocks(achievementsFrom([]), ['cannon']).find((u) => u.id === 'cannon')!.open).toBe(true);
  });
});

describe('Range: tasks', () => {
  it('every round has one right target per task, at every level', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      for (let seed = 1; seed < 60; seed++) {
        const tasks = planRound(level, mulberry32(seed));
        expect(tasks).toHaveLength(TASKS_PER_ROUND);
        expect(tasks[0]!.kind).toBe('word');
        for (const t of tasks) {
          expect(LEVELS[level]!.kinds).toContain(t.kind);
          if (t.kind === 'grid') {
            expect(t.col).toBeLessThan(t.cols);
            expect(t.row).toBeLessThan(t.rows);
            continue;
          }
          expect(t.faces).toHaveLength(LEVELS[level]!.targets);
          const right = t.faces.map((f, i) => ({ f, i })).filter(({ f }) =>
            t.kind === 'word' ? f.kind === 'word' && f.id === t.word
            : t.kind === 'sum' ? f.kind === 'number' && f.n === (t.op === '+' ? t.a + t.b : t.a - t.b)
            : matchesAttr(f, t));
          expect(right.map((r) => r.i), JSON.stringify(t)).toEqual([t.answer]);
          if (t.kind === 'sum') {
            const res = t.op === '+' ? t.a + t.b : t.a - t.b;
            expect(res).toBeGreaterThanOrEqual(0);
            expect(res).toBeLessThanOrEqual(LEVELS[level]!.sumMax);
          }
        }
        for (let i = 1; i < tasks.length; i++) {
          if (tasks[i]!.kind === 'grid' && tasks[i - 1]!.kind === 'grid' && tasks.some((t) => t.kind !== 'grid')) {
            // only allowed when no other kind is left to swap in
            expect(tasks.slice(i).every((t) => t.kind === 'grid')).toBe(true);
          }
        }
      }
    }
  });

  it('aims at things only: every word has a picture and an English clip, and no animals', () => {
    const animals = ['cat', 'dog', 'fish', 'bird', 'cow', 'pig', 'horse', 'frog', 'duck', 'rabbit', 'bear', 'lion', 'monkey', 'elephant'];
    for (const w of RANGE_WORDS) {
      expect(animals).not.toContain(w);
      expect(words[w], w).toBeDefined();
      expect(existsSync(`public/snake/${w}.webp`), w).toBe(true);
    }
  });

  it('has every line the scene says', () => {
    for (const id of ['range.hit', 'range.great', 'range.not', 'big', 'small', 'circle', 'square', 'triangle', 'star', 'red', 'blue', 'green', 'yellow']) expect(words[id], id).toBeDefined();
    for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) expect(words[`cell.${cellName(c, r)}`]).toBeDefined();
    for (let n = 0; n <= 20; n++) expect(words[`n${n}`]).toBeDefined();
    for (const w of WEAPONS) if (w.id !== 'water') expect(phrases[`walrus.range.got.${w.id}`], w.id).toBeDefined();
    for (const id of ['hello', 'pick', 'plus', 'minus', 'attr', 'lead', 'lead.help', 'grid', 'wrong', 'reload', 'end', 'end.more']) expect(phrases[`walrus.range.${id}`], id).toBeDefined();
  });
});

describe('Range: aiming', () => {
  it('leads a moving target and wraps at the lane ends', () => {
    expect(leadX(100, 100, 1000, 0, 1000)).toBe(200);
    expect(leadX(950, 100, 1000, 0, 1000)).toBe(50);
    expect(leadX(50, -100, 1000, 0, 1000)).toBe(950);
  });

  it('hits the nearest target within reach', () => {
    const ts = [{ x: 100, y: 100, r: 60 }, { x: 200, y: 100, r: 60 }];
    expect(hitTest(140, 100, 30, ts)).toBe(0);
    expect(hitTest(160, 100, 30, ts)).toBe(1);
    expect(hitTest(500, 100, 30, ts)).toBe(-1);
  });

  it('stars: a reload caps the round at two', () => {
    expect(starsFor(8, 8, false)).toBe(3);
    expect(starsFor(8, 8, true)).toBe(2);
    expect(starsFor(5, 8, false)).toBe(2);
    expect(starsFor(2, 8, false)).toBe(1);
  });

  it('reads a broken save as a fresh start', () => {
    expect(readSave('nonsense')).toEqual({ level: 1, weapon: 'water', seen: [] });
    expect(readSave(JSON.stringify({ level: 4, weapon: 'cannon', seen: ['cannon', 'laser'] }))).toEqual({ level: 4, weapon: 'cannon', seen: ['cannon'] });
  });
});
