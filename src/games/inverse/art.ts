import { OL, svg } from '../../art/objects';

const S = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;

/** The cabin boy (the child's own figure on deck): striped shirt, sailor cap. */
export const YUNGA = svg(200, 260, `
  <ellipse cx="100" cy="250" rx="58" ry="9" fill="#000" fill-opacity=".18"/>
  <path d="M72 196 L66 244 H92 L98 200Z M128 196 L134 244 H108 L102 200Z" fill="#1d3557" ${S}/>
  <path d="M60 244 H96 V252 H56Z M140 244 H104 V252 H144Z" fill="${OL}"/>
  <path d="M58 120 C58 104 74 96 100 96 C126 96 142 104 142 120 L138 204 H62Z" fill="#fff" ${S}/>
  <path d="M60 134 H140 M60 156 H140 M61 178 H139" stroke="#277da1" stroke-width="10"/>
  <path d="M84 98 L100 124 L116 98" fill="#e63946" ${S}/>
  <path d="M58 116 C38 130 34 160 40 176" fill="none" stroke="${OL}" stroke-width="20" stroke-linecap="round"/>
  <path d="M58 116 C40 130 36 158 41 174" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
  <path d="M142 116 C162 130 166 160 160 176" fill="none" stroke="${OL}" stroke-width="20" stroke-linecap="round"/>
  <path d="M142 116 C160 130 164 158 159 174" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
  <circle cx="40" cy="182" r="11" fill="#f4c095" ${S}/><circle cx="160" cy="182" r="11" fill="#f4c095" ${S}/>
  <circle cx="100" cy="62" r="40" fill="#f4c095" ${S}/>
  <path d="M64 50 C66 20 134 20 136 50 C120 42 80 42 64 50Z" fill="#8d5524" ${S}/>
  <path d="M58 40 C70 22 130 22 142 40 L138 48 C120 38 80 38 62 48Z" fill="#fff" ${S}/>
  <path d="M60 46 C80 38 120 38 140 46" fill="none" stroke="#1d3557" stroke-width="8"/>
  <circle cx="86" cy="64" r="5" fill="${OL}"/><circle cx="114" cy="64" r="5" fill="${OL}"/>
  <path d="M86 80 C94 88 106 88 114 80" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="74" cy="76" rx="7" ry="4" fill="#ffadad"/><ellipse cx="126" cy="76" rx="7" ry="4" fill="#ffadad"/>`);

/** Ship's deck seen from the side, open sea and sky behind. */
export const DECK_BG = svg(1280, 720, `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ecae6"/><stop offset="1" stop-color="#d8f3ff"/></linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#219ebc"/><stop offset="1" stop-color="#126782"/></linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#sky)"/>
  <circle cx="1120" cy="110" r="56" fill="#ffd166"/>
  <path d="M120 140 C140 110 200 110 214 136 C246 130 262 156 244 172 H112 C92 170 96 142 120 140Z" fill="#fff" fill-opacity=".9"/>
  <path d="M760 90 C776 66 820 66 830 88 C856 84 868 104 854 116 H752 C736 114 740 92 760 90Z" fill="#fff" fill-opacity=".8"/>
  <rect y="330" width="1280" height="390" fill="url(#sea)"/>
  <path d="M0 350 C80 340 160 360 240 350 S400 340 480 350 S640 360 720 350 S880 340 960 350 S1120 360 1280 350" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5"/>
  <path d="M0 470 H1280 V720 H0Z" fill="#a5683a"/>
  <path d="M0 470 H1280" stroke="${OL}" stroke-width="8"/>
  <path d="M0 520 H1280 M0 580 H1280 M0 640 H1280 M0 700 H1280" stroke="#7a4a24" stroke-width="4"/>
  <path d="M160 470 V520 M420 520 V580 M700 470 V520 M980 520 V580 M260 580 V640 M560 640 V700 M860 580 V640 M1160 640 V700" stroke="#7a4a24" stroke-width="4"/>
  <path d="M0 420 H1280" stroke="#7a4a24" stroke-width="14"/>
  <path d="M0 412 H1280" stroke="${OL}" stroke-width="4"/>
  ${Array.from({ length: 17 }, (_, i) => `<path d="M${40 + i * 76} 420 V470" stroke="#7a4a24" stroke-width="10"/>`).join('')}`);
