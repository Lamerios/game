/**
 * Vector art for island objects, cargo, the sea and the map (v0.2 art pass).
 * Plain SVG strings, turned into textures by art/load.ts. One style everywhere:
 * dark outline (OL), flat fills, one light highlight per shape.
 */

export const OL = '#2b2d42';
const S = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;

export const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

export const PAINT = {
  red: '#e63946',
  blue: '#277da1',
  green: '#43aa8b',
  wood: '#a5683a',
  woodDark: '#7a4a24',
  gold: '#ffc94a',
  sand: '#f4d58d',
  leaf: '#2a9d8f',
  leafLight: '#57cc99',
  stone: '#9aa5b1',
  iron: '#4a4e69',
  white: '#ffffff',
  sail: '#fffaf0',
  sea: '#1b4965',
};

/** Objects the notes point at. `c` is the object's colour (chest, barrel, boat, flag). */
export const OBJECTS: Record<string, (c: string) => string> = {
  palm: () =>
    svg(200, 200, `
      <path d="M100 190 C96 150 92 110 104 70" fill="none" stroke="${OL}" stroke-width="22" stroke-linecap="round"/>
      <path d="M100 190 C96 150 92 110 104 70" fill="none" stroke="${PAINT.wood}" stroke-width="12" stroke-linecap="round"/>
      <path d="M97 160 h10 M96 135 h10 M97 110 h10" stroke="${PAINT.woodDark}" stroke-width="4"/>
      <path d="M104 70 C70 40 40 50 18 80 C48 66 72 66 104 70Z" fill="${PAINT.leafLight}" ${S}/>
      <path d="M104 70 C140 36 170 46 186 78 C156 64 132 64 104 70Z" fill="${PAINT.leafLight}" ${S}/>
      <path d="M104 70 C90 30 104 12 128 8 C116 30 112 48 104 70Z" fill="${PAINT.leaf}" ${S}/>
      <path d="M104 70 C70 70 50 90 46 120 C66 98 84 86 104 70Z" fill="${PAINT.leaf}" ${S}/>
      <path d="M104 70 C140 72 158 94 160 122 C140 100 124 86 104 70Z" fill="${PAINT.leaf}" ${S}/>
      <circle cx="96" cy="78" r="10" fill="#8d5524" ${S}/><circle cx="114" cy="80" r="10" fill="#8d5524" ${S}/>`),
  stone: () =>
    svg(200, 200, `
      <path d="M30 170 C20 130 50 80 100 76 C150 72 182 120 172 170Z" fill="${PAINT.stone}" ${S}/>
      <path d="M60 110 C76 94 96 90 112 92" fill="none" stroke="#dde3ea" stroke-width="8" stroke-linecap="round"/>
      <path d="M120 140 l18 10 M70 150 l14 -8" stroke="#6c7a89" stroke-width="5" stroke-linecap="round"/>`),
  chest: (c) =>
    svg(200, 200, `
      <rect x="28" y="92" width="144" height="84" rx="8" fill="${c}" ${S}/>
      <path d="M28 96 C28 50 172 50 172 96Z" fill="${c}" ${S}/>
      <path d="M28 96 H172" ${S}/>
      <rect x="60" y="58" width="16" height="118" fill="${PAINT.gold}" ${S}/>
      <rect x="124" y="58" width="16" height="118" fill="${PAINT.gold}" ${S}/>
      <rect x="86" y="88" width="28" height="34" rx="4" fill="${PAINT.gold}" ${S}/>
      <circle cx="100" cy="102" r="5" fill="${OL}"/>
      <path d="M40 80 C50 66 70 62 84 62" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="6" stroke-linecap="round"/>`),
  turtle: () =>
    svg(200, 200, `
      <ellipse cx="44" cy="128" rx="20" ry="16" fill="#95d5b2" ${S}/>
      <circle cx="38" cy="122" r="4" fill="${OL}"/>
      <ellipse cx="70" cy="160" rx="14" ry="12" fill="#95d5b2" ${S}/>
      <ellipse cx="140" cy="160" rx="14" ry="12" fill="#95d5b2" ${S}/>
      <path d="M56 150 C56 90 150 80 170 150Z" fill="#2d6a4f" ${S}/>
      <path d="M84 146 l14 -36 l28 0 l14 36 M98 110 l-18 -6 M126 110 l16 -8" fill="none" stroke="#52b788" stroke-width="5"/>
      <path d="M52 150 H174" ${S}/>`),
  barrel: (c) =>
    svg(200, 200, `
      <path d="M52 28 C36 70 36 130 52 172 H148 C164 130 164 70 148 28Z" fill="${PAINT.wood}" ${S}/>
      <path d="M80 28 C72 70 72 130 80 172 M120 28 C128 70 128 130 120 172" fill="none" stroke="${PAINT.woodDark}" stroke-width="4"/>
      <path d="M44 62 H156 M40 138 H160" stroke="${c}" stroke-width="16"/>
      <path d="M44 62 H156 M40 138 H160" stroke="${OL}" stroke-width="4" stroke-dasharray="0" opacity=".5"/>
      <ellipse cx="100" cy="30" rx="48" ry="8" fill="${PAINT.woodDark}" ${S}/>`),
  crab: () =>
    svg(200, 200, `
      <path d="M40 130 l-20 26 M56 140 l-14 30 M160 130 l20 26 M144 140 l14 30" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
      <path d="M40 130 l-20 26 M56 140 l-14 30 M160 130 l20 26 M144 140 l14 30" stroke="#e76f51" stroke-width="5" stroke-linecap="round"/>
      <path d="M58 104 C40 90 34 70 40 56" fill="none" stroke="${OL}" stroke-width="12" stroke-linecap="round"/>
      <path d="M142 104 C160 90 166 70 160 56" fill="none" stroke="${OL}" stroke-width="12" stroke-linecap="round"/>
      <path d="M26 54 C24 30 56 28 54 50 L42 46Z" fill="#e76f51" ${S}/>
      <path d="M174 54 C176 30 144 28 146 50 L158 46Z" fill="#e76f51" ${S}/>
      <ellipse cx="100" cy="124" rx="62" ry="40" fill="#e76f51" ${S}/>
      <path d="M86 92 V70 M114 92 V70" ${S}/>
      <circle cx="86" cy="66" r="10" fill="#fff" ${S}/><circle cx="114" cy="66" r="10" fill="#fff" ${S}/>
      <circle cx="88" cy="67" r="4" fill="${OL}"/><circle cx="116" cy="67" r="4" fill="${OL}"/>
      <path d="M84 132 C94 140 106 140 116 132" fill="none" ${S}/>`),
  boat: (c) =>
    svg(200, 200, `
      <path d="M100 30 V130" ${S}/>
      <path d="M106 36 C150 70 160 100 158 124 H106Z" fill="${PAINT.sail}" ${S}/>
      <path d="M94 50 C70 80 60 104 62 124 H94Z" fill="${PAINT.sail}" ${S}/>
      <path d="M20 134 H180 L156 176 H44Z" fill="${c}" ${S}/>
      <path d="M34 150 H168" stroke="#ffffff" stroke-opacity=".6" stroke-width="6"/>`),
  anchor: () =>
    svg(200, 200, `
      <circle cx="100" cy="34" r="16" fill="none" stroke="${OL}" stroke-width="18"/>
      <circle cx="100" cy="34" r="16" fill="none" stroke="${PAINT.iron}" stroke-width="8"/>
      <path d="M100 50 V170 M66 76 H134 M30 120 C40 170 160 170 170 120" fill="none" stroke="${OL}" stroke-width="20" stroke-linecap="round"/>
      <path d="M100 50 V170 M66 76 H134 M30 120 C40 170 160 170 170 120" fill="none" stroke="${PAINT.iron}" stroke-width="10" stroke-linecap="round"/>
      <path d="M18 128 L30 104 L46 124Z M182 128 L170 104 L154 124Z" fill="${PAINT.iron}" ${S}/>`),
  /** A proper waving flag on a pole, with a big emblem so it reads at a glance. */
  flag: (c) =>
    svg(200, 200, `
      <rect x="34" y="18" width="12" height="172" rx="6" fill="${PAINT.wood}" ${S}/>
      <circle cx="40" cy="16" r="10" fill="${PAINT.gold}" ${S}/>
      <path d="M46 30 C80 16 110 44 150 30 C164 26 176 22 186 20 L186 108 C150 122 116 92 80 108 C66 114 56 116 46 116Z" fill="${c}" ${S}/>
      <path d="M58 40 C84 30 110 54 140 44" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="8" stroke-linecap="round"/>
      <path d="M116 46 l8 18 l20 2 l-15 13 l5 20 l-18 -11 l-18 11 l5 -20 l-15 -13 l20 -2Z" fill="#ffffff" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>`),
  cannon: () =>
    svg(200, 200, `
      <path d="M30 110 L150 60 L166 100 L46 150Z" fill="${PAINT.iron}" ${S}/>
      <ellipse cx="158" cy="80" rx="12" ry="22" transform="rotate(-22 158 80)" fill="${OL}"/>
      <path d="M48 112 L140 74" stroke="#9a8c98" stroke-width="6" stroke-linecap="round"/>
      <circle cx="70" cy="150" r="30" fill="${PAINT.wood}" ${S}/>
      <circle cx="70" cy="150" r="8" fill="${PAINT.gold}" ${S}/>
      <circle cx="132" cy="160" r="18" fill="${OL}"/><circle cx="160" cy="170" r="14" fill="${OL}"/>`),
};

export const COLORED_KINDS = ['chest', 'barrel', 'boat', 'flag'] as const;
export const OBJECT_COLORS = { red: PAINT.red, blue: PAINT.blue, green: PAINT.green } as const;

/** Side view of the yacht "Ветерок" with the captain's pennant on top. */
export const YACHT_SIDE = svg(260, 240, `
  <path d="M128 20 V178" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
  <path d="M132 20 L170 30 L132 40Z" fill="${PAINT.red}" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M136 44 C196 90 214 140 210 172 H136Z" fill="${PAINT.sail}" ${S}/>
  <path d="M148 80 C176 110 186 136 186 160" fill="none" stroke="#e0d6c2" stroke-width="5"/>
  <path d="M120 54 C80 100 64 140 68 172 H120Z" fill="${PAINT.sail}" ${S}/>
  <path d="M12 180 H248 L218 224 H44Z" fill="${PAINT.blue}" ${S}/>
  <path d="M28 194 H236" stroke="#ffffff" stroke-width="6"/>
  <circle cx="80" cy="206" r="6" fill="#fff" stroke="${OL}" stroke-width="3"/>
  <circle cx="110" cy="206" r="6" fill="#fff" stroke="${OL}" stroke-width="3"/>
  <circle cx="140" cy="206" r="6" fill="#fff" stroke="${OL}" stroke-width="3"/>`);

/** Top view for the course grid. Points right (east) at angle 0. */
export const YACHT_TOP = svg(120, 120, `
  <path d="M10 36 H76 C102 36 116 50 118 60 C116 70 102 84 76 84 H10Z" fill="${PAINT.red}" ${S}/>
  <path d="M18 50 H74 C90 50 100 56 102 60 C100 64 90 70 74 70 H18Z" fill="#e9ecef" stroke="${OL}" stroke-width="3"/>
  <path d="M50 60 L32 18 C60 30 74 44 80 60Z" fill="${PAINT.sail}" ${S}/>
  <circle cx="50" cy="60" r="6" fill="${PAINT.wood}" stroke="${OL}" stroke-width="3"/>`);

/** Klyaksa's ship: black sail with an ink blot. */
export const BLOT_SHIP = svg(260, 240, `
  <path d="M128 20 V178" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
  <path d="M136 40 C196 90 214 140 210 172 H136Z" fill="#22223b" ${S}/>
  <path d="M120 50 C80 100 64 140 68 172 H120Z" fill="#22223b" ${S}/>
  <path d="M172 104 c10 -14 26 0 16 12 c14 4 6 22 -8 16 c-2 14 -22 12 -20 -2 c-14 0 -12 -20 2 -18 c-6 -6 4 -16 10 -8Z" fill="#7b2cbf" stroke="#c77dff" stroke-width="3"/>
  <path d="M12 180 H248 L218 224 H44Z" fill="#3c3c5a" ${S}/>
  <path d="M28 194 H236" stroke="#7b2cbf" stroke-width="6"/>`);

export const BOTTLE = svg(200, 120, `
  <path d="M20 40 H120 C140 40 150 50 160 54 H184 V66 H160 C150 70 140 80 120 80 H20 C8 80 8 40 20 40Z" fill="#9ad1d4" fill-opacity=".9" ${S}/>
  <rect x="180" y="50" width="14" height="20" rx="3" fill="${PAINT.wood}" stroke="${OL}" stroke-width="4"/>
  <path d="M34 50 H110 V70 H34Z" fill="#fff1d0" stroke="${OL}" stroke-width="3"/>
  <path d="M30 48 C50 44 80 44 100 46" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>`);

export const COIN = svg(80, 80, `
  <circle cx="40" cy="40" r="32" fill="${PAINT.gold}" ${S}/>
  <circle cx="40" cy="40" r="20" fill="none" stroke="#e09f3e" stroke-width="5"/>
  <path d="M28 26 C34 20 44 18 50 20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`);

export const REEF = svg(80, 80, `
  <path d="M6 70 L18 30 L30 46 L42 14 L56 40 L66 26 L76 70Z" fill="#6c757d" ${S}/>
  <path d="M20 44 L28 52 M44 26 L48 40" stroke="#adb5bd" stroke-width="5" stroke-linecap="round"/>
  <path d="M2 72 C16 64 26 78 40 70 C54 62 64 78 78 70" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`);

/** Course goal: a buoy with a pennant, so the goal never looks like a random flag. */
export const GOAL_BUOY = svg(80, 80, `
  <path d="M40 8 V44" stroke="${OL}" stroke-width="5"/>
  <path d="M42 8 L70 18 L42 28Z" fill="${PAINT.gold}" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M18 70 C18 44 62 44 62 70Z" fill="${PAINT.red}" ${S}/>
  <path d="M22 58 H58" stroke="#fff" stroke-width="7"/>
  <path d="M4 72 C16 66 26 78 40 72 C54 66 64 78 76 72" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`);

export const CRATE = svg(100, 100, `
  <rect x="8" y="8" width="84" height="84" rx="6" fill="#d4a373" ${S}/>
  <path d="M8 8 L92 92 M92 8 L8 92" stroke="#a5683a" stroke-width="8"/>
  <rect x="8" y="8" width="84" height="84" rx="6" fill="none" ${S}/>`);

/** An island for the map, in a few looks. */
export function islandSvg(kind: number, visited: boolean): string {
  const sand = visited ? PAINT.sand : '#e9d8a6';
  const extra = [
    // 0: palm
    `<path d="M96 70 C92 50 96 36 104 26" fill="none" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
     <path d="M104 26 C84 10 64 16 54 32 C72 26 86 26 104 26Z M104 26 C124 8 146 14 152 32 C136 26 120 26 104 26Z" fill="${PAINT.leafLight}" ${S}/>`,
    // 1: barrels
    `<rect x="70" y="40" width="26" height="32" rx="6" fill="${PAINT.wood}" ${S}/><rect x="100" y="44" width="26" height="28" rx="6" fill="${PAINT.wood}" ${S}/>`,
    // 2: fog rocks
    `<path d="M70 72 L84 36 L96 52 L108 30 L124 72Z" fill="#6c757d" ${S}/>`,
    // 3: fort
    `<path d="M66 72 V40 H76 V48 H86 V40 H96 V48 H106 V40 H116 V48 H126 V40 H136 V72Z" fill="#b08968" ${S}/>`,
    // 4: ink island
    `<path d="M80 72 C70 50 90 30 104 40 C118 26 140 46 128 72Z" fill="#22223b" ${S}/><circle cx="104" cy="50" r="8" fill="#c77dff"/>`,
  ][kind % 5];
  return svg(200, 120, `
    <ellipse cx="100" cy="92" rx="92" ry="24" fill="#5fa8d3" opacity=".6"/>
    <path d="M18 88 C30 62 170 62 182 88 C160 104 40 104 18 88Z" fill="${sand}" ${S}/>
    ${extra}`);
}

export const HARBOR_BG = svg(1280, 720, `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ecae6"/><stop offset="1" stop-color="#d9f1ff"/></linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a86c8"/><stop offset="1" stop-color="#1b4965"/></linearGradient>
  </defs>
  <rect width="1280" height="420" fill="url(#sky)"/>
  <circle cx="1100" cy="110" r="60" fill="#ffd166"/>
  <g fill="#fff" opacity=".9"><ellipse cx="260" cy="120" rx="90" ry="28"/><ellipse cx="320" cy="100" rx="60" ry="30"/><ellipse cx="760" cy="80" rx="80" ry="22"/></g>
  <rect y="400" width="1280" height="320" fill="url(#sea)"/>
  <path d="M0 430 Q40 418 80 430 T160 430 T240 430 T320 430 T400 430 T480 430 T560 430 T640 430 T720 430 T800 430 T880 430 T960 430 T1040 430 T1120 430 T1200 430 T1280 430" fill="none" stroke="#bde0fe" stroke-width="4"/>
  <path d="M760 560 H1280 V720 H700Z" fill="#a5683a" stroke="${OL}" stroke-width="6"/>
  <path d="M780 590 H1280 M770 630 H1280 M760 670 H1280" stroke="#7a4a24" stroke-width="5"/>
  <path d="M820 560 V720 M960 560 V720 M1100 560 V720" stroke="#7a4a24" stroke-width="10"/>`);

export const SEA_BG = svg(1280, 720, `
  <defs>
    <radialGradient id="s" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#2f6fa3"/><stop offset="1" stop-color="#173f5f"/></radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#s)"/>
  <g fill="none" stroke="#5fa8d3" stroke-width="4" stroke-linecap="round" opacity=".6">
    <path d="M80 140 q20 -12 40 0 t40 0"/><path d="M420 90 q20 -12 40 0 t40 0"/><path d="M980 180 q20 -12 40 0 t40 0"/>
    <path d="M260 330 q20 -12 40 0 t40 0"/><path d="M700 260 q20 -12 40 0 t40 0"/><path d="M1120 420 q20 -12 40 0 t40 0"/>
    <path d="M120 600 q20 -12 40 0 t40 0"/><path d="M520 640 q20 -12 40 0 t40 0"/><path d="M900 580 q20 -12 40 0 t40 0"/>
  </g>
  <g transform="translate(1180 620)" fill="none" stroke="#e9c46a" stroke-width="4" opacity=".8">
    <circle r="44"/><path d="M0 -60 V60 M-60 0 H60"/><path d="M0 -44 L10 0 L0 44 L-10 0Z" fill="#e9c46a"/>
  </g>`);

export const BEACH_BG = svg(1280, 720, `
  <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ecae6"/><stop offset="1" stop-color="#caf0f8"/></linearGradient></defs>
  <rect width="1280" height="260" fill="url(#sk)"/>
  <rect y="200" width="1280" height="90" fill="#3a86c8"/>
  <path d="M0 270 C200 240 400 280 640 262 C880 244 1080 280 1280 258 V720 H0Z" fill="#f4d58d"/>
  <path d="M0 270 C200 240 400 280 640 262 C880 244 1080 280 1280 258" fill="none" stroke="#fff" stroke-width="8" opacity=".8"/>
  <g fill="#e9c46a"><circle cx="140" cy="420" r="6"/><circle cx="500" cy="680" r="5"/><circle cx="880" cy="460" r="6"/><circle cx="1180" cy="660" r="5"/></g>`);

export const NIGHT_BG = svg(1280, 720, `
  <defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b132b"/><stop offset="1" stop-color="#1c2541"/></linearGradient></defs>
  <rect width="1280" height="720" fill="url(#n)"/>
  <circle cx="1060" cy="120" r="54" fill="#fdf0d5"/><circle cx="1084" cy="104" r="50" fill="#0f1a35"/>
  <rect y="470" width="1280" height="250" fill="#0d1b2a"/>
  <path d="M0 480 Q40 470 80 480 T160 480 T240 480 T320 480 T400 480 T480 480 T560 480 T640 480 T720 480 T800 480 T880 480 T960 480 T1040 480 T1120 480 T1200 480 T1280 480" fill="none" stroke="#415a77" stroke-width="4"/>`);
