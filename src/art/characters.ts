/** The crew and the island folk (scenario v0.2). All original characters. */
import { OL, svg } from './objects';

const S = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const eye = (x: number, y: number, r = 12) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S}/><circle cx="${x + 2}" cy="${y + 1}" r="${r * 0.45}" fill="${OL}"/><circle cx="${x + 4}" cy="${y - 3}" r="${r * 0.18}" fill="#fff"/>`;

/** Rumb: the navigator parrot. */
const rumb = svg(220, 220, `
  <path d="M96 170 L80 214 M124 170 L132 214" stroke="${OL}" stroke-width="8" stroke-linecap="round"/>
  <path d="M70 176 C90 200 110 214 120 216 C112 196 108 186 104 176Z" fill="#277da1" ${S}/>
  <ellipse cx="110" cy="128" rx="54" ry="62" fill="#e63946" ${S}/>
  <path d="M74 120 C60 150 70 176 96 184 C92 160 92 140 98 118Z" fill="#43aa8b" ${S}/>
  <path d="M92 140 C100 160 120 170 140 160" fill="none" stroke="#ffd166" stroke-width="18" stroke-linecap="round"/>
  <circle cx="112" cy="64" r="44" fill="#e63946" ${S}/>
  <path d="M98 24 C96 8 112 2 116 20 C122 4 140 10 130 28" fill="#ffd166" ${S}/>
  ${eye(124, 58, 13)}
  <path d="M140 70 C170 70 176 92 160 104 C156 92 148 86 136 86Z" fill="#ffd166" ${S}/>
  <path d="M138 86 C146 86 152 92 154 100" fill="none" stroke="${OL}" stroke-width="4"/>
  <path d="M80 30 C66 40 66 56 70 64" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="7" stroke-linecap="round"/>
`);

/** Pykhtelkin: the galley kettle who tells sea facts. */
const kettle = svg(220, 220, `
  <path d="M150 112 C196 112 200 160 160 170" fill="none" stroke="${OL}" stroke-width="16" stroke-linecap="round"/>
  <path d="M150 112 C190 112 194 156 160 166" fill="none" stroke="#adb5bd" stroke-width="7" stroke-linecap="round"/>
  <path d="M58 132 L18 96 L28 88 L70 112Z" fill="#ced4da" ${S}/>
  <path d="M40 200 C26 150 48 92 110 92 C172 92 194 150 180 200Z" fill="#ced4da" ${S}/>
  <path d="M62 120 C70 106 84 100 98 98" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="110" cy="94" rx="52" ry="12" fill="#adb5bd" ${S}/>
  <circle cx="110" cy="74" r="14" fill="#e63946" ${S}/>
  ${eye(90, 140, 13)}${eye(130, 140, 13)}
  <path d="M90 168 C102 180 118 180 130 168" fill="none" ${S}/>
  <ellipse cx="72" cy="164" rx="10" ry="6" fill="#ffadad"/><ellipse cx="148" cy="164" rx="10" ry="6" fill="#ffadad"/>
  <path d="M30 200 H190" ${S}/>`);

/** Boltik: raccoon mechanic with goggles and a wrench. */
const raccoon = svg(220, 220, `
  <path d="M150 170 C200 160 206 120 188 100" fill="none" stroke="${OL}" stroke-width="26" stroke-linecap="round"/>
  <path d="M150 170 C196 160 200 124 186 104" fill="none" stroke="#adb5bd" stroke-width="16" stroke-linecap="round" stroke-dasharray="12 12"/>
  <path d="M60 214 C56 160 70 130 110 130 C150 130 164 160 160 214Z" fill="#457b9d" ${S}/>
  <rect x="96" y="150" width="28" height="24" rx="4" fill="#ffd166" ${S}/>
  <path d="M40 60 L58 18 L84 50Z M180 60 L162 18 L136 50Z" fill="#8d99ae" ${S}/>
  <ellipse cx="110" cy="84" rx="70" ry="56" fill="#adb5bd" ${S}/>
  <path d="M46 86 C70 64 150 64 174 86 C160 104 130 100 110 96 C90 100 60 104 46 86Z" fill="#343a40"/>
  <circle cx="80" cy="82" r="18" fill="#a8dadc" ${S}/><circle cx="140" cy="82" r="18" fill="#a8dadc" ${S}/>
  <circle cx="82" cy="82" r="6" fill="${OL}"/><circle cx="142" cy="82" r="6" fill="${OL}"/>
  <path d="M98 80 H122" ${S}/>
  <ellipse cx="110" cy="114" rx="28" ry="18" fill="#f8f9fa" ${S}/>
  <circle cx="110" cy="106" r="7" fill="${OL}"/>
  <path d="M100 120 C106 126 114 126 120 120" fill="none" stroke="${OL}" stroke-width="4"/>
  <path d="M30 150 L64 120 M24 140 a10 10 0 1 0 16 14" fill="none" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
  <path d="M30 150 L64 120" stroke="#ced4da" stroke-width="4"/>`);

/** Strelka: the little compass robot. `parts` 0..4 shows how much is rebuilt. */
export function strelkaSvg(parts: number): string {
  const lit = (n: number, on: string, off = '#6c757d') => (parts >= n ? on : off);
  return svg(220, 220, `
    <path d="M110 18 V40" ${S}/><circle cx="110" cy="16" r="9" fill="${lit(2, '#ffd166')}" ${S}/>
    <rect x="44" y="40" width="132" height="100" rx="28" fill="#e9ecef" ${S}/>
    <rect x="62" y="58" width="96" height="62" rx="16" fill="#22223b" ${S}/>
    ${parts >= 1 ? `<circle cx="90" cy="88" r="12" fill="#4cc9f0"/><circle cx="130" cy="88" r="12" fill="#4cc9f0"/><circle cx="94" cy="84" r="4" fill="#fff"/><circle cx="134" cy="84" r="4" fill="#fff"/>` : `<path d="M80 88 H100 M120 88 H140" stroke="#6c757d" stroke-width="6" stroke-linecap="round"/>`}
    <circle cx="110" cy="174" r="40" fill="#e9ecef" ${S}/>
    <circle cx="110" cy="174" r="28" fill="#fff" stroke="${OL}" stroke-width="4"/>
    ${parts >= 3 ? `<path d="M110 150 L118 174 L110 198 L102 174Z" fill="#e63946" stroke="${OL}" stroke-width="3"/><path d="M110 198 L118 174 L102 174Z" fill="#adb5bd"/>` : `<circle cx="110" cy="174" r="5" fill="#adb5bd"/>`}
    <path d="M44 100 C20 100 18 130 30 140 M176 100 C200 100 202 130 190 140" fill="none" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
    ${parts >= 4 ? `<circle cx="60" cy="52" r="6" fill="#80ffdb"/><circle cx="160" cy="52" r="6" fill="#80ffdb"/>` : ''}`);
}

/** Captain Klyaksa: a funny ink octopus pirate. Not scary on purpose. */
const blot = svg(240, 220, `
  ${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const x = 40 + i * 23;
      const dir = i % 2 ? 1 : -1;
      return `<path d="M${x} 140 C${x + dir * 10} 170 ${x - dir * 16} 190 ${x + dir * 6} 212" fill="none" stroke="${OL}" stroke-width="22" stroke-linecap="round"/>
              <path d="M${x} 140 C${x + dir * 10} 170 ${x - dir * 16} 190 ${x + dir * 6} 212" fill="none" stroke="#7b2cbf" stroke-width="12" stroke-linecap="round"/>`;
    })
    .join('')}
  <path d="M28 150 C10 60 60 26 120 26 C180 26 230 60 212 150Z" fill="#7b2cbf" ${S}/>
  <path d="M54 70 C70 48 96 40 120 40" fill="none" stroke="#c77dff" stroke-width="10" stroke-linecap="round"/>
  <circle cx="160" cy="70" r="10" fill="#c77dff"/><circle cx="60" cy="120" r="8" fill="#c77dff"/>
  ${eye(92, 100, 16)}
  <circle cx="148" cy="100" r="20" fill="#22223b" ${S}/><path d="M128 84 L196 66" ${S}/>
  <path d="M88 132 C104 146 136 146 152 132" fill="none" ${S}/>
  <path d="M48 44 C70 0 170 0 192 44 C150 34 90 34 48 44Z" fill="#22223b" ${S}/>
  <path d="M112 16 c4 -6 12 -6 16 0 c-2 6 -14 6 -16 0Z M108 26 L132 26" stroke="#fff" stroke-width="4" fill="#fff"/>`);

/** Plombir: walrus trader. */
const walrus = svg(220, 220, `
  <path d="M24 214 C20 150 50 110 110 110 C170 110 200 150 196 214Z" fill="#b08968" ${S}/>
  <ellipse cx="110" cy="86" rx="70" ry="60" fill="#c8a27a" ${S}/>
  ${eye(84, 66, 11)}${eye(136, 66, 11)}
  <ellipse cx="88" cy="104" rx="26" ry="20" fill="#e6ccb2" ${S}/><ellipse cx="132" cy="104" rx="26" ry="20" fill="#e6ccb2" ${S}/>
  <ellipse cx="110" cy="88" rx="12" ry="8" fill="${OL}"/>
  <path d="M92 118 C88 150 92 168 98 176 C104 160 104 140 104 120Z M128 118 C132 150 128 168 122 176 C116 160 116 140 116 120Z" fill="#fff" ${S}/>
  <path d="M60 30 H160 L150 10 H70Z" fill="#e63946" ${S}/><rect x="56" y="28" width="108" height="10" rx="5" fill="#9d0208" ${S}/>`);

/** General Ladya: old tortoise, commandant of the chess fort. */
const general = svg(220, 220, `
  <path d="M30 200 C30 120 190 120 190 200Z" fill="#2d6a4f" ${S}/>
  <path d="M70 196 l16 -40 l48 0 l16 40 M86 156 l-24 -8 M134 156 l24 -8" fill="none" stroke="#52b788" stroke-width="6"/>
  <path d="M20 200 H200" ${S}/>
  <ellipse cx="110" cy="92" rx="48" ry="44" fill="#95d5b2" ${S}/>
  ${eye(92, 84, 11)}${eye(128, 84, 11)}
  <path d="M84 70 L102 76 M136 70 L118 76" ${S}/>
  <path d="M96 112 C104 118 116 118 124 112" fill="none" ${S}/>
  <path d="M70 52 V22 H82 V32 H94 V22 H106 V32 H118 V22 H130 V32 H142 V22 H150 V52Z" fill="#ffd166" ${S}/>`);

export const CHARACTERS = { rumb, kettle, raccoon, blot, walrus, general } as const;
export type CharacterId = keyof typeof CHARACTERS | 'strelka';

export const CHARACTER_NAME: Record<CharacterId, string> = {
  rumb: 'Попугай Румб',
  kettle: 'Чайник Пыхтелкин',
  raccoon: 'Енот Болтик',
  blot: 'Капитан Клякса',
  walrus: 'Морж Пломбир',
  general: 'Генерал Ладья',
  strelka: 'Стрелка',
};
