import { MAX_LEVEL as ANCHOR } from '../anchor/logic';
import { MAX_LEVEL as CABINS } from '../cabins/logic';
import { MAX_LEVEL as CREW } from '../crew/logic';
import { MAX_LEVEL as GALLEY } from '../galley/logic';
import { MAX_LEVEL as JAM } from '../jam/logic';
import { MAX_LEVEL as MACHINE } from '../machine/logic';
import { MAX_LEVEL as MAPPUZZLE } from '../mappuzzle/logic';
import { MAX_LEVEL as PARCEL } from '../parcel/route';
import { MAX_LEVEL as RANGE } from '../range/logic';
import { MAX_LEVEL as SHIPYARD } from '../shipyard/logic';

/**
 * Коллекции мини-игр: что ребёнок получает за игру на три звезды.
 *
 * Как машины в гараже гонки: предметы идут по порядку, следующий виден
 * силуэтом с подписью «следующая», полученный можно нажать — голос говорит,
 * что это, по-английски. У большинства игр это наклейки со словами (картинки
 * и английские клипы общие со змейкой, так коллекция ещё и повторяет слова),
 * у змейки Шуши — шкурки, которые можно надеть.
 *
 * Без Phaser, чтобы проверять в тестах.
 */

/** Рамка наклейки: марка, тарелка, значок, карточка, монета. */
export type Frame = 'stamp' | 'plate' | 'badge' | 'card' | 'coin';

export interface StickerCollection {
  kind: 'sticker';
  /** «Марки», «Блюда кока»… — заголовок экрана коллекции. */
  title: string;
  /** Как называется один предмет: «марка», «наклейка». */
  frame: Frame;
  /** Цвет рамки. */
  color: number;
  /** Слова (id картинки и английского клипа), по порядку получения. */
  items: readonly string[];
}

export interface Skin {
  id: string;
  name: string;
  /** Контур, тело, узор на спине, голова. */
  outline: number;
  body: number;
  pattern: number;
  head: number;
  /** Английская реплика (клип en.<line>). */
  en: string;
}

export interface SkinCollection {
  kind: 'skin';
  title: string;
  color: number;
  items: readonly string[];
}

export type Collection = StickerCollection | SkinCollection;

/** Шкурки Шуши. Первая — с самого начала, остальные за игры на три звезды. */
export const SKINS: readonly Skin[] = [
  { id: 'green', name: 'Травка', outline: 0x1b4332, body: 0x52b788, pattern: 0x95d5b2, head: 0x40916c, en: 'The green snake!' },
  { id: 'blue', name: 'Волна', outline: 0x03045e, body: 0x48cae4, pattern: 0xcaf0f8, head: 0x0096c7, en: 'The blue snake!' },
  { id: 'yellow', name: 'Солнышко', outline: 0x7f5539, body: 0xffd166, pattern: 0xfff3b0, head: 0xf4a261, en: 'The yellow snake!' },
  { id: 'red', name: 'Перчик', outline: 0x6a040f, body: 0xe85d04, pattern: 0xffba08, head: 0xd00000, en: 'The red snake!' },
  { id: 'purple', name: 'Слива', outline: 0x240046, body: 0x9d4edd, pattern: 0xe0aaff, head: 0x7b2cbf, en: 'The purple snake!' },
  { id: 'pink', name: 'Зефирка', outline: 0x8a2846, body: 0xff8fab, pattern: 0xffe5ec, head: 0xfb6f92, en: 'The pink snake!' },
  { id: 'tiger', name: 'Тигрёнок', outline: 0x3d2b1f, body: 0xf48c06, pattern: 0x1b1b1b, head: 0xe85d04, en: 'The tiger snake!' },
  { id: 'zebra', name: 'Зебра', outline: 0x111111, body: 0xf8f9fa, pattern: 0x212529, head: 0xdee2e6, en: 'The zebra snake!' },
  { id: 'rainbow', name: 'Радуга', outline: 0x3a0ca3, body: 0x4cc9f0, pattern: 0xf72585, head: 0x7209b7, en: 'The rainbow snake!' },
  { id: 'gold', name: 'Золотая', outline: 0x7f5539, body: 0xffc300, pattern: 0xfff1a8, head: 0xe0a100, en: 'The gold snake!' },
];
export const STARTER_SKIN = 'green';
export const skinById = (id: string | undefined) => SKINS.find((s) => s.id === id) ?? SKINS[0]!;
export const skinLine = (id: string) => `snake.skin.${id}`;

export const COLLECTIONS: Record<string, Collection> = {
  snake: { kind: 'skin', title: 'Шкурки Шуши', color: 0x40916c, items: SKINS.slice(1).map((s) => s.id) },
  parcel: { kind: 'sticker', title: 'Марки', frame: 'stamp', color: 0x277da1, items: ['fox', 'owl', 'hedgehog', 'squirrel', 'deer', 'koala', 'kangaroo', 'penguin', 'panda', 'giraffe'] },
  galley: { kind: 'sticker', title: 'Блюда кока', frame: 'plate', color: 0xe9a23b, items: ['pancakes', 'pizza', 'cupcake', 'honey', 'sandwich', 'hotdog', 'popcorn', 'chocolate', 'cookie', 'icecream'] },
  jam: { kind: 'sticker', title: 'Транспорт гавани', frame: 'badge', color: 0x0077b6, items: ['sailboat', 'ship', 'helicopter', 'rocket', 'train', 'truck', 'tractor', 'scooter', 'motorcycle', 'parachute'] },
  machine: { kind: 'sticker', title: 'Игрушки Болтика', frame: 'card', color: 0xb5651d, items: ['robot', 'kite', 'drum', 'guitar', 'dice', 'skateboard', 'balloon', 'teddy', 'puzzle', 'trophy'] },
  cabins: { kind: 'sticker', title: 'Сундук команды', frame: 'card', color: 0x6a4c93, items: ['cap', 'crown', 'glasses', 'scarf', 'gloves', 'backpack', 'coat', 'dress', 'jeans', 'socks'] },
  logbook: { kind: 'sticker', title: 'Вещи из журнала', frame: 'stamp', color: 0x7a4a24, items: ['clock', 'key', 'bell', 'umbrella', 'book', 'pencil', 'bulb', 'phone', 'basket', 'hammer'] },
  anchor: { kind: 'sticker', title: 'Морские жители', frame: 'coin', color: 0x1b4965, items: ['fish', 'crab', 'octopus', 'whale', 'dolphin', 'shark', 'turtle', 'snail', 'duck', 'frog'] },
  mappuzzle: { kind: 'sticker', title: 'Чудеса карты', frame: 'badge', color: 0xa5683a, items: ['volcano', 'rainbow', 'mountain', 'palm', 'cactus', 'tornado', 'lightning', 'snowflake', 'planet', 'sunflower'] },
  shipyard: { kind: 'sticker', title: 'Груз для трюма', frame: 'coin', color: 0x219ebc, items: ['pineapple', 'coconut', 'mango', 'watermelon', 'kiwi', 'cherry', 'grapes', 'peach', 'lemon', 'blueberries'] },
  crew: { kind: 'sticker', title: 'Друзья команды', frame: 'plate', color: 0xe76f51, items: ['lion', 'tiger', 'elephant', 'monkey', 'zebra', 'camel', 'crocodile', 'wolf', 'bear', 'dinosaur'] },
};

/** Уровни игры для лесенки на экране итогов (0 — уровней нет). */
export const LEVELS: Record<string, number> = {
  snake: 0, logbook: 0, parcel: PARCEL, galley: GALLEY, jam: JAM, machine: MACHINE, cabins: CABINS, anchor: ANCHOR, mappuzzle: MAPPUZZLE, shipyard: SHIPYARD, crew: CREW, range: RANGE,
};

export const collectionOf = (game: string): Collection | undefined => COLLECTIONS[game];
export const prizeIds = (game: string): readonly string[] => COLLECTIONS[game]?.items ?? [];

/** Английские реплики коллекций, которых нет среди слов змейки. */
export function englishLines(): Record<string, string> {
  return Object.fromEntries(SKINS.map((s) => [skinLine(s.id), s.en]));
}

/** Звёзды за долю верных: 90 % и выше — три, 70 % — две, иначе одна. */
export const starsFor = (right: number, total: number): 1 | 2 | 3 => {
  const acc = total > 0 ? right / total : 0;
  return acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
};
