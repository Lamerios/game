import { pick, shuffle, type Rng } from '../common/rng';

/**
 * «Истории команды»: feelings, stories and other minds.
 * - Emotion words in English, and reading feelings from situations
 *   (emotion knowledge at 5–6 predicts later social and school skills — Denham et al., 2003).
 * - Putting 3 pictures in order and retelling them to a parent (narrative skills
 *   build vocabulary and later reading — Griffin et al., 2004; dialogic talk — Whitehurst).
 * - A false-belief story (Wimmer & Perner, 1983): most children pass it between 4 and 5,
 *   talking about thoughts helps (Lohmann & Tomasello, 2003).
 */

export const EMOTIONS = ['happy', 'sad', 'angry', 'scared', 'surprised'] as const;
export type Emotion = (typeof EMOTIONS)[number];
export const MAX_LEVEL = 2;

/** Level 1: three basic feelings; level 2 adds scared and surprised. */
export const emotionsFor = (level: number): Emotion[] => (level >= 2 ? [...EMOTIONS] : ['happy', 'sad', 'angry']);

/** Situations with the feeling they cause; the Russian line is rumb.crew.sit.<id>. */
export const SITUATIONS: { id: string; emo: Emotion }[] = [
  { id: 'gift', emo: 'happy' },
  { id: 'cake', emo: 'happy' },
  { id: 'balloon', emo: 'sad' },
  { id: 'rain', emo: 'sad' },
  { id: 'icecream', emo: 'angry' },
  { id: 'tower', emo: 'angry' },
  { id: 'noise', emo: 'scared' },
  { id: 'octopus', emo: 'surprised' },
];

export type EmotionTrial = { kind: 'word'; emo: Emotion; options: Emotion[] } | { kind: 'situation'; sit: string; emo: Emotion; options: Emotion[] };

/** Two "Who is …?" trials (English only) and two situations; options always hold the answer. */
export function planEmotions(level: number, rng: Rng): EmotionTrial[] {
  const pool = emotionsFor(level);
  const opts = (emo: Emotion) => shuffle(rng, [emo, ...shuffle(rng, pool.filter((e) => e !== emo)).slice(0, 2)]);
  const words = shuffle(rng, pool).slice(0, 2).map((emo): EmotionTrial => ({ kind: 'word', emo, options: opts(emo) }));
  const sits = shuffle(rng, SITUATIONS.filter((s) => pool.includes(s.emo)))
    .slice(0, 2)
    .map((s): EmotionTrial => ({ kind: 'situation', sit: s.id, emo: s.emo, options: opts(s.emo) }));
  return [words[0]!, sits[0]!, words[1]!, sits[1]!];
}

export const STORIES = ['seed', 'tea', 'cargo', 'storm'] as const;
export type Story = (typeof STORIES)[number];

/** The frames shown in a shuffled order that is never already right. */
export function shuffledFrames(rng: Rng, n = 3): number[] {
  for (;;) {
    const s = shuffle(rng, Array.from({ length: n }, (_, i) => i));
    if (s.some((v, i) => v !== i)) return s;
  }
}

export const pickStory = (rng: Rng, last?: string): Story => pick(rng, STORIES.filter((s) => s !== last));

export type Chest = 'red' | 'blue';
export const other = (c: Chest): Chest => (c === 'red' ? 'blue' : 'red');

/** Scores the false-belief task: belief question and the reality control question. */
export function scoreTom(hidIn: Chest, belief: Chest, reality: Chest) {
  return { belief: belief === hidIn, reality: reality === other(hidIn) };
}
