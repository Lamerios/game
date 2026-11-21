import { OL, svg } from '../../art/objects';

/** Menu card: a ship's side with three coloured cabin doors and a question mark. */
export const CABINS_ICON = svg(200, 200, `
  <path d="M10 70 H190 L170 180 H30Z" fill="#7a4a24" stroke="${OL}" stroke-width="6" stroke-linejoin="round"/>
  <rect x="28" y="88" width="42" height="64" rx="6" fill="#e63946" stroke="${OL}" stroke-width="5"/>
  <rect x="79" y="88" width="42" height="64" rx="6" fill="#277da1" stroke="${OL}" stroke-width="5"/>
  <rect x="130" y="88" width="42" height="64" rx="6" fill="#52b788" stroke="${OL}" stroke-width="5"/>
  <text x="100" y="55" font-size="64" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#ffd166" stroke="${OL}" stroke-width="4">?</text>`);
