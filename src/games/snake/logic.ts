import content from '../../../content/phrases.json';
import { unstress } from '../../core/phrases';
import { LEARNT_AT } from '../../core/wordStats';
import { shuffle, type Rng } from '../common/rng';

/**
 * Snake with English words: rules without Phaser, so they can be tested.
 * The board wraps at the edges and the snake may cross itself: nothing ends
 * the game early, a wrong picture only costs a moment.
 */

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Cell {
  x: number;
  y: number;
}

export const DIRS: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export type Category =
  | 'fruit' | 'vegetable' | 'animal' | 'thing' | 'food' | 'transport' | 'home' | 'clothes' | 'toy' | 'nature' | 'body'
  | 'color' | 'number';
export interface Word {
  /** Also the picture (public/snake/<id>.webp; numbers are drawn) and the clip (en.<id>). Numbers are n0…n100. */
  id: string;
  ru: string;
  cat: Category;
}

export const PICTURES: readonly Word[] = [
  { id: 'apple', ru: 'яблоко', cat: 'fruit' },
  { id: 'banana', ru: 'банан', cat: 'fruit' },
  { id: 'orange', ru: 'апельсин', cat: 'fruit' },
  { id: 'pear', ru: 'груша', cat: 'fruit' },
  { id: 'grapes', ru: 'виноград', cat: 'fruit' },
  { id: 'strawberry', ru: 'клубника', cat: 'fruit' },
  { id: 'cherry', ru: 'вишня', cat: 'fruit' },
  { id: 'watermelon', ru: 'арбуз', cat: 'fruit' },
  { id: 'lemon', ru: 'лимон', cat: 'fruit' },
  { id: 'carrot', ru: 'морковка', cat: 'vegetable' },
  { id: 'tomato', ru: 'помидор', cat: 'vegetable' },
  { id: 'potato', ru: 'картошка', cat: 'vegetable' },
  { id: 'cucumber', ru: 'огурец', cat: 'vegetable' },
  { id: 'corn', ru: 'кукуруза', cat: 'vegetable' },
  { id: 'onion', ru: 'лук', cat: 'vegetable' },
  { id: 'cat', ru: 'кошка', cat: 'animal' },
  { id: 'dog', ru: 'собака', cat: 'animal' },
  { id: 'fish', ru: 'рыба', cat: 'animal' },
  { id: 'bird', ru: 'птица', cat: 'animal' },
  { id: 'cow', ru: 'корова', cat: 'animal' },
  { id: 'pig', ru: 'свинья', cat: 'animal' },
  { id: 'horse', ru: 'лошадь', cat: 'animal' },
  { id: 'frog', ru: 'лягушка', cat: 'animal' },
  { id: 'duck', ru: 'утка', cat: 'animal' },
  { id: 'rabbit', ru: 'кролик', cat: 'animal' },
  { id: 'bear', ru: 'медведь', cat: 'animal' },
  { id: 'lion', ru: 'лев', cat: 'animal' },
  { id: 'monkey', ru: 'обезьяна', cat: 'animal' },
  { id: 'elephant', ru: 'слон', cat: 'animal' },
  { id: 'mouse', ru: 'мышка', cat: 'animal' },
  { id: 'turtle', ru: 'черепаха', cat: 'animal' },
  { id: 'sun', ru: 'солнце', cat: 'thing' },
  { id: 'star', ru: 'звезда', cat: 'thing' },
  { id: 'ball', ru: 'мяч', cat: 'thing' },
  { id: 'car', ru: 'машина', cat: 'thing' },
  { id: 'house', ru: 'дом', cat: 'thing' },
  { id: 'tree', ru: 'дерево', cat: 'thing' },
  { id: 'flower', ru: 'цветок', cat: 'thing' },
  { id: 'boat', ru: 'кораблик', cat: 'thing' },
  { id: 'cake', ru: 'торт', cat: 'thing' },
  { id: 'egg', ru: 'яйцо', cat: 'thing' },
  { id: 'chicken', ru: 'курица', cat: 'animal' },
  { id: 'sheep', ru: 'овца', cat: 'animal' },
  { id: 'goat', ru: 'коза', cat: 'animal' },
  { id: 'giraffe', ru: 'жираф', cat: 'animal' },
  { id: 'zebra', ru: 'зебра', cat: 'animal' },
  { id: 'tiger', ru: 'тигр', cat: 'animal' },
  { id: 'penguin', ru: 'пингвин', cat: 'animal' },
  { id: 'owl', ru: 'сова', cat: 'animal' },
  { id: 'snake', ru: 'змея', cat: 'animal' },
  { id: 'bee', ru: 'пчела', cat: 'animal' },
  { id: 'butterfly', ru: 'бабочка', cat: 'animal' },
  { id: 'snail', ru: 'улитка', cat: 'animal' },
  { id: 'crab', ru: 'краб', cat: 'animal' },
  { id: 'octopus', ru: 'осьминог', cat: 'animal' },
  { id: 'whale', ru: 'кит', cat: 'animal' },
  { id: 'dolphin', ru: 'дельфин', cat: 'animal' },
  { id: 'fox', ru: 'лиса', cat: 'animal' },
  { id: 'wolf', ru: 'волк', cat: 'animal' },
  { id: 'hedgehog', ru: 'ёжик', cat: 'animal' },
  { id: 'spider', ru: 'паук', cat: 'animal' },
  { id: 'ant', ru: 'муравей', cat: 'animal' },
  { id: 'camel', ru: 'верблюд', cat: 'animal' },
  { id: 'kangaroo', ru: 'кенгуру', cat: 'animal' },
  { id: 'crocodile', ru: 'крокодил', cat: 'animal' },
  { id: 'shark', ru: 'акула', cat: 'animal' },
  { id: 'parrot', ru: 'попугай', cat: 'animal' },
  { id: 'bread', ru: 'хлеб', cat: 'food' },
  { id: 'cheese', ru: 'сыр', cat: 'food' },
  { id: 'milk', ru: 'молоко', cat: 'food' },
  { id: 'icecream', ru: 'мороженое', cat: 'food' },
  { id: 'pizza', ru: 'пицца', cat: 'food' },
  { id: 'candy', ru: 'конфета', cat: 'food' },
  { id: 'cookie', ru: 'печенье', cat: 'food' },
  { id: 'sandwich', ru: 'бутерброд', cat: 'food' },
  { id: 'chocolate', ru: 'шоколад', cat: 'food' },
  { id: 'pineapple', ru: 'ананас', cat: 'fruit' },
  { id: 'peach', ru: 'персик', cat: 'fruit' },
  { id: 'broccoli', ru: 'брокколи', cat: 'vegetable' },
  { id: 'pepper', ru: 'перец', cat: 'vegetable' },
  { id: 'bus', ru: 'автобус', cat: 'transport' },
  { id: 'train', ru: 'поезд', cat: 'transport' },
  { id: 'plane', ru: 'самолёт', cat: 'transport' },
  { id: 'bicycle', ru: 'велосипед', cat: 'transport' },
  { id: 'ship', ru: 'корабль', cat: 'transport' },
  { id: 'rocket', ru: 'ракета', cat: 'transport' },
  { id: 'helicopter', ru: 'вертолёт', cat: 'transport' },
  { id: 'truck', ru: 'грузовик', cat: 'transport' },
  { id: 'key', ru: 'ключ', cat: 'home' },
  { id: 'bed', ru: 'кровать', cat: 'home' },
  { id: 'chair', ru: 'стул', cat: 'home' },
  { id: 'door', ru: 'дверь', cat: 'home' },
  { id: 'clock', ru: 'часы', cat: 'home' },
  { id: 'book', ru: 'книга', cat: 'home' },
  { id: 'pencil', ru: 'карандаш', cat: 'home' },
  { id: 'umbrella', ru: 'зонт', cat: 'home' },
  { id: 'cap', ru: 'кепка', cat: 'clothes' },
  { id: 'shoe', ru: 'кроссовок', cat: 'clothes' },
  { id: 'socks', ru: 'носки', cat: 'clothes' },
  { id: 'dress', ru: 'платье', cat: 'clothes' },
  { id: 'tshirt', ru: 'футболка', cat: 'clothes' },
  { id: 'glasses', ru: 'очки', cat: 'clothes' },
  { id: 'backpack', ru: 'рюкзак', cat: 'clothes' },
  { id: 'crown', ru: 'корона', cat: 'clothes' },
  { id: 'gift', ru: 'подарок', cat: 'toy' },
  { id: 'balloon', ru: 'шарик', cat: 'toy' },
  { id: 'kite', ru: 'воздушный змей', cat: 'toy' },
  { id: 'teddy', ru: 'мишка', cat: 'toy' },
  { id: 'drum', ru: 'барабан', cat: 'toy' },
  { id: 'guitar', ru: 'гитара', cat: 'toy' },
  { id: 'moon', ru: 'луна', cat: 'nature' },
  { id: 'cloud', ru: 'облако', cat: 'nature' },
  { id: 'snowman', ru: 'снеговик', cat: 'nature' },
  { id: 'rainbow', ru: 'радуга', cat: 'nature' },
  { id: 'fire', ru: 'огонь', cat: 'nature' },
  { id: 'leaf', ru: 'лист', cat: 'nature' },
  { id: 'mountain', ru: 'гора', cat: 'nature' },
  { id: 'snowflake', ru: 'снежинка', cat: 'nature' },
  { id: 'eye', ru: 'глаз', cat: 'body' },
  { id: 'mouth', ru: 'рот', cat: 'body' },
  { id: 'tooth', ru: 'зуб', cat: 'body' },
  { id: 'hand', ru: 'рука', cat: 'body' },
  { id: 'ear', ru: 'ухо', cat: 'body' },
  { id: 'nose', ru: 'нос', cat: 'body' },
];

/** Colours: drawn paint blobs; id c-<name> (so the colour orange is not the fruit). */
export const COLORS: readonly (Word & { paint: string })[] = [
  { id: 'c-red', ru: 'красный', cat: 'color', paint: '#e63946' },
  { id: 'c-blue', ru: 'синий', cat: 'color', paint: '#277da1' },
  { id: 'c-green', ru: 'зелёный', cat: 'color', paint: '#43aa8b' },
  { id: 'c-yellow', ru: 'жёлтый', cat: 'color', paint: '#ffd23f' },
  { id: 'c-orange', ru: 'оранжевый', cat: 'color', paint: '#f77f00' },
  { id: 'c-pink', ru: 'розовый', cat: 'color', paint: '#ff8fab' },
  { id: 'c-purple', ru: 'фиолетовый', cat: 'color', paint: '#7b2cbf' },
  { id: 'c-brown', ru: 'коричневый', cat: 'color', paint: '#8d5524' },
  { id: 'c-black', ru: 'чёрный', cat: 'color', paint: '#222222' },
  { id: 'c-white', ru: 'белый', cat: 'color', paint: '#ffffff' },
];

/** English numbers: 0–20, then the tens up to 100. */
export const NUMBER_VALUES: readonly number[] = [...Array.from({ length: 21 }, (_, i) => i), 30, 40, 50, 60, 70, 80, 90, 100];
export const numberId = (n: number) => `n${n}`;
export const numberOf = (id: string) => (/^n\d+$/.test(id) ? Number(id.slice(1)) : undefined);
export const NUMBERS: readonly Word[] = NUMBER_VALUES.map((n) => ({ id: numberId(n), ru: unstress(content.numbers.nom[n]!), cat: 'number' }));

export const WORDS: readonly Word[] = [...PICTURES, ...COLORS, ...NUMBERS];

export type Mode = 'words' | 'numbers' | 'mix' | 'rules' | 'sounds';

export const wordById = (id: string) => WORDS.find((w) => w.id === id)!;

const wrap = (v: number, n: number) => ((v % n) + n) % n;

export function stepHead(head: Cell, dir: Dir, cols: number, rows: number): Cell {
  const d = DIRS[dir];
  return { x: wrap(head.x + d.x, cols), y: wrap(head.y + d.y, rows) };
}

/** One step: a new head in front, the tail follows unless the snake grows. */
export function moveSnake(body: readonly Cell[], dir: Dir, grow: boolean, cols: number, rows: number): Cell[] {
  const next = [stepHead(body[0]!, dir, cols, rows), ...body];
  if (!grow) next.pop();
  return next;
}

/** Pictures per round: two at first, then three, then four. */
export const itemsForRound = (round: number) => (round < 3 ? 2 : round < 7 ? 3 : 4);

/**
 * Free cells for `n` pictures: off the snake, not right in front of its head
 * (no accidental bites as a round starts), and apart from each other so the big
 * pictures never overlap.
 */
export function placeItems(n: number, body: readonly Cell[], dir: Dir, cols: number, rows: number, rng: Rng): Cell[] {
  const head = body[0]!;
  const blocked = new Set(body.map((c) => `${c.x},${c.y}`));
  let c = head;
  for (let i = 0; i < 4; i++) {
    c = stepHead(c, dir, cols, rows);
    blocked.add(`${c.x},${c.y}`);
  }
  const all: Cell[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) all.push({ x, y });
  const out: Cell[] = [];
  for (const cell of shuffle(rng, all)) {
    if (out.length === n) break;
    if (blocked.has(`${cell.x},${cell.y}`)) continue;
    if (Math.abs(cell.x - head.x) + Math.abs(cell.y - head.y) < 3) continue;
    if (out.some((o) => Math.abs(o.x - cell.x) < 2 && Math.abs(o.y - cell.y) < 2)) continue;
    out.push(cell);
  }
  return out;
}

/** Eaten right on the first try this many times = learnt; it then only comes back for review. */
export const KNOWN_AT = LEARNT_AT;
/** New words per game: a non-native 6-year-old learns better meeting a few new ones among familiar ones. */
export const NEW_PER_GAME = 4;

/**
 * Words for one game, `stats` = id → times eaten right on the first try:
 * at most NEW_PER_GAME new words (the simplest first: the pool is ordered
 * from basic to harder), then the ones still being learnt (least practised
 * first), then learnt ones for review. Short of those, more new words.
 */
export function pickWords(stats: Record<string, number>, n: number, rng: Rng, pool: readonly Word[] = PICTURES, due: readonly string[] = []): string[] {
  const count = (w: Word) => stats[w.id] ?? 0;
  const byScore = (ws: Word[], score: (w: Word, i: number) => number) =>
    ws.map((w, i) => ({ w, s: score(w, i) })).sort((a, b) => a.s - b.s).map((x) => x.w.id);
  const fresh = byScore(pool.filter((w) => count(w) === 0), (_, i) => i + rng() * 12);
  const learning = byScore(pool.filter((w) => count(w) > 0 && count(w) < KNOWN_AT), (w) => count(w) + rng() * 1.5);
  const known = byScore(pool.filter((w) => count(w) >= KNOWN_AT), (w) => count(w) + rng() * 3);
  // Words due in the shared log (met in any game) come back first, up to half the game.
  const inPool = new Set(pool.map((w) => w.id));
  const out = due.filter((id) => inPool.has(id)).slice(0, Math.ceil(n / 2));
  for (const id of fresh.slice(0, NEW_PER_GAME)) if (out.length < n && !out.includes(id)) out.push(id);
  for (const id of [...learning, ...known, ...fresh.slice(NEW_PER_GAME)]) {
    if (out.includes(id)) continue;
    if (out.length >= n) break;
    out.push(id);
  }
  return shuffle(rng, out.slice(0, n));
}

/** Words mode draws from pictures and colours. */
const WORD_POOL: readonly Word[] = [...PICTURES, ...COLORS];

/** The ten words of one game: words, numbers, or six words and four numbers mixed. */
export function planGame(mode: Mode, stats: Record<string, number>, rounds: number, rng: Rng, due: readonly string[] = []): string[] {
  if (mode === 'numbers') return pickWords(stats, rounds, rng, NUMBERS, due);
  if (mode !== 'mix') return pickWords(stats, rounds, rng, WORD_POOL, due);
  const nums = Math.round(rounds * 0.4);
  return shuffle(rng, [...pickWords(stats, rounds - nums, rng, WORD_POOL, due), ...pickWords(stats, nums, rng, NUMBERS, due)]);
}

/** The number most easily mixed up with n when heard: thirteen/thirty, six/sixteen. */
export function soundsLike(n: number): number | undefined {
  if (n >= 13 && n <= 19) return (n - 10) * 10;
  if (n >= 30 && n <= 90) return n / 10 + 10;
  if (n >= 1 && n <= 9) return n + 10;
  return undefined;
}

/**
 * Other things to choose from, of the same kind as the target (numbers among
 * numbers). Later on one is close: fruit among fruit, thirty next to thirteen.
 */
export function distractors(target: string, k: number, round: number, rng: Rng): string[] {
  const t = wordById(target);
  const isNum = t.cat === 'number';
  // Numbers among numbers, colours among colours, pictures among pictures.
  const kind = (w: Word) => (w.cat === 'number' || w.cat === 'color' ? w.cat : 'picture');
  const others = shuffle(rng, WORDS.filter((w) => w.id !== target && kind(w) === kind(t)));
  const out: string[] = [];
  if (round >= 4 && isNum) {
    const twin = soundsLike(numberOf(target)!);
    if (twin !== undefined) out.push(numberId(twin));
  } else if (round >= 5 && t.cat !== 'color') {
    const same = others.find((w) => w.cat === t.cat);
    if (same) out.push(same.id);
  }
  for (const w of others) {
    if (out.length >= k) break;
    if (!out.includes(w.id)) out.push(w.id);
  }
  return out.slice(0, k);
}

// ---------- rule rounds and sound rounds ----------

/**
 * A round where more than one picture is right: "Only animals!" (eat every
 * animal, leave the rest — go / no-go) or "Find a word that starts like ball!"
 * (first sound, phonemic awareness in English). `line` is the English clip.
 */
export interface MultiRound {
  line: string;
  /** Pictures to eat. */
  ok: string[];
  /** Pictures to leave. */
  avoid: string[];
  /** The picture on the card (category example or the cue word). */
  cue: string;
}

export const RULE_CATS = ['animal', 'fruit', 'vegetable', 'transport', 'clothes', 'toy'] as const;
export type RuleCat = (typeof RULE_CATS)[number];
export const ruleLine = (c: RuleCat) => `rule.${c}`;
const RULE_TEXT: Record<RuleCat, string> = {
  animal: 'Only animals!',
  fruit: 'Only fruit!',
  vegetable: 'Only vegetables!',
  transport: 'Only transport!',
  clothes: 'Only clothes!',
  toy: 'Only toys!',
};

/** Sound groups by the first sound, not the letter: cat and kite start alike. */
export const SOUND_CUES = { b: 'ball', k: 'cat', d: 'dog', f: 'fish', h: 'house', m: 'moon', p: 'pig', s: 'sun', t: 'tree' } as const;
export type Sound = keyof typeof SOUND_CUES;
export const soundLine = (cue: string) => `starts.${cue}`;

const ENGLISH_WORDS: Record<string, string> = content.english.words;

/** The first sound of a picture's English word, if it is one of the clear groups. */
export function firstSound(id: string): Sound | undefined {
  const t = (ENGLISH_WORDS[id] ?? '').toLowerCase();
  if (/^(sh|ch|th|wh|ph|kn)/.test(t)) return undefined;
  const c = t[0];
  if (c === 'c' || c === 'k') return 'k';
  return c && c in SOUND_CUES ? (c as Sound) : undefined;
}

export function multiLines(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of RULE_CATS) out[ruleLine(c)] = RULE_TEXT[c];
  for (const cue of Object.values(SOUND_CUES)) out[soundLine(cue)] = `Find a word that starts like ${ENGLISH_WORDS[cue]}!`;
  return out;
}

/**
 * Rule game: the first half eats one category, then the rule switches. The old
 * category stays on the board as the trap (the classic rule-switch test, DCCS).
 */
export function planRules(rng: Rng, rounds = 8): MultiRound[] {
  const [a, b] = shuffle(rng, RULE_CATS) as RuleCat[];
  const of = (c: RuleCat) => shuffle(rng, PICTURES.filter((w) => w.cat === c).map((w) => w.id));
  const rest = (not: RuleCat[]) => shuffle(rng, PICTURES.filter((w) => !(not as string[]).includes(w.cat)).map((w) => w.id));
  return Array.from({ length: rounds }, (_, i) => {
    const cat = i < rounds / 2 ? a! : b!;
    const other = cat === a ? b! : a!;
    const pics = of(cat);
    const ok = pics.slice(0, 2);
    // After the switch the old category is the trap; before it, a random one.
    const avoid = [...(i >= rounds / 2 ? of(other).slice(0, 2) : of(other).slice(0, 1)), ...rest([a!, b!]).slice(0, i >= rounds / 2 ? 1 : 2)];
    // The card shows another picture of the category, not one on the board.
    return { line: ruleLine(cat), ok, avoid, cue: pics[2]! };
  });
}

/** Sound game: one picture starts like the cue word; the others start differently. */
export function planSounds(rng: Rng, rounds = 8): MultiRound[] {
  const groups = new Map<Sound, string[]>();
  for (const w of PICTURES) {
    const snd = firstSound(w.id);
    if (snd) groups.set(snd, [...(groups.get(snd) ?? []), w.id]);
  }
  const sounds = shuffle(rng, (Object.keys(SOUND_CUES) as Sound[]).filter((x) => (groups.get(x)?.length ?? 0) >= 3)).slice(0, 4);
  return Array.from({ length: rounds }, (_, i) => {
    const snd = sounds[i % sounds.length]!;
    const cue = SOUND_CUES[snd];
    const ok = shuffle(rng, groups.get(snd)!.filter((id) => id !== cue)).slice(0, 1);
    const n = i < 3 ? 2 : 3;
    const avoid = shuffle(rng, PICTURES.filter((w) => w.id !== cue && firstSound(w.id) !== snd && firstSound(w.id) !== undefined).map((w) => w.id)).slice(0, n);
    return { line: soundLine(cue), ok, avoid, cue };
  });
}
