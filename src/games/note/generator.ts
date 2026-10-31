import { pick, shuffle, type Rng } from '../common/rng';
import { adjDat, KINDS, type Color, type Kind, type Size } from './vocab';

export const NOTE_MAX_LEVEL = 5;
export const NOTE_SLOTS = 6;

export interface NoteObject {
  id: string;
  kind: string;
  size?: Size;
  color?: Color;
}

export interface NoteTask {
  level: number;
  /** What is written in the note. The child reads it; it is not voiced unless they ask for help. */
  text: string;
  /** Object ids to tap, in order. */
  targets: string[];
  objects: NoteObject[];
  itemId: string;
}

const upper = (s: string) => s.toUpperCase();
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

function other<T>(rng: Rng, all: readonly T[], not: T): T {
  return pick(rng, all.filter((v) => v !== not));
}

function pair(rng: Rng, kind: Kind): [NoteObject, NoteObject] {
  if (kind.attr === 'size') {
    return [
      { id: `${kind.id}-big`, kind: kind.id, size: 'big' },
      { id: `${kind.id}-small`, kind: kind.id, size: 'small' },
    ];
  }
  const c1 = pick(rng, ['red', 'blue', 'green'] as const);
  const c2 = other(rng, ['red', 'blue', 'green'] as const, c1);
  return [
    { id: `${kind.id}-${c1}`, kind: kind.id, color: c1 },
    { id: `${kind.id}-${c2}`, kind: kind.id, color: c2 },
  ];
}

const attrOf = (o: NoteObject) => (o.size ?? o.color)!;

/** Fills the remaining slots with single objects of other kinds. */
function fill(rng: Rng, used: NoteObject[], exclude: Set<string>): NoteObject[] {
  const free = shuffle(rng, KINDS.filter((k) => !exclude.has(k.id)));
  const extra = free.slice(0, NOTE_SLOTS - used.length).map((k) => ({ id: k.id, kind: k.id }));
  return shuffle(rng, [...used, ...extra]);
}

export function generateNote(level: number, rng: Rng): NoteTask {
  const lvl = Math.min(NOTE_MAX_LEVEL, Math.max(1, level));
  switch (lvl) {
    case 1: {
      // One short word in capitals.
      const kind = pick(rng, KINDS.filter((k) => k.nom.length <= 5));
      const objects = fill(rng, [{ id: kind.id, kind: kind.id }], new Set([kind.id]));
      return { level: 1, text: upper(kind.nom), targets: [kind.id], objects, itemId: `note1-${kind.id}` };
    }
    case 2: {
      const kind = pick(rng, KINDS);
      const objects = fill(rng, [{ id: kind.id, kind: kind.id }], new Set([kind.id]));
      return { level: 2, text: upper(`иди к ${kind.dat}`), targets: [kind.id], objects, itemId: `note2-${kind.id}` };
    }
    case 3: {
      // Same kind twice, told apart by an attribute.
      const kind = pick(rng, KINDS);
      const [a, b] = pair(rng, kind);
      const target = rng() < 0.5 ? a : b;
      const objects = fill(rng, [a, b], new Set([kind.id]));
      const text = cap(`иди к ${adjDat(attrOf(target), kind.gender)} ${kind.dat}.`);
      return { level: 3, text, targets: [target.id], objects, itemId: `note3-${target.id}` };
    }
    case 4: {
      // Two actions in order.
      const [k1, k2] = shuffle(rng, KINDS).slice(0, 2) as [Kind, Kind];
      const objects = fill(rng, [{ id: k1.id, kind: k1.id }, { id: k2.id, kind: k2.id }], new Set([k1.id, k2.id]));
      const text = cap(`сначала иди к ${k1.dat}, потом к ${k2.dat}.`);
      return { level: 4, text, targets: [k1.id, k2.id], objects, itemId: `note4-${k1.id}-${k2.id}` };
    }
    default: {
      // Negation: two of a kind, go to the one that is NOT named.
      const kind = pick(rng, KINDS);
      const [a, b] = pair(rng, kind);
      const [named, target] = rng() < 0.5 ? [a, b] : [b, a];
      const objects = fill(rng, [a, b], new Set([kind.id]));
      const text = cap(`иди к ${kind.dat}, но не к ${adjDat(attrOf(named), kind.gender)}.`);
      return { level: 5, text, targets: [target.id], objects, itemId: `note5-${target.id}` };
    }
  }
}

/** Every text generateNote can produce — tools/tts.ts voices each one for the "read it to me" hint. */
export function allNoteTexts(): string[] {
  const out = new Set<string>();
  const attrs = (k: Kind): (Size | Color)[] => (k.attr === 'size' ? ['big', 'small'] : ['red', 'blue', 'green']);
  for (const k of KINDS) {
    if (k.nom.length <= 5) out.add(upper(k.nom));
    out.add(upper(`иди к ${k.dat}`));
    for (const a of attrs(k)) {
      out.add(cap(`иди к ${adjDat(a, k.gender)} ${k.dat}.`));
      out.add(cap(`иди к ${k.dat}, но не к ${adjDat(a, k.gender)}.`));
    }
    for (const k2 of KINDS) if (k2 !== k) out.add(cap(`сначала иди к ${k.dat}, потом к ${k2.dat}.`));
  }
  return [...out];
}
