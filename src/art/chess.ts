/** Chess pieces as drawn figures instead of font glyphs, with soft volume shading. */
import { svg } from './objects';

const shapes: Record<string, string> = {
  p: `<circle cx="50" cy="30" r="14"/><path d="M36 48 C40 44 60 44 64 48 L68 76 H32Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  r: `<path d="M28 18 H38 V26 H46 V18 H54 V26 H62 V18 H72 V36 H28Z"/><path d="M34 36 H66 L70 76 H30Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  n: `<path d="M30 76 C30 60 40 50 50 44 C42 46 32 52 24 50 C20 44 24 36 34 30 L40 18 L46 26 C64 20 78 34 76 56 L72 76Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  b: `<circle cx="50" cy="14" r="6"/><path d="M50 18 C30 34 32 54 40 60 H60 C68 54 70 34 50 18Z"/><path d="M38 60 H62 L68 76 H32Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  q: `<circle cx="24" cy="24" r="6"/><circle cx="38" cy="16" r="6"/><circle cx="50" cy="12" r="6"/><circle cx="62" cy="16" r="6"/><circle cx="76" cy="24" r="6"/><path d="M24 28 L34 66 H66 L76 28 L62 46 L50 20 L38 46Z"/><path d="M32 66 H68 L70 76 H30Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
  k: `<path d="M46 4 H54 V12 H62 V20 H54 V28 H46 V20 H38 V12 H46Z"/><path d="M50 28 C30 28 22 44 34 66 H66 C78 44 70 28 50 28Z"/><path d="M32 66 H68 L70 76 H30Z"/><rect x="22" y="76" width="56" height="12" rx="4"/>`,
};

/** Small extra details drawn over each piece (lines in the piece's accent colour). */
const details: Record<string, string> = {
  p: `<path d="M38 66 H62"/>`,
  r: `<path d="M34 48 H66 M33 62 H67 M44 36 V48 M56 48 V62 M44 62 V76"/>`,
  n: `<path d="M46 30 C54 30 62 36 66 46 M54 44 C58 52 60 62 60 72"/>`,
  b: `<path d="M44 34 L56 46"/><path d="M40 70 H60"/>`,
  q: `<path d="M36 58 H64"/>`,
  k: `<path d="M38 50 C44 44 56 44 62 50 M36 58 H64"/>`,
};

/** `color` 'w' | 'b', `type` one of p r n b q k (chess.js notation). */
export function pieceSvg(color: 'w' | 'b', type: string): string {
  const w = color === 'w';
  const stroke = w ? '#2b2d42' : '#0b0c10';
  const [a, b, c] = w ? ['#ffffff', '#f3eee0', '#c9c1ad'] : ['#6a6d8c', '#2b2d42', '#14152a'];
  const line = w ? '#b8ae96' : '#4f5272';
  const shine = w ? '#ffffff' : '#8b8fb0';
  const eye = type === 'n' ? `<circle cx="46" cy="34" r="3.2" fill="${w ? '#2b2d42' : '#e9ecef'}"/><path d="M28 46 l4 -2" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>` : '';
  return svg(100, 100, `
    <defs><radialGradient id="pg" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs>
    <ellipse cx="50" cy="92" rx="30" ry="4" fill="#000" opacity=".18"/>
    <g fill="url(#pg)" stroke="${stroke}" stroke-width="5" stroke-linejoin="round">${shapes[type]}</g>
    <g fill="none" stroke="${line}" stroke-width="2.5" stroke-linecap="round">${details[type]}</g>
    ${eye}
    <path d="M40 50 C40 44 44 40 48 38" fill="none" stroke="${shine}" stroke-width="4" stroke-linecap="round" opacity=".75"/>
    <path d="M28 80 H48" stroke="${shine}" stroke-width="3" stroke-linecap="round" opacity=".6"/>`);
}
