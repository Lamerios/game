import { int, pick, shuffle, type Rng } from '../common/rng';
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
  /** The question. Math questions are read aloud; reading questions the child reads themself. */
  text: string;
  visual: Visual;
  options: Option[];
  answer: number;
  /** Hints for steps 1–3 of the ladder; step 4 shows the answer. */
  hints: [string, string, string];
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
export const coins = (n: number) => `${n} ${plural(n, 'монета', 'монеты', 'монет')}`;

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
        text: `Весы Моржа уравновешены. Слева мешок на ${known} и ящик, справа гиря на ${total}. Сколько весит ящик?`,
        visual: { type: 'scales', known, total },
        hints: [
          'Весы ровные: слева столько же, сколько справа.',
          `Ящик и ${known} вместе дают ${total}.`,
          `Посчитай от ${known} до ${total}. Сколько шагов?`,
        ],
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
        text: `Одна бочка стоит ${coins(price)}. Нам нужно ${items} ${plural(items, 'бочка', 'бочки', 'бочек')}. Сколько монет отдать Моржу?`,
        visual: { type: 'trade', items, price },
        hints: [
          'За каждую бочку свои монеты.',
          `Положи по ${price} монеты к каждой бочке.`,
          `Считай двойками: ${Array.from({ length: items }, (_, i) => (i + 1) * price).slice(0, 2).join(', ')}…`,
        ],
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
          text: `У Кляксы 8 щупалец. В ${holding} он держит по одной монете, а в остальных — по две. Сколько монет у Кляксы?`,
          visual: { type: 'octopus', holding, each: 1, rest },
          hints: [
            'Сначала узнай, в скольких щупальцах по две монеты.',
            `По две монеты в ${rest} щупальцах. Это ${rest * 2}.`,
            `${holding} и ещё ${rest * 2}. Сколько вместе?`,
          ],
          itemId: `octo2-${holding}`,
        };
      }
      const holding = int(rng, 2, 6);
      const answer = 8 - holding;
      const o = numberOptions(rng, answer, [holding, 8]);
      return {
        skill: 'math', kind, level, ...o,
        text: `У Кляксы 8 щупалец. В ${holding} он держит наши монеты. Сколько щупалец у него свободно?`,
        visual: { type: 'octopus', holding, each: 1, rest: 0 },
        hints: ['Посчитай щупальца без монет.', `Всего 8, заняты ${holding}.`, `От ${holding} до 8. Сколько шагов?`],
        itemId: `octo1-${holding}`,
      };
    }
    case 'share': {
      const crew = level >= 3 ? pick(rng, [2, 3]) : 2;
      const each = int(rng, 2, level >= 5 ? 5 : 3);
      const total = crew * each;
      const o = numberOptions(rng, each, [total - crew, crew]);
      const who = crew === 2 ? 'Румбу и Болтику' : 'Румбу, Болтику и Пыхтелкину';
      return {
        skill: 'math', kind, level, ...o,
        text: `Раздели ${coins(total)} поровну: ${who}. Сколько монет получит каждый?`,
        visual: { type: 'share', coins: total, crew },
        hints: ['Поровну — это всем одинаково.', 'Раздавай по одной монете каждому по кругу.', `Попробуй дать каждому по ${each - 1}. Хватит? А останется?`],
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
      return {
        skill: 'math', kind: 'code', level,
        text: `Код замка из двух цифр. Первая больше ${first - 1}, но меньше ${first + 1}. Вторая на ${k} ${up ? 'больше' : 'меньше'} первой.`,
        visual: { type: 'lock' },
        options: opts.map((l) => ({ label: l })),
        answer: opts.indexOf(answer),
        hints: [
          `Какое число стоит между ${first - 1} и ${first + 1}?`,
          `Первая цифра ${first}.`,
          `От ${first} сделай ${k} ${up ? 'шаг вперёд' : 'шаг назад'}${k > 1 ? 'а' : ''}.`,
        ],
        itemId: `code-${answer}`,
      };
    }
  }
}

// ---------- reading ----------

const WORDS = ['ПАРУС', 'МАЧТА', 'ЯКОРЬ', 'ВОЛНА', 'КАРТА', 'ОСТРОВ', 'КОМПАС', 'ПИРАТ', 'ЧАЙКА', 'БОЧКА', 'ПУШКА', 'ЛОДКА', 'СУНДУК', 'ПАЛЬМА', 'ЧЕРЕПАХА', 'КРАБ'];
const VOWELS = ['А', 'О', 'У', 'Ы', 'И', 'Е', 'Я'];
const CONSONANTS = ['Б', 'В', 'Г', 'Д', 'К', 'Л', 'М', 'Н', 'П', 'Р', 'С', 'Т', 'Ч', 'Ш'];

const RIDDLES: Record<string, string[]> = {
  crab: ['У меня есть клешни, а хожу я боком.', 'Я хожу боком и прячусь под камнем.'],
  anchor: ['Я тяжёлый и железный. Я держу корабль на месте.', 'Меня бросают в воду, чтобы яхта не уплыла.'],
  chest: ['Меня закрывают на замок. Внутри прячут клад.'],
  palm: ['Я расту на песке. На макушке у меня орехи.'],
  barrel: ['Я круглая и деревянная. Во мне хранят воду.'],
  cannon: ['Я громко бухаю и стреляю ядрами.'],
  turtle: ['Я хожу медленно и ношу свой дом на спине.'],
  boat: ['У меня есть парус, но я меньше яхты.'],
  stone: ['Я лежу на берегу. Я твёрдый, холодный и не умею двигаться.'],
  flag: ['Я развеваюсь на ветру на высокой палке. По мне узнают корабль.'],
};

const ADJ_PREP = {
  red: { m: 'красном', f: 'красной' },
  blue: { m: 'синем', f: 'синей' },
  green: { m: 'зелёном', f: 'зелёной' },
} as const;

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
      text: 'Клякса залил букву. Какая буква спряталась?',
      visual: { type: 'note', text: word, blot },
      options: opts.map((l) => ({ label: l })),
      answer: opts.indexOf(right),
      hints: ['Прочитай слово по слогам, а на кляксе подумай, какой звук там слышен.', `Это слово про море. Оно начинается на ${letters[0]}.`, `Здесь написано слово ${word.toLowerCase()}. Какой звук под кляксой?`],
      itemId: `smudge-${word}-${blot}`,
    };
  }
  if (kind === 'riddle') {
    const ids = Object.keys(RIDDLES);
    const answerId = pick(rng, ids);
    const text = pick(rng, RIDDLES[answerId]!);
    const opts = shuffle(rng, [answerId, ...shuffle(rng, ids.filter((i) => i !== answerId)).slice(0, 2)]);
    const name = KINDS.find((k) => k.id === answerId)!.nom;
    return {
      skill: 'reading', kind, level,
      text: `Загадка Бороды: ${text} Кто я?`,
      visual: { type: 'none' },
      options: opts.map((id) => ({ key: `obj-${id}${['chest', 'barrel', 'boat', 'flag'].includes(id) ? '-red' : ''}` })),
      answer: opts.indexOf(answerId),
      hints: ['Прочитай загадку ещё раз, медленно.', 'Подумай, у кого из них это бывает.', `Это ${name}?`],
      itemId: `riddle-${answerId}`,
    };
  }
  // Detective: where is the map? Three hiding places, the note rules out two.
  const places = { chest: { prep: 'сундуке', g: 'm' }, barrel: { prep: 'бочке', g: 'f' }, boat: { prep: 'лодке', g: 'f' } } as const;
  type Place = keyof typeof places;
  const [k1, k2] = shuffle(rng, Object.keys(places) as Place[]) as [Place, Place];
  const [c1, c2] = shuffle(rng, ['red', 'blue', 'green'] as const) as ['red' | 'blue' | 'green', 'red' | 'blue' | 'green'];
  const suspects = shuffle(rng, [`${k1}-${c2}`, `${k1}-${c1}`, `${k2}-${c1}`]);
  const answerKey = `${k1}-${c2}`;
  const adj = ADJ_PREP[c1][places[k1].g];
  return {
    skill: 'reading', kind: 'detective', level,
    text: `Записка Бороды: «Карта не в ${places[k2].prep}. И она не в ${adj} ${places[k1].prep}». Где карта?`,
    visual: { type: 'none' },
    options: suspects.map((s) => ({ key: `obj-${s}` })),
    answer: suspects.indexOf(answerKey),
    hints: ['Прочитай записку ещё раз, по одному предложению.', `Карта не в ${places[k2].prep}. Что можно убрать?`, `И не в ${adj} ${places[k1].prep}. Что осталось?`],
    itemId: `detective-${answerKey}-${k2}`,
  };
}
