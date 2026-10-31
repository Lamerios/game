export type Gender = 'm' | 'f';
export type Size = 'big' | 'small';
export type Color = 'red' | 'blue' | 'green';

export interface Kind {
  id: string;
  nom: string;
  /** Dative, for "иди к …". */
  dat: string;
  gender: Gender;
  /** Which attribute distinguishes two objects of this kind in L3/L5. */
  attr: 'size' | 'color';
}

/** Island objects. Ё is always written (SDD 3.1). */
export const KINDS: readonly Kind[] = [
  { id: 'palm', nom: 'пальма', dat: 'пальме', gender: 'f', attr: 'size' },
  { id: 'stone', nom: 'камень', dat: 'камню', gender: 'm', attr: 'size' },
  { id: 'chest', nom: 'сундук', dat: 'сундуку', gender: 'm', attr: 'color' },
  { id: 'turtle', nom: 'черепаха', dat: 'черепахе', gender: 'f', attr: 'size' },
  { id: 'barrel', nom: 'бочка', dat: 'бочке', gender: 'f', attr: 'color' },
  { id: 'crab', nom: 'краб', dat: 'крабу', gender: 'm', attr: 'size' },
  { id: 'boat', nom: 'лодка', dat: 'лодке', gender: 'f', attr: 'color' },
  { id: 'anchor', nom: 'якорь', dat: 'якорю', gender: 'm', attr: 'size' },
  { id: 'flag', nom: 'флаг', dat: 'флагу', gender: 'm', attr: 'color' },
  { id: 'cannon', nom: 'пушка', dat: 'пушке', gender: 'f', attr: 'size' },
];

const ADJ_DAT: Record<Size | Color, Record<Gender, string>> = {
  big: { m: 'большому', f: 'большой' },
  small: { m: 'маленькому', f: 'маленькой' },
  red: { m: 'красному', f: 'красной' },
  blue: { m: 'синему', f: 'синей' },
  green: { m: 'зелёному', f: 'зелёной' },
};

export function adjDat(value: Size | Color, gender: Gender): string {
  return ADJ_DAT[value][gender];
}
