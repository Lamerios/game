import { carSvg } from './race/art';
import { CARS } from './race/logic';
import { YUNGA } from './inverse/art';

/**
 * Every game on the main menu. To add a game: add its scene to main.ts and one
 * entry below. The menu, the `#hash` links and the parent dashboard pick it up.
 */
export interface GameEntry {
  /** Stable id: analytics `game`, URL `#id`. Never rename once shipped (old logs use it). */
  id: string;
  /** Phaser scene key to start. */
  scene: string;
  /** Data passed to scene.start. */
  data?: object;
  title: string;
  /** One short line under the title. */
  subtitle: string;
  /** What it trains: shown as chips on the card and used to group stats. */
  skills: SkillTag[];
  /** Card colour. */
  color: number;
  /** Picture for the card: an existing texture key, or one to load from url / svg. */
  icon: { key: string; url?: string; svg?: string };
  /** Shows a "Новое!" ribbon until the child opens it once. */
  isNew?: boolean;
  /** Hidden from the menu (work in progress), still reachable by #id. */
  hidden?: boolean;
}

export type SkillTag = 'english' | 'reading' | 'math' | 'logic' | 'chess' | 'attention' | 'memory' | 'space' | 'movement';

export const SKILL_LABEL: Record<SkillTag, string> = {
  english: 'English',
  reading: 'Чтение',
  math: 'Счёт',
  logic: 'Логика',
  chess: 'Шахматы',
  attention: 'Внимание',
  memory: 'Память',
  space: 'Пространство',
  movement: 'Движение',
};

// Optional chaining: the registry is also read by node tools (tools/analyze.ts), where there is no Vite env.
const BASE: string = import.meta.env?.BASE_URL ?? './';

export const GAMES: GameEntry[] = [
  {
    id: 'voyage',
    scene: 'Harbor',
    title: 'Кругосветка',
    subtitle: 'Плавание с командой',
    skills: ['reading', 'math', 'logic', 'chess'],
    color: 0x1b4965,
    icon: { key: 'yacht-side' },
  },
  {
    id: 'snake',
    scene: 'Snake',
    title: 'Змейка Шуша',
    subtitle: 'Слова и числа',
    skills: ['english'],
    color: 0x40916c,
    icon: { key: 'menu-snake', url: `${BASE}snake/apple.webp` },
  },
  {
    id: 'parcel',
    scene: 'Parcel',
    title: 'Посылка',
    subtitle: 'Транспорт мира',
    skills: ['english', 'math'],
    color: 0x277da1,
    icon: { key: 'menu-parcel', url: `${BASE}parcel/package.webp` },
  },
  {
    id: 'race',
    scene: 'Race',
    title: 'Гонка слов',
    subtitle: 'Машины и приседания',
    skills: ['english', 'movement'],
    color: 0xe63946,
    icon: { key: 'menu-race', svg: carSvg(CARS[0]!) },
  },
  {
    id: 'inverse',
    scene: 'Inverse',
    title: 'Наоборот, юнга!',
    subtitle: 'Команды и флаги',
    skills: ['english', 'attention', 'movement'],
    color: 0x9b5de5,
    icon: { key: 'menu-inverse', svg: YUNGA },
    isNew: true,
  },
  {
    id: 'logbook',
    scene: 'Logbook',
    title: 'Судовой журнал',
    subtitle: 'Вспомни слова',
    skills: ['english', 'memory'],
    color: 0x7a4a24,
    icon: { key: 'crate' },
    isNew: true,
  },
  {
    id: 'anchor',
    scene: 'Anchor',
    title: 'Якорь',
    subtitle: 'Где это число?',
    skills: ['math', 'english'],
    color: 0x1b4965,
    icon: { key: 'yacht-side' },
    isNew: true,
  },
  {
    id: 'galley',
    scene: 'Galley',
    title: 'Камбуз',
    subtitle: 'Заказ кока и сортировка',
    skills: ['memory', 'attention', 'english'],
    color: 0xe9a23b,
    icon: { key: 'char-kettle' },
    isNew: true,
  },
  {
    id: 'mappuzzle',
    scene: 'MapPuzzle',
    title: 'Порванная карта',
    subtitle: 'Собери карту и плыви по компасу',
    skills: ['space', 'english'],
    color: 0xa5683a,
    icon: { key: 'yacht-top' },
    isNew: true,
  },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

/** `#snake` → the Snake entry. */
export const gameByHash = (hash: string) => gameById(hash.replace(/^#/, ''));
