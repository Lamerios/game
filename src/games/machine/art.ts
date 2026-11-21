import { OL, svg } from '../../art/objects';

/** Menu card: two ramps, a ball and a bell. */
export const MACHINE_ICON = svg(200, 200, `
  <rect x="10" y="10" width="180" height="180" rx="20" fill="#e9c46a" stroke="${OL}" stroke-width="6"/>
  <path d="M30 60 L110 95" stroke="${OL}" stroke-width="16" stroke-linecap="round"/><path d="M30 60 L110 95" stroke="#b5651d" stroke-width="9" stroke-linecap="round"/>
  <path d="M170 110 L90 145" stroke="${OL}" stroke-width="16" stroke-linecap="round"/><path d="M170 110 L90 145" stroke="#b5651d" stroke-width="9" stroke-linecap="round"/>
  <circle cx="45" cy="38" r="17" fill="#adb5bd" stroke="${OL}" stroke-width="5"/>
  <path d="M60 182 C60 150 72 140 80 140 C88 140 100 150 100 182Z" fill="#ffd166" stroke="${OL}" stroke-width="5"/>
  <circle cx="80" cy="186" r="6" fill="${OL}"/>`);
