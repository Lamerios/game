import content from '../../content/phrases.json';

/**
 * Spoken lines (SDD 6). Every phrase lives in content/phrases.json with stress
 * marks; a phrase with slots is cut into clips at the slots, so
 * "Загрузи в трюм ровно {n}." becomes clip `hold.load.0` + clip `num.nom.7` + …
 * tools/tts.ts pre-generates one mp3 per clip; core/audio.ts plays them in a row.
 * Pure TS: shared by the game and the generator script.
 */

/** One clip. `say` is what goes to TTS ('' = nothing to voice, e.g. a lone "."). */
export interface Seg {
  id: string;
  show: string;
  say: string;
  /** false when no clip can exist for it (number out of range); forces the browser voice. */
  voiced: boolean;
}

export interface Utterance {
  /** Text for the speech bubble. */
  show: string;
  segs: Seg[];
}

export type PhraseId = keyof typeof content.phrases;
export type Params = Record<string, number | string>;

const PHRASES: Record<string, string> = content.phrases;
const NUMBERS: Record<'nom' | 'gen', string[]> = content.numbers;
const STRESS: Record<string, string> = content.stress;

const SLOT = /\{(\w+)(?::(gen|text))?\}/g;
const HAS_LETTER = /[\p{L}\p{N}]/u;
const WORD = /[а-яё]+/g;

export const unstress = (s: string) => s.replace(/\+/g, '');

/** FNV-1a, base36: a stable id for free text that both the game and the script compute. */
export function textId(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `t.${(h >>> 0).toString(36)}`;
}

/** Free text (e.g. what is written in the note) → TTS input with stress from the dictionary. */
export function stressText(text: string): string {
  return text.toLowerCase().replace(WORD, (w) => STRESS[w] ?? w);
}

function staticSeg(id: string, piece: string): Seg {
  const say = HAS_LETTER.test(piece) ? piece.trim() : '';
  return { id, show: unstress(piece), say, voiced: true };
}

export function numberSeg(n: number, grammaticalCase: 'nom' | 'gen' = 'nom'): Seg {
  const word = NUMBERS[grammaticalCase][n];
  return {
    id: `num.${grammaticalCase}.${n}`,
    show: String(n),
    say: word ?? String(n),
    voiced: word !== undefined && Number.isInteger(n),
  };
}

export function textSeg(text: string): Seg {
  return { id: textId(text), show: text, say: stressText(text), voiced: true };
}

/** Builds the utterance for a phrase from phrases.json. */
export function phrase(id: PhraseId, params: Params = {}): Utterance {
  const tpl = PHRASES[id];
  if (tpl === undefined) throw new Error(`Unknown phrase ${id}`);
  const segs: Seg[] = [];
  const hasSlots = tpl.search(SLOT) >= 0;
  let last = 0;
  let piece = 0;
  for (const m of tpl.matchAll(SLOT)) {
    if (m.index > last) segs.push(staticSeg(`${id}.${piece}`, tpl.slice(last, m.index)));
    piece++;
    const [, name, kind] = m;
    const v = params[name!];
    if (v === undefined) throw new Error(`Phrase ${id}: missing {${name}}`);
    segs.push(kind === 'text' ? textSeg(String(v)) : numberSeg(Number(v), kind === 'gen' ? 'gen' : 'nom'));
    last = m.index + m[0].length;
  }
  if (last < tpl.length) segs.push(staticSeg(hasSlots ? `${id}.${piece}` : id, tpl.slice(last)));
  return { show: segs.map((s) => s.show).join(''), segs };
}

/** Any string, e.g. from a scene not moved to phrases.json yet: one clip keyed by its text. */
export function free(text: string): Utterance {
  return { show: text, segs: [textSeg(text)] };
}

/** Text for the browser voice: words for numbers, no stress marks. */
export function webText(u: Utterance): string {
  return u.segs.map((s) => (s.voiced ? unstress(s.say) || s.show : s.show)).join(' ').replace(/\s+/g, ' ').replace(/ ([.,!?:])/g, '$1').trim();
}

/** All clips the game can ask for: id → TTS text. `texts` are the possible free texts. */
export function allClips(texts: Iterable<string>): Map<string, string> {
  const out = new Map<string, string>();
  const add = (s: Seg) => {
    if (s.say && s.voiced) out.set(s.id, s.say);
  };
  for (const id of Object.keys(PHRASES)) {
    const tpl = PHRASES[id]!;
    // Static pieces only: fill slots with anything, then drop the slot clips.
    const dummy: Params = {};
    for (const m of tpl.matchAll(SLOT)) dummy[m[1]!] = m[2] === 'text' ? '' : 0;
    phrase(id as PhraseId, dummy).segs.filter((s) => s.id === id || s.id.startsWith(`${id}.`)).forEach(add);
  }
  for (const c of ['nom', 'gen'] as const) NUMBERS[c].forEach((_, n) => add(numberSeg(n, c)));
  for (const t of texts) add(textSeg(t));
  return out;
}

export const PRAISE_COUNT = Object.keys(PHRASES).filter((k) => k.startsWith('praise.')).length;
