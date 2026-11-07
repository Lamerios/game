import { describe, expect, it } from 'vitest';
import content from '../content/phrases.json';
import { allClips, free, numberSeg, phrase, stressText, textId, webText, type PhraseId } from '../src/core/phrases';
import { allNoteTexts, generateNote, NOTE_MAX_LEVEL } from '../src/games/note/generator';
import { generateHold, HOLD_MAX_LEVEL } from '../src/games/hold/generator';
import { allPuzzleTexts, generateMathPuzzle, generateReadingPuzzle } from '../src/games/puzzle/generator';
import { mulberry32 } from '../src/games/common/rng';

describe('phrases', () => {
  it('cuts a phrase at its slots and hides stress marks on screen', () => {
    const u = phrase('hold.load', { n: 7 });
    expect(u.show).toBe('Загрузи в трюм ровно 7. Нажимай на грузы на причале.');
    expect(u.segs.map((s) => s.id)).toEqual(['hold.load.0', 'num.nom.7', 'hold.load.1']);
    expect(u.segs[0]!.say).toBe('Загруз+и в трюм р+овно');
  });

  it('uses genitive where the phrase asks for it', () => {
    const u = phrase('hold.hint.count', { a: 5, b: 8 });
    expect(u.show).toBe('Начни с 5 и досчитай до 8. Сколько шагов?');
    expect(webText(u)).toBe('Начни с пяти и досчитай до восьми. Сколько шагов?');
  });

  it('leaves punctuation-only pieces silent', () => {
    const u = phrase('hold.hint.now', { a: 3, b: 10 });
    expect(u.segs.at(-1)).toMatchObject({ show: '.', say: '' });
  });

  it('falls back to the browser voice for numbers it has no clip for', () => {
    expect(numberSeg(155).voiced).toBe(false);
    expect(numberSeg(125, 'gen').voiced).toBe(false);
  });

  it('stresses free text from the dictionary', () => {
    expect(stressText('Иди к пушке.')).toBe('ид+и к п+ушке.');
    expect(free('ИДИ К КРАБУ').segs[0]!.id).toBe(textId('ИДИ К КРАБУ'));
  });

  it('every template piece is a clip, and clip ids are unique', () => {
    const clips = allClips([]);
    for (const id of Object.keys(content.phrases)) {
      const params: Record<string, string | number> = {};
      for (const m of (content.phrases as Record<string, string>)[id]!.matchAll(/\{(\w+)(?::(\w+))?\}/g)) {
        params[m[1]!] = m[2] === 'text' ? 'x' : m[2] === 'letter' ? 'А' : 1;
      }
      const sample = phrase(id as PhraseId, params);
      for (const s of sample.segs) if (s.say && !s.id.startsWith('t.')) expect(clips.has(s.id), s.id).toBe(true);
    }
    const all = allClips(allNoteTexts());
    expect(all.size).toBe(new Set(all.keys()).size);
  });

  it('every number the hold game can say has a clip', () => {
    const clips = allClips([]);
    const rng = mulberry32(42);
    for (let i = 0; i < 2000; i++) {
      const t = generateHold(1 + (i % HOLD_MAX_LEVEL), rng);
      const nums = t.kind === 'load' ? [t.target] : t.kind === 'unload' ? [t.leave] : [t.was, t.became, t.answer];
      for (const n of nums) {
        expect(clips.has(`num.nom.${n}`)).toBe(true);
        expect(clips.has(`num.gen.${n}`)).toBe(true);
      }
    }
  });

  it('allNoteTexts covers every note the generator writes', () => {
    const texts = new Set(allNoteTexts());
    const rng = mulberry32(7);
    for (let i = 0; i < 3000; i++) {
      const n = generateNote(1 + (i % NOTE_MAX_LEVEL), rng);
      expect(texts.has(n.text), n.text).toBe(true);
    }
  });

  it('every word of every phrase has a stress mark (or a single vowel)', () => {
    for (const [id, t] of Object.entries(content.phrases)) {
      const text = t.replace(/\{[^}]+\}/g, '');
      for (const w of text.toLowerCase().match(/[а-яё+]+/g) ?? []) {
        const vowels = (w.match(/[аеёиоуыэюя]/g) ?? []).length;
        expect(vowels <= 1 || w.includes('+') || w.includes('ё'), `${w} in ${id}`).toBe(true);
      }
    }
  });

  it('every puzzle word and letter has a stress and a clip', () => {
    const clips = allClips(allPuzzleTexts());
    for (const t of allPuzzleTexts()) {
      expect(clips.has(textId(t)), t).toBe(true);
      for (const w of stressText(t).match(/[а-яё+]+/g) ?? []) {
        const vowels = (w.match(/[аеёиоуыэюя]/g) ?? []).length;
        expect(vowels <= 1 || w.includes('+') || w.includes('ё'), `${w} in "${t}"`).toBe(true);
      }
    }
    for (const l of 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ') expect(clips.has(`letter.${l}`), l).toBe(true);
  });

  it('puzzles are spoken from clips only, never by the browser voice', () => {
    const clips = allClips(allPuzzleTexts());
    const rng = mulberry32(17);
    for (let i = 0; i < 1500; i++) {
      const level = 1 + (i % 7);
      const p = i % 2 ? generateMathPuzzle(level, rng) : generateReadingPuzzle(level, rng);
      expect(p.say.show).toBe(p.text);
      for (const u of [p.say, ...p.hints, p.answerSay]) {
        for (const s of u.segs) if (s.say) expect(s.voiced && clips.has(s.id), `${p.kind}: ${s.id} "${s.show}"`).toBe(true);
      }
    }
  });

  it('feminine numbers: одна, две; the rest as masculine', () => {
    expect(webText(phrase('puzzle.trade', { p: 2, n: 3, a: 2, b: 4 }))).toBe('Одна бочка стоит две монеты. Нам нужно три бочки. Сколько монет отдать Моржу?');
    expect(numberSeg(1, 'fem')).toMatchObject({ id: 'num.fem.1', say: 'одн+а' });
    expect(numberSeg(5, 'fem').id).toBe('num.nom.5');
  });

  it('every word of every note has a stress (or a single vowel)', () => {
    for (const t of allNoteTexts()) {
      for (const w of stressText(t).match(/[а-яё+]+/g) ?? []) {
        const vowels = (w.match(/[аеёиоуыэюя]/g) ?? []).length;
        expect(vowels <= 1 || w.includes('+') || w.includes('ё'), `${w} in "${t}"`).toBe(true);
      }
    }
  });
});
