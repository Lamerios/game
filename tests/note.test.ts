import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/games/common/rng';
import { generateNote, NOTE_MAX_LEVEL, NOTE_SLOTS } from '../src/games/note/generator';

describe('generateNote', () => {
  for (let level = 1; level <= NOTE_MAX_LEVEL; level++) {
    it(`level ${level}: targets exist, ids unique, ${NOTE_SLOTS} objects`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const t = generateNote(level, mulberry32(seed));
        const ids = t.objects.map((o) => o.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(NOTE_SLOTS);
        for (const id of t.targets) expect(ids).toContain(id);
        expect(t.text.length).toBeGreaterThan(0);
      }
    });
  }

  it('L1 uses one short word in capitals', () => {
    const t = generateNote(1, mulberry32(7));
    expect(t.text).toMatch(/^[А-ЯЁ]{3,5}$/);
  });

  it('L3 names the attribute of the target', () => {
    for (let seed = 1; seed < 50; seed++) {
      const t = generateNote(3, mulberry32(seed));
      const target = t.objects.find((o) => o.id === t.targets[0])!;
      const word = { big: 'больш', small: 'маленьк', red: 'красн', blue: 'син', green: 'зелён' }[(target.size ?? target.color)!];
      expect(t.text.toLowerCase()).toContain(word);
    }
  });

  it('L5 target is the one NOT named', () => {
    for (let seed = 1; seed < 50; seed++) {
      const t = generateNote(5, mulberry32(seed));
      const target = t.objects.find((o) => o.id === t.targets[0])!;
      const same = t.objects.filter((o) => o.kind === target.kind);
      expect(same).toHaveLength(2);
      const named = same.find((o) => o.id !== target.id)!;
      const stem = { big: 'больш', small: 'маленьк', red: 'красн', blue: 'син', green: 'зелён' }[(named.size ?? named.color)!];
      expect(t.text.toLowerCase()).toContain(`не к ${stem}`);
    }
  });

  it('L4 has two ordered targets', () => {
    expect(generateNote(4, mulberry32(3)).targets).toHaveLength(2);
  });
});
