import { describe, expect, it } from 'vitest';
import { CHILD, phrase, setChildName, speakerOf } from '../src/core/phrases';
import { arrival, EPISODES, evening, finds, INTRO, islandOf, LETTERS, SECRET_WORD, strelkaParts } from '../src/story/script';
import { artSources } from '../src/art/load';

describe('story script', () => {
  it('has a prologue that ends with the captain\'s letter before the call to sea', () => {
    expect(INTRO[0]).toBe('rumb.intro.1');
    expect(INTRO).toContain('beard.letter');
    expect(INTRO.at(-1)).toBe('rumb.intro.7');
  });

  it('every episode has an arrival and an evening; finds come on an island\'s second visit', () => {
    for (let ep = 0; ep < EPISODES; ep++) {
      expect(arrival(ep).length, `arrival ${ep}`).toBeGreaterThan(0);
      expect(() => phrase(evening(ep))).not.toThrow();
      expect(finds(ep).length > 0, `finds ${ep}`).toBe(ep % 2 === 1);
    }
    expect(arrival(2)).toEqual(['rumb.arrive.2', 'walrus.arrive.2b']);
  });

  it('two episodes per island, a Strelka part per island, and the letters make the word', () => {
    expect([0, 1, 2, 3, 9, 12].map(islandOf)).toEqual([0, 0, 1, 1, 4, 4]);
    expect([0, 1, 2, 7, 8, 10].map(strelkaParts)).toEqual([0, 0, 1, 3, 4, 4]);
    expect([...LETTERS].sort().join('')).toBe([...SECRET_WORD].sort().join(''));
  });

  it('story lines are voiced by their speaker', () => {
    expect(phrase('walrus.arrive.2b').speaker).toBe('walrus');
    expect(speakerOf('hold.load')).toBeUndefined();
  });

  it('every character and object has art', () => {
    const art = artSources();
    for (const k of ['char-rumb', 'char-kettle', 'char-raccoon', 'char-blot', 'char-walrus', 'char-general', 'strelka-4', 'piece-wn', 'obj-flag-red', 'bg-night']) {
      expect(art[k], k).toMatch(/^<svg /);
    }
  });
});

describe('child name', () => {
  it('is said whole inside the clip for the generated name', () => {
    setChildName(CHILD.name);
    const u = phrase('rumb.intro.1');
    expect(u.show.startsWith('Капитан Артемий!')).toBe(true);
    expect(u.segs).toHaveLength(1);
    expect(u.segs[0]!.say).toContain('Арт+емий');
    expect(u.segs[0]!.voiced).toBe(true);
  });

  it('another name goes to the browser voice', () => {
    setChildName('Миша');
    const u = phrase('rumb.intro.1');
    expect(u.show).toContain('Миша');
    expect(u.segs.every((s) => !s.voiced)).toBe(true);
    setChildName(CHILD.name);
  });
});
