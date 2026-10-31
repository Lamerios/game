/** Chess pieces as drawn figures instead of font glyphs. */
import { svg } from './objects';

const shapes: Record<string, string> = {
  p: `<circle cx="50" cy="30" r="14"/><path d="M36 48 C40 44 60 44 64 48 L68 76 H32Z"/><rect x="24" y="76" width="52" height="12" rx="4"/>`,
  r: `<path d="M28 18 H38 V26 H46 V18 H54 V26 H62 V18 H72 V36 H28Z"/><path d="M34 36 H66 L70 76 H30Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  n: `<path d="M30 76 C30 60 40 50 50 44 C42 46 32 52 24 50 C20 44 24 36 34 30 L40 18 L46 26 C64 20 78 34 76 56 L72 76Z"/><circle cx="46" cy="34" r="3" fill="currentColor"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  b: `<circle cx="50" cy="14" r="6"/><path d="M50 18 C30 34 32 54 40 60 H60 C68 54 70 34 50 18Z"/><path d="M38 60 H62 L68 76 H32Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  q: `<circle cx="24" cy="24" r="6"/><circle cx="38" cy="16" r="6"/><circle cx="50" cy="12" r="6"/><circle cx="62" cy="16" r="6"/><circle cx="76" cy="24" r="6"/><path d="M24 28 L34 66 H66 L76 28 L62 46 L50 20 L38 46Z"/><path d="M32 66 H68 L70 76 H30Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  k: `<path d="M46 4 H54 V12 H62 V20 H54 V28 H46 V20 H38 V12 H46Z"/><path d="M50 28 C30 28 22 44 34 66 H66 C78 44 70 28 50 28Z"/><path d="M32 66 H68 L70 76 H30Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
};

/** `color` 'w' | 'b', `type` one of p r n b q k (chess.js notation). */
export function pieceSvg(color: 'w' | 'b', type: string): string {
  const fill = color === 'w' ? '#fdfcf7' : '#2b2d42';
  const stroke = color === 'w' ? '#2b2d42' : '#0b0c10';
  const shine = color === 'w' ? '#ffffff' : '#5c5f7a';
  return svg(100, 100, `
    <g fill="${fill}" stroke="${stroke}" stroke-width="5" stroke-linejoin="round">${shapes[type]}</g>
    <path d="M40 50 C40 44 44 40 48 38" fill="none" stroke="${shine}" stroke-width="4" stroke-linecap="round" opacity=".7"/>`);
}
