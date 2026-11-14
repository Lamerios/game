import type { Car, Track } from './logic';

/**
 * Race art as SVG strings: cars seen from behind, city houses, street props.
 * All original drawings in the game's style (thick dark outline, soft highlights).
 */

const OL = '#2b2d42';
const S = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const s = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

export const CAR_W = 400;
export const CAR_H = 260;

function tyre(x: number, y: number, w: number, h: number) {
  let tread = '';
  for (let ty = y + 14; ty < y + h - 8; ty += 16) tread += `<path d="M${x + 8} ${ty} H${x + w - 8}" stroke="#444" stroke-width="5"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(22, w / 3)}" fill="#1f1f24" ${S}/>${tread}
    <path d="M${x + 10} ${y + 10} V${y + h - 14}" stroke="#fff" stroke-opacity=".18" stroke-width="7" stroke-linecap="round"/>`;
}

const glow = (cx: number, cy: number, rx: number, ry: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ff4d4d" opacity=".35"/>`;

function plate(n: number, x = 200, y = 182) {
  return `<rect x="${x - 34}" y="${y - 16}" width="68" height="32" rx="6" fill="#fff" ${S}/>
    <text x="${x}" y="${y + 10}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="28" text-anchor="middle" fill="${OL}">${n}</text>`;
}

/** A race car from behind, as the child sees his own car. */
export function carSvg(c: Car): string {
  const b = c.body;
  const d = c.dark;
  const shadow = `<ellipse cx="200" cy="244" rx="190" ry="15" fill="#000" opacity=".35"/>`;
  if (c.shape === 'formula') {
    return s(CAR_W, CAR_H, `${shadow}
      ${tyre(8, 112, 92, 134)}${tyre(300, 112, 92, 134)}
      <path d="M104 186 H296" stroke="${OL}" stroke-width="10"/>
      <circle cx="200" cy="74" r="30" fill="#fff" ${S}/>
      <path d="M172 72 C180 58 220 58 228 72" fill="none" stroke="${b}" stroke-width="10"/>
      <path d="M150 238 L250 238 L268 128 L132 128Z" fill="${b}" ${S}/>
      <path d="M168 128 L232 128 L220 82 L180 82Z" fill="${b}" ${S}/>
      <path d="M186 90 L190 124" stroke="#fff" stroke-opacity=".5" stroke-width="6" stroke-linecap="round"/>
      <rect x="128" y="206" width="144" height="32" rx="6" fill="#33333d" ${S}/>
      <path d="M152 210 V234 M176 210 V234 M200 210 V234 M224 210 V234 M248 210 V234" stroke="#555" stroke-width="5"/>
      ${glow(200, 196, 30, 16)}<rect x="186" y="188" width="28" height="16" rx="4" fill="#ff2a2a" ${S}/>
      <rect x="192" y="60" width="16" height="70" fill="${d}" ${S}/>
      <rect x="92" y="14" width="18" height="118" rx="4" fill="${d}" ${S}/>
      <rect x="290" y="14" width="18" height="118" rx="4" fill="${d}" ${S}/>
      <rect x="96" y="18" width="208" height="36" rx="8" fill="${b}" ${S}/>
      <rect x="100" y="58" width="200" height="14" rx="5" fill="${d}" ${S}/>
      <path d="M114 28 H200" stroke="#fff" stroke-opacity=".55" stroke-width="7" stroke-linecap="round"/>
      <text x="250" y="47" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="26" text-anchor="middle" fill="#fff" stroke="${OL}" stroke-width="2">${c.number}</text>`);
  }
  if (c.shape === 'super') {
    return s(CAR_W, CAR_H, `${shadow}
      ${tyre(36, 176, 74, 66)}${tyre(290, 176, 74, 66)}
      <path d="M20 200 C20 150 50 122 92 112 L308 112 C350 122 380 150 380 200 L380 222 C380 234 370 240 358 240 L42 240 C30 240 20 234 20 222Z" fill="${b}" ${S}/>
      <path d="M106 114 L132 56 C138 44 150 38 166 38 L234 38 C250 38 262 44 268 56 L294 114Z" fill="${d}" ${S}/>
      <path d="M126 108 L146 62 L254 62 L274 108Z" fill="#1d2b3a" ${S}/>
      <path d="M156 70 L142 102" stroke="#fff" stroke-opacity=".45" stroke-width="7" stroke-linecap="round"/>
      <rect x="54" y="94" width="292" height="14" rx="6" fill="${d}" ${S}/>
      ${glow(96, 148, 66, 22)}${glow(304, 148, 66, 22)}
      <rect x="40" y="138" width="112" height="20" rx="10" fill="#ff2a2a" ${S}/>
      <rect x="248" y="138" width="112" height="20" rx="10" fill="#ff2a2a" ${S}/>
      <path d="M50 128 C90 122 130 122 160 126" stroke="#fff" stroke-opacity=".45" stroke-width="7" stroke-linecap="round" fill="none"/>
      <rect x="110" y="204" width="180" height="32" rx="8" fill="#26262e" ${S}/>
      <path d="M140 208 V232 M260 208 V232" stroke="#555" stroke-width="5"/>
      <circle cx="172" cy="220" r="11" fill="#adb5bd" ${S}/><circle cx="228" cy="220" r="11" fill="#adb5bd" ${S}/>
      ${plate(c.number, 200, 178)}`);
  }
  if (c.shape === 'rally') {
    return s(CAR_W, CAR_H, `${shadow}
      ${tyre(44, 182, 72, 62)}${tyre(284, 182, 72, 62)}
      <path d="M40 226 L40 150 C40 134 52 124 68 122 L332 122 C348 124 360 134 360 150 L360 226Z" fill="${b}" ${S}/>
      <path d="M76 124 L100 52 C104 42 112 38 122 38 L278 38 C288 38 296 42 300 52 L324 124Z" fill="${b}" ${S}/>
      <path d="M96 118 L116 62 L284 62 L304 118Z" fill="#1d2b3a" ${S}/>
      <path d="M130 70 L116 108" stroke="#fff" stroke-opacity=".45" stroke-width="7" stroke-linecap="round"/>
      <rect x="92" y="26" width="216" height="18" rx="7" fill="${d}" ${S}/>
      <circle cx="160" cy="18" r="10" fill="#fff3b0" ${S}/><circle cx="240" cy="18" r="10" fill="#fff3b0" ${S}/>
      <rect x="182" y="124" width="14" height="76" fill="#fff" opacity=".85"/><rect x="204" y="124" width="14" height="76" fill="#fff" opacity=".85"/>
      ${glow(64, 156, 30, 34)}${glow(336, 156, 30, 34)}
      <rect x="48" y="132" width="34" height="50" rx="8" fill="#ff2a2a" ${S}/>
      <rect x="318" y="132" width="34" height="50" rx="8" fill="#ff2a2a" ${S}/>
      <rect x="36" y="200" width="328" height="28" rx="10" fill="${d}" ${S}/>
      <rect x="52" y="222" width="58" height="24" rx="4" fill="#111" ${S}/><rect x="290" y="222" width="58" height="24" rx="4" fill="#111" ${S}/>
      ${plate(c.number, 200, 170)}`);
  }
  // buggy
  return s(CAR_W, CAR_H, `${shadow}
    ${tyre(6, 104, 104, 142)}${tyre(290, 104, 104, 142)}
    <path d="M116 206 L132 56 L268 56 L284 206 M132 56 L200 34 L268 56 M124 130 L276 130" fill="none" stroke="${OL}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M116 206 L132 56 L268 56 L284 206 M132 56 L200 34 L268 56 M124 130 L276 130" fill="none" stroke="#adb5bd" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="200" cy="104" r="32" fill="${b}" ${S}/>
    <path d="M172 98 H228" stroke="#fff" stroke-width="10"/>
    <path d="M100 240 L300 240 L312 150 L88 150Z" fill="${b}" ${S}/>
    <rect x="146" y="162" width="108" height="44" rx="8" fill="#8d99ae" ${S}/>
    <path d="M160 172 H240 M160 186 H240" stroke="#5c677d" stroke-width="5"/>
    <path d="M160 162 L150 120 M240 162 L250 120" stroke="${OL}" stroke-width="14" stroke-linecap="round"/>
    <path d="M160 162 L150 120 M240 162 L250 120" stroke="#ced4da" stroke-width="6" stroke-linecap="round"/>
    ${glow(120, 176, 22, 22)}${glow(280, 176, 22, 22)}
    <circle cx="120" cy="176" r="13" fill="#ff2a2a" ${S}/><circle cx="280" cy="176" r="13" fill="#ff2a2a" ${S}/>
    <path d="M110 160 C140 154 170 154 190 156" stroke="#fff" stroke-opacity=".45" stroke-width="7" stroke-linecap="round" fill="none"/>
    ${plate(c.number, 200, 222)}`);
}

// ---------- the city ----------

export interface Palette {
  skyTop: number;
  skyBottom: number;
  grass: [number, number];
  walk: [number, number];
  road: [number, number];
  line: number;
  houses: string[];
  /** Share of lit windows. */
  lit: number;
  fog: number;
}

export const PALETTES: Record<Track['time'], Palette> = {
  day: {
    skyTop: 0x4cc9f0, skyBottom: 0xcaf0f8, grass: [0x6ab04c, 0x5c9d40], walk: [0xc9cdd3, 0xb8bdc4], road: [0x5a5f66, 0x555a61], line: 0xffffff,
    houses: ['#f4a261', '#e9c46a', '#90be6d', '#83c5be', '#f28482', '#bdb2ff', '#ffd6a5', '#a0c4ff'], lit: 0, fog: 0xcaf0f8,
  },
  sunset: {
    skyTop: 0x7b2cbf, skyBottom: 0xffb26b, grass: [0x7a9a3c, 0x6c8a32], walk: [0xc2a68c, 0xb3987f], road: [0x4d4652, 0x48414d], line: 0xffe8a3,
    houses: ['#e76f51', '#f4a261', '#b5838d', '#6d597a', '#e5989b', '#ffb4a2', '#9a8c98', '#c9ada7'], lit: 0.35, fog: 0xffb26b,
  },
  night: {
    skyTop: 0x050a24, skyBottom: 0x2b2d6e, grass: [0x1e3a2a, 0x1a3324], walk: [0x3a3f5a, 0x353a52], road: [0x24262f, 0x22232c], line: 0xfff3b0,
    houses: ['#3d405b', '#4a4e69', '#22223b', '#3c096c', '#283618', '#2b2d42', '#5a189a', '#14213d'], lit: 0.65, fog: 0x2b2d6e,
  },
};

/** One house facade with a shop on the ground floor; seeded so it stays the same. */
export function houseSvg(seed: number, pal: Palette): string {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const w = 220;
  const floors = 3 + Math.floor(rnd() * 5);
  const h = 70 + floors * 64;
  const color = pal.houses[seed % pal.houses.length]!;
  const winOff = pal.lit > 0.5 ? '#1b1d33' : '#4d6b8a';
  const awn = ['#e63946', '#2a9d8f', '#ffbe0b', '#3a86ff'][seed % 4]!;
  let body = `<rect x="6" y="${6 + 20}" width="${w - 12}" height="${h - 32}" fill="${color}" ${S}/>`;
  // roof
  const roof = seed % 3;
  if (roof === 0) body += `<rect x="0" y="18" width="${w}" height="16" fill="#6c757d" ${S}/>`;
  if (roof === 1) body += `<rect x="150" y="2" width="36" height="28" fill="#8d99ae" ${S}/><path d="M60 26 V4 M60 4 H76" stroke="${OL}" stroke-width="5"/>`;
  if (roof === 2) body += `<path d="M6 30 L${w / 2} 0 L${w - 6} 30Z" fill="#9d6b53" ${S}/>`;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < 3; c++) {
      const wx = 26 + c * 62;
      const wy = 44 + f * 64;
      const lit = rnd() < pal.lit;
      body += `<rect x="${wx}" y="${wy}" width="44" height="42" rx="4" fill="${lit ? '#ffd166' : winOff}" ${S}/>`;
      if (!lit) body += `<path d="M${wx + 8} ${wy + 32} L${wx + 30} ${wy + 8}" stroke="#fff" stroke-opacity=".35" stroke-width="5"/>`;
      else body += `<rect x="${wx - 6}" y="${wy - 6}" width="56" height="54" rx="8" fill="#ffd166" opacity=".25"/>`;
    }
  }
  // ground floor: a shop with an awning and a door
  const gy = h - 70;
  body += `<rect x="20" y="${gy + 18}" width="120" height="46" fill="${pal.lit > 0.5 ? '#ffe8a3' : '#a8dadc'}" ${S}/>
    <rect x="156" y="${gy + 14}" width="44" height="50" fill="#6b4226" ${S}/>
    <path d="M14 ${gy} H146 L140 ${gy + 18} H20Z" fill="${awn}" ${S}/>
    <path d="M47 ${gy + 2} V${gy + 16} M80 ${gy + 2} V${gy + 16} M113 ${gy + 2} V${gy + 16}" stroke="#fff" stroke-width="10"/>`;
  return s(w, h, body);
}

export const TREE = s(160, 260, `
  <ellipse cx="80" cy="250" rx="56" ry="9" fill="#000" opacity=".25"/>
  <rect x="68" y="150" width="24" height="100" rx="6" fill="#8d5524" ${S}/>
  <circle cx="80" cy="96" r="70" fill="#2a9d8f" ${S}/>
  <circle cx="50" cy="120" r="34" fill="#40916c" ${S}/><circle cx="114" cy="112" r="38" fill="#40916c" ${S}/>
  <path d="M48 62 C58 46 76 40 92 42" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="9" stroke-linecap="round"/>`);

export function lampSvg(on: boolean): string {
  return s(120, 360, `
    ${on ? '<ellipse cx="86" cy="40" rx="34" ry="30" fill="#fff3b0" opacity=".45"/>' : ''}
    <rect x="20" y="40" width="14" height="316" rx="5" fill="#495057" ${S}/>
    <path d="M27 44 C30 20 60 18 84 26" fill="none" stroke="${OL}" stroke-width="12" stroke-linecap="round"/>
    <path d="M27 44 C30 20 60 18 84 26" fill="none" stroke="#6c757d" stroke-width="5" stroke-linecap="round"/>
    <path d="M66 24 H104 L96 40 H74Z" fill="${on ? '#fff3b0' : '#dee2e6'}" ${S}/>`);
}

export const TRAFFIC_LIGHT = s(100, 340, `
  <rect x="44" y="120" width="14" height="216" rx="5" fill="#495057" ${S}/>
  <rect x="18" y="6" width="66" height="134" rx="14" fill="#212529" ${S}/>
  <circle cx="51" cy="34" r="16" fill="#5c1a1a" ${S}/><circle cx="51" cy="73" r="16" fill="#5c4a1a" ${S}/>
  <circle cx="51" cy="112" r="16" fill="#38b000" ${S}/><circle cx="51" cy="112" r="24" fill="#70e000" opacity=".35"/>`);

export const BILLBOARD = s(300, 260, `
  <rect x="70" y="140" width="16" height="116" fill="#6c757d" ${S}/><rect x="214" y="140" width="16" height="116" fill="#6c757d" ${S}/>
  <rect x="10" y="10" width="280" height="140" rx="12" fill="#fffaf0" ${S}/>
  <text x="80" y="104" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="76" text-anchor="middle" fill="#e63946">A</text>
  <text x="150" y="104" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="64" text-anchor="middle" fill="#3a86ff">B</text>
  <text x="220" y="104" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="64" text-anchor="middle" fill="#38b000">C</text>`);

export const CONE = s(160, 170, `
  <ellipse cx="80" cy="156" rx="70" ry="11" fill="#000" opacity=".3"/>
  <rect x="14" y="136" width="132" height="22" rx="6" fill="#f77f00" ${S}/>
  <path d="M40 140 L68 12 H92 L120 140Z" fill="#f77f00" ${S}/>
  <path d="M58 62 H102 L108 88 H52Z M48 106 H112 L116 122 H44Z" fill="#fff"/>
  <path d="M66 24 L52 100" stroke="#fff" stroke-opacity=".4" stroke-width="7" stroke-linecap="round"/>`);

/** Chequered banner over the road at the start and the finish. */
export const ARCH = s(600, 300, `
  <rect x="20" y="40" width="28" height="256" fill="#adb5bd" ${S}/><rect x="552" y="40" width="28" height="256" fill="#adb5bd" ${S}/>
  <rect x="10" y="20" width="580" height="90" rx="10" fill="#fff" ${S}/>
  ${Array.from({ length: 2 }, (_, r) => Array.from({ length: 18 }, (_, c) => ((r + c) % 2 ? `<rect x="${16 + c * 31.6}" y="${26 + r * 39}" width="31.6" height="39" fill="${OL}"/>` : '')).join('')).join('')}
  <rect x="10" y="20" width="580" height="90" rx="10" fill="none" ${S}/>`);

/** City skyline far away, tiles side by side. */
export function skylineSvg(pal: Palette): string {
  let x = 0;
  let body = '';
  let k = 7;
  const fill = pal.lit > 0.5 ? '#1c1f4a' : pal.lit > 0 ? '#8e5a8a' : '#9fb7c9';
  while (x < 1024) {
    k = (k * 37 + 11) % 97;
    const w = 40 + (k % 5) * 18;
    const h = 40 + ((k * 7) % 9) * 14;
    body += `<rect x="${x}" y="${160 - h}" width="${w}" height="${h}" fill="${fill}"/>`;
    if (pal.lit > 0) {
      for (let wy = 160 - h + 10; wy < 150; wy += 16) for (let wx = x + 8; wx < x + w - 8; wx += 14) if ((wx * 13 + wy * 7) % 5 < 2) body += `<rect x="${wx}" y="${wy}" width="5" height="7" fill="#ffd166" opacity=".8"/>`;
    }
    if (k % 4 === 0) body += `<rect x="${x + w / 2 - 2}" y="${160 - h - 26}" width="4" height="26" fill="${fill}"/>`;
    x += w + 4 + (k % 3) * 6;
  }
  return s(1024, 160, body);
}

export const CLOUD = s(260, 120, `
  <path d="M40 100 C10 100 10 60 44 58 C46 26 90 18 108 44 C122 14 178 16 184 54 C220 48 246 74 230 100Z" fill="#fff" opacity=".92"/>`);

export const MOON = s(140, 140, `<circle cx="70" cy="70" r="66" fill="#fff3b0" opacity=".25"/><circle cx="70" cy="70" r="46" fill="#fff8d6"/>
  <circle cx="56" cy="60" r="9" fill="#efe3a8"/><circle cx="84" cy="86" r="7" fill="#efe3a8"/>`);

export const SUN = s(180, 180, `<circle cx="90" cy="90" r="88" fill="#ffd166" opacity=".3"/><circle cx="90" cy="90" r="58" fill="#ffd166"/>`);

export const WRENCH = s(120, 120, `<path d="M30 96 L74 52 C66 30 82 10 104 14 L88 30 L92 42 L104 46 L118 30 C122 54 100 70 80 60 L36 104 C28 112 22 104 30 96Z" fill="#ced4da" ${S}/>`);

export const STAR = s(120, 120, `<path d="M60 8 L75 42 L112 46 L84 70 L92 108 L60 88 L28 108 L36 70 L8 46 L45 42Z" fill="#ffd166" ${S}/>
  <path d="M44 48 L58 22" stroke="#fff" stroke-opacity=".6" stroke-width="7" stroke-linecap="round"/>`);
export const STAR_OFF = s(120, 120, `<path d="M60 8 L75 42 L112 46 L84 70 L92 108 L60 88 L28 108 L36 70 L8 46 L45 42Z" fill="#adb5bd" opacity=".6" ${S}/>`);
