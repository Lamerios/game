import { carSvg } from './race/art';
import { CARS } from './race/logic';

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

const BASE = import.meta.env.BASE_URL;

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
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

/** `#snake` → the Snake entry. */
export const gameByHash = (hash: string) => gameById(hash.replace(/^#/, ''));
