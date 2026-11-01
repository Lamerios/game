import { phrase, type Params, type PhraseId, type Utterance } from '../../core/phrases';
import { int, pick, shuffle, type Rng } from '../common/rng';
import content from '../../../content/phrases.json';
import { KINDS } from '../note/vocab';

/**
 * Story puzzles (scenario v0.2) instead of bare "7 + 2": scales, trading,
 * Klyaksa's tentacles, fair shares, code locks (math); ink blots, riddles and
 * "who stole the barrels" (reading). Each has 3 options and one answer.
 */
export type Visual =
  | { type: 'scales'; known: number; total: number }
  | { type: 'trade'; items: number; price: number }
  | { type: 'octopus'; holding: number; each: number; rest: number }
  | { type: 'share'; coins: number; crew: number }
  | { type: 'lock' }
  | { type: 'note'; text: string; blot: number }
  | { type: 'none' };

export interface Option {
  /** Text on the button, or a texture key for a picture option. */
  label?: string;
  key?: string;
}

export interface Puzzle {
  skill: 'math' | 'reading';
  kind: string;
  level: number;
  /** The question as shown. Math questions are read aloud; reading questions the child reads themself. */
  text: string;
  /** The question as spoken (its `show` is `text`). */
  say: Utterance;
  visual: Visual;
  options: Option[];
  answer: number;
  /** Hints for steps 1–3 of the ladder; step 4 shows the answer. */
  hints: [Utterance, Utterance, Utterance];
  /** Said when step 4 shows the answer. */
  answerSay: Utterance;
  itemId: string;
}

/** Puts the answer among distractors (unique, positive), returns options + answer index. */
function numberOptions(rng: Rng, answer: number, distractors: number[]): { options: Option[]; answer: number } {
  const set = [answer];
  for (const d of [...distractors, answer + 1, answer - 1, answer + 2]) {
    if (set.length >= 3) break;
    if (d > 0 && !set.includes(d)) set.push(d);
  }
  const sorted = shuffle(rng, set);
  return { options: sorted.map((n) => ({ label: String(n) })), answer: sorted.indexOf(answer) };
}

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
const coinWord = (n: number) => plural(n, 'монета', 'монеты', 'монет');

/** Question + three hints from content/phrases.json: `id` and `<hintBase>.hint.1..3` (variant suffix `.N` dropped). */
function lines(id: string, params: Params, hintParams: [Params, Params, Params] = [params, params, params], hintBase = id.replace(/\.\d+$/, '')) {
  const say = phrase(id as PhraseId, params);
  const hint = (i: 1 | 2 | 3) => phrase(`${hintBase}.hint.${i}` as PhraseId, hintParams[i - 1]);
  return { say, text: say.show, hints: [hint(1), hint(2), hint(3)] as [Utterance, Utterance, Utterance] };
}

const numberAnswer = (n: number) => phrase('puzzle.answer', { n });

// ---------- math ----------

export function generateMathPuzzle(level: number, rng: Rng): Puzzle {
  const max = level <= 2 ? 10 : level <= 4 ? 15 : 20;
  const kinds = ['scales', 'share', 'octopus'];
  if (level >= 3) kinds.push('trade', 'code');
  const kind = pick(rng, kinds);
  switch (kind) {
    case 'scales': {
      const known = int(rng, 2, max - 2);
      const x = int(rng, 1, max - known);
      const total = known + x;
      const o = numberOptions(rng, x, [total, known]);
      return {
        skill: 'math', kind, level, ...o,
        ...lines('puzzle.scales', { a: known, b: total }),
        answerSay: numberAnswer(x),
        visual: { type: 'scales', known, total },
        itemId: `scales-${known}-${total}`,
      };
    }
    case 'trade': {
      const price = level >= 5 ? pick(rng, [2, 3]) : 2;
      const items = int(rng, 2, level >= 5 ? 4 : 3);
      const answer = price * items;
      const o = numberOptions(rng, answer, [price + items, answer - price]);
      return {
        skill: 'math', kind, level, ...o,
        ...lines('puzzle.trade', { p: price, n: items, a: price, b: price * 2 }),
        answerSay: numberAnswer(answer),
        visual: { type: 'trade', items, price },
        itemId: `trade-${price}x${items}`,
      };
    }
    case 'octopus': {
      if (level >= 5) {
        const holding = int(rng, 2, 6);
        const rest = 8 - holding;
        const answer = holding + rest * 2;
        const o = numberOptions(rng, answer, [8, holding + rest]);
        return {
          skill: 'math', kind, level, ...o,
          ...lines('puzzle.octo2', { e: 8, h: holding, r: rest, d: rest * 2 }),
          answerSay: numberAnswer(answer),
          visual: { type: 'octopus', holding, each: 1, rest },
          itemId: `octo2-${holding}`,
        };
      }
      const holding = int(rng, 2, 6);
      const answer = 8 - holding;
      const o = numberOptions(rng, answer, [holding, 8]);
      return {
        skill: 'math', kind, level, ...o,
        ...lines('puzzle.octo1', { e: 8, h: holding }),
        answerSay: numberAnswer(answer),
        visual: { type: 'octopus', holding, each: 1, rest: 0 },
        itemId: `octo1-${holding}`,
      };
    }
    case 'share': {
      const crew = level >= 3 ? pick(rng, [2, 3]) : 2;
      const each = int(rng, 2, level >= 5 ? 5 : 3);
      const total = crew * each;
      const o = numberOptions(rng, each, [total - crew, crew]);
      return {
        skill: 'math', kind, level, ...o,
        ...lines(`puzzle.share.${crew}`, { c: total, w: coinWord(total) }),
        answerSay: numberAnswer(each),
        visual: { type: 'share', coins: total, crew },
        itemId: `share-${total}/${crew}`,
      };
    }
    default: {
      // Code lock: first digit by "between", second by "k less/more".
      const first = int(rng, 3, 8);
      const k = int(rng, 1, level >= 5 ? 3 : 2);
      const up = rng() < 0.5 && first + k <= 9;
      const second = up ? first + k : first - k;
      const answer = `${first}${second}`;
      const wrong1 = `${first}${up ? first - k : first + k}`;
      const wrong2 = `${second}${first}`;
      const opts = shuffle(rng, [...new Set([answer, wrong1, wrong2, `${first + 1}${second}`])].slice(0, 3));
      const steps = `${k > 1 ? 'шага' : 'шаг'} ${up ? 'вперёд' : 'назад'}`;
      return {
        skill: 'math', kind: 'code', level,
        ...lines(k === 1 ? 'puzzle.code.1' : 'puzzle.code', { a: first - 1, b: first + 1, k, cmp: up ? 'больше' : 'меньше' }, [
          { a: first - 1 },
          { f: first },
          { f: first, k, steps },
        ]),
        answerSay: phrase('puzzle.answer.code', { a: first, b: second }),
        visual: { type: 'lock' },
        options: opts.map((l) => ({ label: l })),
        answer: opts.indexOf(answer),
        itemId: `code-${answer}`,
      };
    }
  }
}

// ---------- reading ----------

const WORDS = ['ПАРУС', 'МАЧТА', 'ЯКОРЬ', 'ВОЛНА', 'КАРТА', 'ОСТРОВ', 'КОМПАС', 'ПИРАТ', 'ЧАЙКА', 'БОЧКА', 'ПУШКА', 'ЛОДКА', 'СУНДУК', 'ПАЛЬМА', 'ЧЕРЕПАХА', 'КРАБ'];
const VOWELS = ['А', 'О', 'У', 'Ы', 'И', 'Е', 'Я'];
const CONSONANTS = ['Б', 'В', 'Г', 'Д', 'К', 'Л', 'М', 'Н', 'П', 'Р', 'С', 'Т', 'Ч', 'Ш'];

/** Riddles per object: phrases "puzzle.riddle.<id>.<n>" in content/phrases.json. */
const RIDDLES: Record<string, PhraseId[]> = {};
for (const id of Object.keys(content.phrases)) {
  const m = /^puzzle\.riddle\.(\w+)\.\d+$/.exec(id);
  if (m && m[1] !== 'hint') (RIDDLES[m[1]!] ??= []).push(id as PhraseId);
}

const ADJ_PREP = {
  red: { m: 'красном', f: 'красной' },
  blue: { m: 'синем', f: 'синей' },
  green: { m: 'зелёном', f: 'зелёной' },
} as const;

const PLACES = { chest: { prep: 'сундуке', g: 'm' }, barrel: { prep: 'бочке', g: 'f' }, boat: { prep: 'лодке', g: 'f' } } as const;

export function generateReadingPuzzle(level: number, rng: Rng): Puzzle {
  const kinds = ['smudge', 'riddle'];
  if (level >= 5) kinds.push('detective');
  const kind = pick(rng, kinds);
  if (kind === 'smudge') {
    const word = pick(rng, WORDS);
    const letters = [...word];
    const idxs = letters.map((_, i) => i).filter((i) => (level >= 6 ? true : VOWELS.includes(letters[i]!)));
    const blot = pick(rng, idxs);
    const right = letters[blot]!;
    const pool = VOWELS.includes(right) ? VOWELS : CONSONANTS;
    const opts = shuffle(rng, [right, ...shuffle(rng, pool.filter((l) => l !== right)).slice(0, 2)]);
    return {
      skill: 'reading', kind, level,
      ...lines('puzzle.smudge', {}, [{}, { l: letters[0]! }, { w: word.toLowerCase() }]),
      answerSay: phrase('puzzle.answer.letter', { l: right }),
      visual: { type: 'note', text: word, blot },
      options: opts.map((l) => ({ label: l })),
      answer: opts.indexOf(right),
      itemId: `smudge-${word}-${blot}`,
    };
  }
  if (kind === 'riddle') {
    const ids = Object.keys(RIDDLES);
    const answerId = pick(rng, ids);
    const riddle = pick(rng, RIDDLES[answerId]!);
    const opts = shuffle(rng, [answerId, ...shuffle(rng, ids.filter((i) => i !== answerId)).slice(0, 2)]);
    const name = KINDS.find((k) => k.id === answerId)!.nom;
    return {
      skill: 'reading', kind, level,
      ...lines(riddle, {}, [{}, {}, { w: name }], 'puzzle.riddle'),
      answerSay: phrase('puzzle.answer.picture'),
      visual: { type: 'none' },
      options: opts.map((id) => ({ key: `obj-${id}${['chest', 'barrel', 'boat', 'flag'].includes(id) ? '-red' : ''}` })),
      answer: opts.indexOf(answerId),
      itemId: `riddle-${answerId}`,
    };
  }
  // Detective: where is the map? Three hiding places, the note rules out two.
  const places = PLACES;
  type Place = keyof typeof places;
  const [k1, k2] = shuffle(rng, Object.keys(places) as Place[]) as [Place, Place];
  const [c1, c2] = shuffle(rng, ['red', 'blue', 'green'] as const) as ['red' | 'blue' | 'green', 'red' | 'blue' | 'green'];
  const suspects = shuffle(rng, [`${k1}-${c2}`, `${k1}-${c1}`, `${k2}-${c1}`]);
  const answerKey = `${k1}-${c2}`;
  const adj = ADJ_PREP[c1][places[k1].g];
  return {
    skill: 'reading', kind: 'detective', level,
    ...lines('puzzle.detective', { p: places[k2].prep, q: `${adj} ${places[k1].prep}` }),
    answerSay: phrase('puzzle.answer.picture'),
    visual: { type: 'none' },
    options: suspects.map((s) => ({ key: `obj-${s}` })),
    answer: suspects.indexOf(answerKey),
    itemId: `detective-${answerKey}-${k2}`,
  };
}

/** Every free text a puzzle puts into a {x:text} slot, for tools/tts.ts. */
export function allPuzzleTexts(): string[] {
  const out = new Set<string>(['монета', 'монеты', 'монет', 'больше', 'меньше']);
  for (const k of [1, 2]) for (const d of ['вперёд', 'назад']) out.add(`${k > 1 ? 'шага' : 'шаг'} ${d}`);
  for (const w of WORDS) out.add(w.toLowerCase());
  for (const k of KINDS) out.add(k.nom);
  for (const { prep, g } of Object.values(PLACES)) {
    out.add(prep);
    for (const c of Object.values(ADJ_PREP)) out.add(`${c[g]} ${prep}`);
  }
  return [...out];
}
