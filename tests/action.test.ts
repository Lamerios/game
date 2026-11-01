import { describe, expect, it } from 'vitest';
import { allClips, phrase, textId } from '../src/core/phrases';
import { mulberry32 } from '../src/games/common/rng';
import {
  BARRELS_MAX_LEVEL, BUOYS_MAX_LEVEL, GULLS_MAX_LEVEL, generateBarrels, generateBuoys, generateGulls, nextBarrel, nextGullLetter,
  sameBuoy, seaGame, SEA_SKILL,
} from '../src/games/action/generators';
import { allPuzzleTexts } from '../src/games/puzzle/generator';
import { lettersInstead } from '../src/games/puzzle/mix';
import { EPISODES, ISLAND_FOCUS, islandOf } from '../src/story/script';
import type { SessionTask } from '../src/core/types';

describe('gulls (letters)', () => {
  it('distractors are never letters of the word; the word is voiced from clips', () => {
    const clips = allClips(allPuzzleTexts());
    for (let level = 1; level <= GULLS_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 100; seed++) {
        const g = generateGulls(level, mulberry32(seed));
        g.words.forEach(({ word }, i) => {
          for (const d of g.distractors[i]!) expect(word.includes(d), `${d} in ${word}`).toBe(false);
          expect(clips.has(textId(word.toLowerCase())), word).toBe(true);
        });
      }
    }
  });

  it('short words first, longer later; from L5 the child names the picture', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 100; i++) {
      for (const w of generateGulls(1, rng).words) expect(w.word.length).toBeLessThanOrEqual(5);
    }
    expect(generateGulls(1, rng).prefilled).toBe(1);
    expect(generateGulls(4, rng).sayWord).toBe(true);
    expect(generateGulls(5, rng).sayWord).toBe(false);
  });

  it('the needed letter always comes when none is in the air', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 500; i++) expect(nextGullLetter(rng, 'КРАБ', 2, ['О', 'М'], false)).toBe('А');
  });
});

describe('barrels (exactly N)', () => {
  it('every round can always be finished exactly', () => {
    for (let level = 1; level <= BARRELS_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 100; seed++) {
        const rng = mulberry32(seed);
        const t = generateBarrels(level, rng);
        for (const target of t.targets) {
          // Greedy child: catches the first barrel that fits; never stuck.
          let loaded = 0;
          let air: number[] = [];
          for (let step = 0; step < 200 && loaded < target; step++) {
            const left = target - loaded;
            air.push(nextBarrel(rng, t, left, air));
            if (air.length > 4) air.shift();
            const fit = air.findIndex((v) => v <= left);
            if (fit >= 0) {
              loaded += air[fit]!;
              air.splice(fit, 1);
            }
          }
          expect(loaded).toBe(target);
        }
      }
    }
  });

  it('targets and numbers have clips', () => {
    const clips = allClips([]);
    for (let level = 1; level <= BARRELS_MAX_LEVEL; level++) {
      const t = generateBarrels(level, mulberry32(level));
      for (const n of t.targets) {
        expect(clips.has(`num.nom.${n}`)).toBe(true);
        expect(clips.has(`num.gen.${n}`)).toBe(true);
      }
      expect(t.dots).toBe(level <= 3);
      if (t.dots) expect(t.maxValue).toBeLessThanOrEqual(3);
    }
  });
});

describe('buoys (patterns)', () => {
  it('exactly one option continues the pattern', () => {
    for (let level = 1; level <= BUOYS_MAX_LEVEL; level++) {
      for (let seed = 1; seed <= 200; seed++) {
        for (const r of generateBuoys(level, mulberry32(seed)).rounds) {
          expect(r.options).toHaveLength(3);
          const right = r.options.filter((o) => sameBuoy(o, r.row[r.gap]!));
          expect(right).toHaveLength(1);
          expect(sameBuoy(r.options[r.answer]!, r.row[r.gap]!)).toBe(true);
          if (r.unit) {
            // The rule is visible: at least two whole units are shown apart from the gap.
            expect(r.row.length).toBeGreaterThanOrEqual(r.unit * 2 + 1);
            r.row.forEach((b, i) => {
              if (i >= r.unit) expect(sameBuoy(b, r.row[i - r.unit]!)).toBe(true);
            });
          }
        }
      }
    }
  });

  it('only colours on L1, gap at the end until L6', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 50; i++) {
      const t = generateBuoys(1, rng);
      for (const r of t.rounds) {
        expect(r.row.every((b) => b.shape === 'round')).toBe(true);
        expect(r.gap).toBe(r.row.length - 1);
      }
    }
  });
});

describe('where the action stages go', () => {
  it('every episode has one, never in the island\'s own skill, and the first two differ', () => {
    for (let ep = 0; ep < EPISODES; ep++) {
      const focus = ISLAND_FOCUS[islandOf(ep)];
      expect(SEA_SKILL[seaGame(ep, focus)]).not.toBe(focus);
    }
    expect(seaGame(0, 'reading')).toBe('Barrels');
    expect(seaGame(1, 'reading')).toBe('Buoys');
  });

  it('only the first reading task of an episode is a text; later ones catch letters', () => {
    const t = (skill: SessionTask['skill'], star = false): SessionTask => ({ skill, level: 4, isReview: false, star });
    const tasks = [t('reading'), t('math'), t('reading', true), t('chess')];
    expect(tasks.map((_, i) => lettersInstead(tasks, i))).toEqual([false, false, true, false]);
  });

  it('new lines are short enough to hear in one go', () => {
    for (const id of ['gulls.intro', 'buoys.intro'] as const) expect(phrase(id).show.length).toBeLessThan(110);
    expect(phrase('barrels.intro', { n: 7 }).show).toContain('ровно 7');
  });
});
