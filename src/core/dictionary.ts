import content from '../../content/phrases.json';
import { unstress } from './phrases';

/**
 * The shared English dictionary: every word with a picture that any game can
 * ask about (Snake, Race, Galley, Logbook, parent statistics…).
 *
 * A word is one id used everywhere: the picture public/snake/<id>.webp
 * (colours and numbers are drawn), the clip en.<id> and its text in
 * content/phrases.json "english.words", and the key in the word statistics.
 * To add a word: an entry here, a line in english.words, and a 192×192 webp.
 *
 * Each word has a theme (`cat`) and a difficulty `level`:
 *   1 — first words: short, everyday, easy to show (cat, sun, red, five);
 *   2 — ordinary words a child meets in picture books;
 *   3 — long, rare or easy to mix up (helicopter, jellyfish, thermometer).
 * Games meet level-1 words first; see `byLevel`, `upToLevel`, `levelForStage`.
 */

export type Category =
  | 'fruit' | 'vegetable' | 'animal' | 'thing' | 'food' | 'transport' | 'home' | 'clothes' | 'toy' | 'nature' | 'body'
  | 'sea' | 'travel' | 'craft' | 'space' | 'sport'
  | 'color' | 'number';
export type Level = 1 | 2 | 3;
export interface Word {
  /** Also the picture (public/snake/<id>.webp; numbers are drawn) and the clip (en.<id>). Numbers are n0…n100. */
  id: string;
  ru: string;
  cat: Category;
  /** Difficulty, 1 (first words) … 3 (hard). */
  level: Level;
}
type Entry = Omit<Word, 'level'>;

/** First words: met before anything else. */
const BASIC = new Set([
  'apple', 'banana', 'orange', 'cat', 'dog', 'fish', 'bird', 'cow', 'pig', 'duck', 'frog', 'bear', 'lion', 'horse',
  'sun', 'star', 'ball', 'car', 'house', 'tree', 'boat', 'egg', 'cake', 'milk', 'bus', 'train', 'plane', 'ship',
  'book', 'bed', 'door', 'key', 'hand', 'eye', 'nose', 'ear', 'mouth', 'moon', 'hat', 'cup', 'flower', 'mouse',
  'anchor', 'map', 'box', 'water', 'pizza', 'chair', 'c-red', 'c-blue', 'c-green', 'c-yellow',
]);

/** Hard words: long, rare, or easy to confuse with a neighbour. */
const HARD = new Set([
  'strawberry', 'watermelon', 'cucumber', 'broccoli', 'pepper', 'eggplant', 'blueberries', 'pineapple', 'coconut',
  'kangaroo', 'crocodile', 'hedgehog', 'butterfly', 'octopus', 'dolphin', 'giraffe', 'penguin', 'squirrel', 'ladybug',
  'dinosaur', 'camel', 'helicopter', 'motorcycle', 'ambulance', 'policecar', 'fireengine', 'parachute', 'volcano',
  'tornado', 'lightning', 'sunflower', 'skateboard', 'scissors', 'computer', 'toothbrush', 'umbrella', 'backpack',
  'sandwich', 'chocolate', 'pancakes', 'popcorn', 'lollipop', 'bulb', 'glasses',
  'telescope', 'compass', 'pirateflag', 'fishingrod', 'jellyfish', 'lobster', 'squid', 'shrimp', 'coral', 'swords',
  'suitcase', 'thermometer', 'screwdriver', 'flashlight', 'satellite', 'comet', 'basketball', 'medal', 'peacock',
  'gorilla', 'hippo', 'rhino', 'sloth', 'otter', 'beaver', 'lizard', 'raccoon', 'skunk', 'polarbear', 'croissant',
  'pretzel', 'avocado', 'peanuts', 'garlic', 'noodles', 'waffle', 'mirror', 'battery', 'notebook', 'crayon', 'ruler',
  'shower', 'swimsuit', 'tongue', 'brain', 'trumpet', 'violin', 'wand', 'trafficlight', 'desert', 'nest', 'feather',
  'speedboat', 'ferry', 'canoe', 'saw', 'wrench', 'flamingo', 'beetle',
]);

/** For tests: both lists must name real words. */
export const LEVEL_LISTS = { basic: BASIC, hard: HARD };

const withLevel = (w: Entry): Word => ({ ...w, level: BASIC.has(w.id) ? 1 : HARD.has(w.id) ? 3 : 2 });

const PICTURE_ENTRIES: readonly Entry[] = [
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
  // More words (race, 2026-11-21)
  { id: 'kiwi', ru: 'киви', cat: 'fruit' },
  { id: 'coconut', ru: 'кокос', cat: 'fruit' },
  { id: 'mango', ru: 'манго', cat: 'fruit' },
  { id: 'blueberries', ru: 'черника', cat: 'fruit' },
  { id: 'mushroom', ru: 'гриб', cat: 'vegetable' },
  { id: 'eggplant', ru: 'баклажан', cat: 'vegetable' },
  { id: 'panda', ru: 'панда', cat: 'animal' },
  { id: 'koala', ru: 'коала', cat: 'animal' },
  { id: 'squirrel', ru: 'белка', cat: 'animal' },
  { id: 'deer', ru: 'олень', cat: 'animal' },
  { id: 'unicorn', ru: 'единорог', cat: 'animal' },
  { id: 'ladybug', ru: 'божья коровка', cat: 'animal' },
  { id: 'bat', ru: 'летучая мышь', cat: 'animal' },
  { id: 'dinosaur', ru: 'динозавр', cat: 'animal' },
  { id: 'burger', ru: 'бургер', cat: 'food' },
  { id: 'fries', ru: 'картошка фри', cat: 'food' },
  { id: 'hotdog', ru: 'хот-дог', cat: 'food' },
  { id: 'donut', ru: 'пончик', cat: 'food' },
  { id: 'cupcake', ru: 'кекс', cat: 'food' },
  { id: 'lollipop', ru: 'леденец', cat: 'food' },
  { id: 'popcorn', ru: 'попкорн', cat: 'food' },
  { id: 'pancakes', ru: 'блинчики', cat: 'food' },
  { id: 'honey', ru: 'мёд', cat: 'food' },
  { id: 'taxi', ru: 'такси', cat: 'transport' },
  { id: 'ambulance', ru: 'скорая помощь', cat: 'transport' },
  { id: 'policecar', ru: 'полицейская машина', cat: 'transport' },
  { id: 'fireengine', ru: 'пожарная машина', cat: 'transport' },
  { id: 'motorcycle', ru: 'мотоцикл', cat: 'transport' },
  { id: 'scooter', ru: 'самокат', cat: 'transport' },
  { id: 'tractor', ru: 'трактор', cat: 'transport' },
  { id: 'sailboat', ru: 'парусник', cat: 'transport' },
  { id: 'parachute', ru: 'парашют', cat: 'transport' },
  { id: 'volcano', ru: 'вулкан', cat: 'nature' },
  { id: 'tornado', ru: 'торнадо', cat: 'nature' },
  { id: 'lightning', ru: 'молния', cat: 'nature' },
  { id: 'wave', ru: 'волна', cat: 'nature' },
  { id: 'sunflower', ru: 'подсолнух', cat: 'nature' },
  { id: 'tulip', ru: 'тюльпан', cat: 'nature' },
  { id: 'cactus', ru: 'кактус', cat: 'nature' },
  { id: 'palm', ru: 'пальма', cat: 'nature' },
  { id: 'planet', ru: 'планета', cat: 'nature' },
  { id: 'robot', ru: 'робот', cat: 'toy' },
  { id: 'puzzle', ru: 'пазл', cat: 'toy' },
  { id: 'trophy', ru: 'кубок', cat: 'toy' },
  { id: 'dice', ru: 'кубик', cat: 'toy' },
  { id: 'skateboard', ru: 'скейтборд', cat: 'toy' },
  { id: 'gloves', ru: 'перчатки', cat: 'clothes' },
  { id: 'scarf', ru: 'шарф', cat: 'clothes' },
  { id: 'jeans', ru: 'джинсы', cat: 'clothes' },
  { id: 'coat', ru: 'пальто', cat: 'clothes' },
  { id: 'bulb', ru: 'лампочка', cat: 'home' },
  { id: 'spoon', ru: 'ложка', cat: 'home' },
  { id: 'scissors', ru: 'ножницы', cat: 'home' },
  { id: 'phone', ru: 'телефон', cat: 'home' },
  { id: 'computer', ru: 'компьютер', cat: 'home' },
  { id: 'tv', ru: 'телевизор', cat: 'home' },
  { id: 'toothbrush', ru: 'зубная щётка', cat: 'home' },
  { id: 'bell', ru: 'колокольчик', cat: 'home' },
  { id: 'basket', ru: 'корзинка', cat: 'home' },
  { id: 'hammer', ru: 'молоток', cat: 'home' },
  // More words: the child's themes (2026-11-25)
  // Sea and pirates
  { id: 'anchor', ru: 'якорь', cat: 'sea' },
  { id: 'compass', ru: 'компас', cat: 'sea' },
  { id: 'map', ru: 'карта', cat: 'sea' },
  { id: 'island', ru: 'остров', cat: 'sea' },
  { id: 'pirateflag', ru: 'пиратский флаг', cat: 'sea' },
  { id: 'shell', ru: 'ракушка', cat: 'sea' },
  { id: 'coin', ru: 'монета', cat: 'sea' },
  { id: 'diamond', ru: 'алмаз', cat: 'sea' },
  { id: 'telescope', ru: 'телескоп', cat: 'sea' },
  { id: 'canoe', ru: 'каноэ', cat: 'sea' },
  { id: 'beach', ru: 'пляж', cat: 'sea' },
  { id: 'rope', ru: 'верёвка', cat: 'sea' },
  { id: 'coral', ru: 'коралл', cat: 'sea' },
  { id: 'fishingrod', ru: 'удочка', cat: 'sea' },
  { id: 'swords', ru: 'сабли', cat: 'sea' },
  // Travel
  { id: 'globe', ru: 'глобус', cat: 'travel' },
  { id: 'suitcase', ru: 'чемодан', cat: 'travel' },
  { id: 'ticket', ru: 'билет', cat: 'travel' },
  { id: 'tent', ru: 'палатка', cat: 'travel' },
  { id: 'camera', ru: 'фотоаппарат', cat: 'travel' },
  { id: 'castle', ru: 'замок', cat: 'travel' },
  { id: 'hotel', ru: 'гостиница', cat: 'travel' },
  // Workshop: tools and blocks
  { id: 'pickaxe', ru: 'кирка', cat: 'craft' },
  { id: 'axe', ru: 'топор', cat: 'craft' },
  { id: 'brick', ru: 'кирпич', cat: 'craft' },
  { id: 'shield', ru: 'щит', cat: 'craft' },
  { id: 'bow', ru: 'лук со стрелой', cat: 'craft' },
  { id: 'wood', ru: 'дрова', cat: 'craft' },
  { id: 'rock', ru: 'камень', cat: 'craft' },
  { id: 'saw', ru: 'пила', cat: 'craft' },
  { id: 'wrench', ru: 'гаечный ключ', cat: 'craft' },
  { id: 'screwdriver', ru: 'отвёртка', cat: 'craft' },
  { id: 'ladder', ru: 'лестница', cat: 'craft' },
  { id: 'bucket', ru: 'ведро', cat: 'craft' },
  { id: 'lock', ru: 'замочек', cat: 'craft' },
  { id: 'magnet', ru: 'магнит', cat: 'craft' },
  { id: 'box', ru: 'коробка', cat: 'craft' },
  { id: 'candle', ru: 'свеча', cat: 'craft' },
  { id: 'bomb', ru: 'бомба', cat: 'craft' },
  { id: 'flashlight', ru: 'фонарик', cat: 'craft' },
  // Space
  { id: 'alien', ru: 'инопланетянин', cat: 'space' },
  { id: 'ufo', ru: 'летающая тарелка', cat: 'space' },
  { id: 'comet', ru: 'комета', cat: 'space' },
  { id: 'satellite', ru: 'спутник', cat: 'space' },
  // Sport
  { id: 'basketball', ru: 'баскетбольный мяч', cat: 'sport' },
  { id: 'football', ru: 'футбольный мяч', cat: 'sport' },
  { id: 'tennis', ru: 'теннис', cat: 'sport' },
  { id: 'medal', ru: 'медаль', cat: 'sport' },
  { id: 'skis', ru: 'лыжи', cat: 'sport' },
  { id: 'skates', ru: 'коньки', cat: 'sport' },
  { id: 'sled', ru: 'санки', cat: 'sport' },
  { id: 'goal', ru: 'ворота', cat: 'sport' },
  // Animals
  { id: 'seal', ru: 'тюлень', cat: 'animal' },
  { id: 'jellyfish', ru: 'медуза', cat: 'animal' },
  { id: 'lobster', ru: 'омар', cat: 'animal' },
  { id: 'squid', ru: 'кальмар', cat: 'animal' },
  { id: 'shrimp', ru: 'креветка', cat: 'animal' },
  { id: 'eagle', ru: 'орёл', cat: 'animal' },
  { id: 'swan', ru: 'лебедь', cat: 'animal' },
  { id: 'flamingo', ru: 'фламинго', cat: 'animal' },
  { id: 'peacock', ru: 'павлин', cat: 'animal' },
  { id: 'gorilla', ru: 'горилла', cat: 'animal' },
  { id: 'hippo', ru: 'бегемот', cat: 'animal' },
  { id: 'rhino', ru: 'носорог', cat: 'animal' },
  { id: 'llama', ru: 'лама', cat: 'animal' },
  { id: 'sloth', ru: 'ленивец', cat: 'animal' },
  { id: 'otter', ru: 'выдра', cat: 'animal' },
  { id: 'beaver', ru: 'бобр', cat: 'animal' },
  { id: 'worm', ru: 'червяк', cat: 'animal' },
  { id: 'lizard', ru: 'ящерица', cat: 'animal' },
  { id: 'raccoon', ru: 'енот', cat: 'animal' },
  { id: 'skunk', ru: 'скунс', cat: 'animal' },
  { id: 'chick', ru: 'цыплёнок', cat: 'animal' },
  { id: 'dragon', ru: 'дракон', cat: 'animal' },
  { id: 'polarbear', ru: 'белый медведь', cat: 'animal' },
  { id: 'hamster', ru: 'хомяк', cat: 'animal' },
  { id: 'goose', ru: 'гусь', cat: 'animal' },
  { id: 'beetle', ru: 'жук', cat: 'animal' },
  // Food
  { id: 'rice', ru: 'рис', cat: 'food' },
  { id: 'soup', ru: 'суп', cat: 'food' },
  { id: 'salad', ru: 'салат', cat: 'food' },
  { id: 'juice', ru: 'сок', cat: 'food' },
  { id: 'water', ru: 'вода', cat: 'food' },
  { id: 'pie', ru: 'пирог', cat: 'food' },
  { id: 'meat', ru: 'мясо', cat: 'food' },
  { id: 'butter', ru: 'масло', cat: 'food' },
  { id: 'salt', ru: 'соль', cat: 'food' },
  { id: 'waffle', ru: 'вафля', cat: 'food' },
  { id: 'croissant', ru: 'круассан', cat: 'food' },
  { id: 'peanuts', ru: 'арахис', cat: 'food' },
  { id: 'pretzel', ru: 'крендель', cat: 'food' },
  { id: 'noodles', ru: 'лапша', cat: 'food' },
  // Fruit
  { id: 'avocado', ru: 'авокадо', cat: 'fruit' },
  { id: 'melon', ru: 'дыня', cat: 'fruit' },
  // Vegetables
  { id: 'garlic', ru: 'чеснок', cat: 'vegetable' },
  // Home and school
  { id: 'cup', ru: 'чашка', cat: 'home' },
  { id: 'fork', ru: 'вилка', cat: 'home' },
  { id: 'knife', ru: 'нож', cat: 'home' },
  { id: 'bath', ru: 'ванна', cat: 'home' },
  { id: 'shower', ru: 'душ', cat: 'home' },
  { id: 'soap', ru: 'мыло', cat: 'home' },
  { id: 'window', ru: 'окно', cat: 'home' },
  { id: 'sofa', ru: 'диван', cat: 'home' },
  { id: 'mirror', ru: 'зеркало', cat: 'home' },
  { id: 'broom', ru: 'метла', cat: 'home' },
  { id: 'toilet', ru: 'унитаз', cat: 'home' },
  { id: 'teapot', ru: 'чайник', cat: 'home' },
  { id: 'pen', ru: 'ручка', cat: 'home' },
  { id: 'crayon', ru: 'мелок', cat: 'home' },
  { id: 'ruler', ru: 'линейка', cat: 'home' },
  { id: 'notebook', ru: 'тетрадь', cat: 'home' },
  { id: 'letter', ru: 'письмо', cat: 'home' },
  { id: 'battery', ru: 'батарейка', cat: 'home' },
  { id: 'radio', ru: 'радио', cat: 'home' },
  { id: 'thermometer', ru: 'градусник', cat: 'home' },
  // Clothes
  { id: 'bag', ru: 'сумка', cat: 'clothes' },
  { id: 'hat', ru: 'шляпа', cat: 'clothes' },
  { id: 'boots', ru: 'ботинки', cat: 'clothes' },
  { id: 'shorts', ru: 'шорты', cat: 'clothes' },
  { id: 'ring', ru: 'кольцо', cat: 'clothes' },
  { id: 'watch', ru: 'наручные часы', cat: 'clothes' },
  { id: 'swimsuit', ru: 'купальник', cat: 'clothes' },
  // Body
  { id: 'foot', ru: 'ступня', cat: 'body' },
  { id: 'leg', ru: 'нога', cat: 'body' },
  { id: 'tongue', ru: 'язык', cat: 'body' },
  { id: 'brain', ru: 'мозг', cat: 'body' },
  { id: 'heart', ru: 'сердце', cat: 'body' },
  { id: 'bone', ru: 'кость', cat: 'body' },
  // Toys and music
  { id: 'pawn', ru: 'пешка', cat: 'toy' },
  { id: 'piano', ru: 'пианино', cat: 'toy' },
  { id: 'trumpet', ru: 'труба', cat: 'toy' },
  { id: 'violin', ru: 'скрипка', cat: 'toy' },
  { id: 'yoyo', ru: 'йо-йо', cat: 'toy' },
  { id: 'doll', ru: 'матрёшка', cat: 'toy' },
  { id: 'wand', ru: 'волшебная палочка', cat: 'toy' },
  { id: 'paints', ru: 'краски', cat: 'toy' },
  // Transport
  { id: 'speedboat', ru: 'катер', cat: 'transport' },
  { id: 'ferry', ru: 'паром', cat: 'transport' },
  { id: 'racecar', ru: 'гоночная машина', cat: 'transport' },
  { id: 'tram', ru: 'трамвай', cat: 'transport' },
  { id: 'van', ru: 'фургон', cat: 'transport' },
  { id: 'wheel', ru: 'колесо', cat: 'transport' },
  { id: 'trafficlight', ru: 'светофор', cat: 'transport' },
  // Nature and weather
  { id: 'rain', ru: 'дождь', cat: 'nature' },
  { id: 'wind', ru: 'ветер', cat: 'nature' },
  { id: 'rose', ru: 'роза', cat: 'nature' },
  { id: 'feather', ru: 'перо', cat: 'nature' },
  { id: 'nest', ru: 'гнездо', cat: 'nature' },
  { id: 'firtree', ru: 'ёлка', cat: 'nature' },
  { id: 'desert', ru: 'пустыня', cat: 'nature' },
];

export const PICTURES: readonly Word[] = PICTURE_ENTRIES.map(withLevel);

/** Colours: drawn paint blobs; id c-<name> (so the colour orange is not the fruit). */
const COLOR_ENTRIES: readonly (Entry & { paint: string })[] = [
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
  { id: 'c-gray', ru: 'серый', cat: 'color', paint: '#8d99ae' },
];
export const COLORS: readonly (Word & { paint: string })[] = COLOR_ENTRIES.map((c) => ({ ...c, level: withLevel(c).level }));

/** English numbers: 0–20, then the tens up to 100. 0–10 are first words, the tens are hard (thirty / thirteen). */
export const NUMBER_VALUES: readonly number[] = [...Array.from({ length: 21 }, (_, i) => i), 30, 40, 50, 60, 70, 80, 90, 100];
export const numberId = (n: number) => `n${n}`;
export const numberOf = (id: string) => (/^n\d+$/.test(id) ? Number(id.slice(1)) : undefined);
export const NUMBERS: readonly Word[] = NUMBER_VALUES.map((n) => ({
  id: numberId(n),
  ru: unstress(content.numbers.nom[n]!),
  cat: 'number',
  level: n <= 10 ? 1 : n <= 20 ? 2 : 3,
}));

export const WORDS: readonly Word[] = [...PICTURES, ...COLORS, ...NUMBERS];

const BY_ID = new Map(WORDS.map((w) => [w.id, w]));
export const wordById = (id: string) => BY_ID.get(id)!;
/** The word's level; ids outside the dictionary (phrases, cells) count as 2. */
export const levelOf = (id: string): Level => BY_ID.get(id)?.level ?? 2;

/** The pool from easy to hard, keeping the order inside a level. */
export const byLevel = <T extends Word>(pool: readonly T[]): T[] =>
  pool.map((w, i) => ({ w, i })).sort((a, b) => a.w.level - b.w.level || a.i - b.i).map((x) => x.w);

/** Only words up to this level. */
export const upToLevel = <T extends Word>(pool: readonly T[], max: Level): T[] => pool.filter((w) => w.level <= max);

/**
 * For games with smart levels (src/core/smartLevel.ts, usually 1…5): the
 * hardest word level to ask on that stage. Stages 1–2 ask first words, 3–4
 * add ordinary ones, 5 and up everything.
 */
export const levelForStage = (stage: number): Level => (stage <= 2 ? 1 : stage <= 4 ? 2 : 3);

// ---------- themes ----------

/**
 * Word sets on the child's interests, for games that want a topic ("words of
 * the sea" for a sailing game). A theme takes whole categories plus single
 * words from other ones.
 */
export interface Theme {
  ru: string;
  cats: readonly Category[];
  ids: readonly string[];
}
export const THEMES = {
  sea: {
    ru: 'Море и пираты',
    cats: ['sea'],
    ids: ['fish', 'crab', 'octopus', 'whale', 'dolphin', 'shark', 'seal', 'jellyfish', 'lobster', 'squid', 'shrimp', 'turtle',
      'parrot', 'ship', 'boat', 'sailboat', 'speedboat', 'ferry', 'wave', 'palm', 'swimsuit'],
  },
  travel: {
    ru: 'Кругосветка',
    cats: ['travel'],
    ids: ['plane', 'train', 'bus', 'taxi', 'ship', 'sailboat', 'car', 'bicycle', 'map', 'compass', 'island', 'mountain', 'palm',
      'camel', 'kangaroo', 'panda', 'koala', 'desert', 'volcano', 'snowman'],
  },
  craft: {
    ru: 'Мастерская',
    cats: ['craft'],
    ids: ['hammer', 'key', 'diamond', 'swords', 'coin', 'pig', 'cow', 'sheep', 'chicken', 'wolf', 'spider', 'bat', 'tree',
      'fire', 'mushroom'],
  },
  space: { ru: 'Космос', cats: ['space'], ids: ['rocket', 'planet', 'moon', 'star', 'sun', 'telescope', 'robot', 'globe'] },
  sport: { ru: 'Спорт', cats: ['sport'], ids: ['ball', 'bicycle', 'skateboard', 'scooter', 'trophy', 'kite', 'racecar'] },
  road: { ru: 'Дорога и гонки', cats: ['transport'], ids: ['trophy', 'medal'] },
  animals: { ru: 'Животные', cats: ['animal'], ids: [] },
  food: { ru: 'Еда', cats: ['food', 'fruit', 'vegetable'], ids: [] },
  home: { ru: 'Дом и одежда', cats: ['home', 'clothes', 'body', 'toy'], ids: [] },
} satisfies Record<string, Theme>;
export type ThemeId = keyof typeof THEMES;

/** The words of a theme, easy ones first. */
export function themeWords(theme: ThemeId): Word[] {
  const t: Theme = THEMES[theme];
  const ids = new Set(t.ids);
  return byLevel(PICTURES.filter((w) => t.cats.includes(w.cat) || ids.has(w.id)));
}
