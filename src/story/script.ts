import content from '../../content/phrases.json';
import type { PhraseId } from '../core/phrases';
import type { SkillId } from '../core/types';

/**
 * Season "Atlantic" (scenario v0.2): 5 islands, two sessions ("episodes") each.
 * The route's islandIndex counts finished episodes.
 */
export const EPISODES = 10;
export const ISLANDS = 5;

export const ISLAND_NAMES = ['Бутылочная бухта', 'Бочкин причал', 'Туманные рифы', 'Форт Ладья', 'Чернильный остров'];

/** Main skill of each island: it gets the "star" task. The last island mixes everything. */
export const ISLAND_FOCUS: (SkillId | undefined)[] = ['reading', 'math', undefined, 'chess', undefined];

/** Letters of the secret word, one per island 1–4, in the order they are found. */
export const LETTERS = ['Г', 'Р', 'У', 'Д'];
export const SECRET_WORD = 'ДРУГ';

export const islandOf = (episode: number) => Math.min(ISLANDS - 1, Math.floor(episode / 2));

/** Parts of Strelka found after `episodesDone` finished episodes (a part per island, on its 2nd episode). */
export const strelkaParts = (episodesDone: number) => Math.min(4, Math.floor(episodesDone / 2));

const IDS = Object.keys(content.phrases) as PhraseId[];

/** Lines "<speaker>.<kind>.<n>[a-z]" in order of the letter suffix. */
function lines(kind: string, n: number): PhraseId[] {
  const re = new RegExp(`^\\w+\\.${kind}\\.${n}([a-z]?)$`);
  return IDS.filter((id) => re.test(id)).sort((a, b) => (a.match(re)![1]! < b.match(re)![1]! ? -1 : 1));
}

export const INTRO: PhraseId[] = IDS.filter((id) => /\.intro\.\d+$/.test(id) || id === 'beard.letter').sort(
  (a, b) => order(a) - order(b),
);
function order(id: string) {
  if (id === 'beard.letter') return 4.5;
  return Number(id.split('.').pop());
}

export const arrival = (episode: number) => lines('arrive', Math.min(episode, EPISODES - 1));
/** What is found at the end of the episode; empty on an island's first episode. */
export const finds = (episode: number) => lines('find', episode);
export const evening = (episode: number) => `kettle.evening.${Math.min(episode, EPISODES - 1)}` as PhraseId;
