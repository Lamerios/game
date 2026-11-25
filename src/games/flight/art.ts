import type { Plane } from './logic';

/**
 * Plane art as SVG strings, seen from behind (the way the child flies them):
 * five kinds of plane in the game's style, thick dark outline, soft shading,
 * a pilot in the cockpit, wing lights, rivets and panel lines.
 */

const OL = '#2b2d42';
const S = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const T = `stroke="${OL}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const s = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

export const PLANE_W = 420;
export const PLANE_H = 260;
const CX = 210;

/** Mixes a #rrggbb colour with white (t > 0) or black (t < 0). */
function tone(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function defs(p: Plane) {
  return `<defs>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone(p.body, 0.35)}"/><stop offset=".55" stop-color="${p.body}"/><stop offset="1" stop-color="${tone(p.body, -0.25)}"/></linearGradient>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone(p.body, 0.25)}"/><stop offset="1" stop-color="${tone(p.body, -0.2)}"/></linearGradient>
    <radialGradient id="f" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="${tone(p.body, 0.45)}"/><stop offset=".6" stop-color="${p.body}"/><stop offset="1" stop-color="${tone(p.body, -0.3)}"/></radialGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0fbfc"/><stop offset="1" stop-color="#5fa8d3"/></linearGradient>
    <radialGradient id="j" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffb703"/><stop offset="1" stop-color="#e85d04" stop-opacity="0"/></radialGradient>
  </defs>`;
}

/** A wing across the plane at height y; `dih` lifts (or with a minus, drops) the tips. */
function wing(y: number, span: number, thick: number, dih: number, p: Plane) {
  const l = CX - span;
  const r = CX + span;
  const t = thick / 2;
  const path = `M${l} ${y - t - dih} L${CX} ${y - t} L${r} ${y - t - dih} C${r + 12} ${y - t - dih} ${r + 12} ${y + t - dih} ${r} ${y + t - dih} L${CX} ${y + t} L${l} ${y + t - dih} C${l - 12} ${y + t - dih} ${l - 12} ${y - t - dih} ${l} ${y - t - dih}Z`;
  // a stripe of the dark colour near each tip, panel lines, ailerons and the wing lights
  const sx = span * 0.72;
  const stripe = (side: number) => {
    const x1 = CX + side * sx;
    const x2 = CX + side * (sx + 22);
    const k1 = (dih * sx) / span;
    const k2 = (dih * (sx + 22)) / span;
    return `<path d="M${x1} ${y - t - k1} L${x2} ${y - t - k2} L${x2} ${y + t - k2} L${x1} ${y + t - k1}Z" fill="${p.dark}" opacity=".9"/>`;
  };
  const panel = (side: number, f: number) => {
    const x = CX + side * span * f;
    const k = (dih * span * f) / span;
    return `<path d="M${x} ${y - t - k + 3} V${y + t - k - 3}" stroke="${OL}" stroke-opacity=".35" stroke-width="2.5"/>`;
  };
  const aileron = (side: number) => {
    const x1 = CX + side * span * 0.42;
    const x2 = CX + side * span * 0.68;
    return `<path d="M${x1} ${y + t * 0.35 - (dih * 0.42)} L${x2} ${y + t * 0.35 - dih * 0.68}" stroke="${OL}" stroke-opacity=".45" stroke-width="3"/>`;
  };
  return `<path d="${path}" fill="url(#w)" ${S}/>
    <path d="M${l + 8} ${y - t - dih + 6} L${CX - 40} ${y - t + 5}" stroke="#fff" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
    ${stripe(-1)}${stripe(1)}${panel(-1, 0.3)}${panel(1, 0.3)}${panel(-1, 0.55)}${panel(1, 0.55)}${aileron(-1)}${aileron(1)}
    <circle cx="${l + 2}" cy="${y - dih}" r="7" fill="#ff4d4d" ${T}/><circle cx="${r - 2}" cy="${y - dih}" r="7" fill="#52d273" ${T}/>
    <circle cx="${l + 2}" cy="${y - dih}" r="14" fill="#ff4d4d" opacity=".25"/><circle cx="${r - 2}" cy="${y - dih}" r="14" fill="#52d273" opacity=".25"/>`;
}

/** The round back of the fuselage with rivets and the tail cone. */
function fuselage(y: number, r: number, p: Plane) {
  let rivets = '';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    rivets += `<circle cx="${(CX + Math.cos(a) * (r - 10)).toFixed(1)}" cy="${(y + Math.sin(a) * (r - 10)).toFixed(1)}" r="2.2" fill="${OL}" opacity=".35"/>`;
  }
  return `<circle cx="${CX}" cy="${y}" r="${r}" fill="url(#f)" ${S}/>
    <path d="M${CX - r + 4} ${y + 8} A${r - 4} ${r - 4} 0 0 0 ${CX + r - 4} ${y + 8}" fill="none" stroke="${p.dark}" stroke-width="9" opacity=".8"/>
    ${rivets}
    <circle cx="${CX}" cy="${y}" r="${r * 0.42}" fill="${p.dark}" ${S}/>
    <circle cx="${CX}" cy="${y}" r="${r * 0.18}" fill="${tone(p.dark, -0.4)}"/>
    <path d="M${CX - r * 0.55} ${y - r * 0.55} A${r * 0.8} ${r * 0.8} 0 0 1 ${CX + r * 0.2} ${y - r * 0.78}" stroke="#fff" stroke-opacity=".55" stroke-width="7" stroke-linecap="round" fill="none"/>`;
}

/** A glass canopy with the pilot's leather helmet and goggles showing through. */
function cockpit(y: number, rx: number) {
  return `<path d="M${CX - rx} ${y + 14} C${CX - rx} ${y - 22} ${CX + rx} ${y - 22} ${CX + rx} ${y + 14}Z" fill="url(#g)" ${S}/>
    <circle cx="${CX}" cy="${y + 6}" r="15" fill="#8d5524" ${T}/>
    <path d="M${CX - 15} ${y + 4} H${CX + 15}" stroke="#4a2c12" stroke-width="6"/>
    <circle cx="${CX - 7}" cy="${y + 4}" r="4" fill="#ffd166"/><circle cx="${CX + 7}" cy="${y + 4}" r="4" fill="#ffd166"/>
    <path d="M${CX - rx + 8} ${y + 2} C${CX - rx + 10} ${y - 10} ${CX - 8} ${y - 14} ${CX} ${y - 14}" stroke="#fff" stroke-opacity=".8" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M${CX} ${y - 15} V${y + 14}" stroke="${OL}" stroke-width="3" opacity=".5"/>`;
}

/** The vertical fin with the plane's number and the rudder line. */
function fin(top: number, base: number, p: Plane, w = 13) {
  return `<path d="M${CX - w} ${base} L${CX - 6} ${top + 8} C${CX - 4} ${top} ${CX + 6} ${top} ${CX + 8} ${top + 8} L${CX + w} ${base}Z" fill="url(#b)" ${S}/>
    <path d="M${CX - 3} ${top + 14} L${CX - 6} ${base - 6}" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>
    <path d="M${CX + 3} ${top + 30} L${CX + 6} ${base - 4}" stroke="${OL}" stroke-opacity=".35" stroke-width="2.5"/>
    <rect x="${CX - 9}" y="${top + 10}" width="18" height="10" fill="${p.dark}" opacity=".85"/>
    <text x="${CX + 1}" y="${(top + base) / 2 + 14}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="22" text-anchor="middle" fill="#fff" stroke="${OL}" stroke-width="1.5">${p.number}</text>`;
}

function stabilizer(y: number, span: number) {
  return `<path d="M${CX - span} ${y + 6} L${CX - span + 10} ${y - 8} H${CX + span - 10} L${CX + span} ${y + 6}Z" fill="url(#w)" ${S}/>
    <path d="M${CX - span + 14} ${y - 2} H${CX - 30}" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>`;
}

/** The spinning propeller around the nose, seen through from behind. */
function propDisc(x: number, y: number, r: number) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity=".22"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="4" stroke-dasharray="14 10"/>
    <path d="M${x - r * 0.7} ${y - r * 0.7} A${r} ${r} 0 0 1 ${x + r * 0.2} ${y - r * 0.98}" stroke="#fff" stroke-opacity=".5" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M${x + r * 0.7} ${y + r * 0.7} A${r} ${r} 0 0 1 ${x - r * 0.2} ${y + r * 0.98}" stroke="#fff" stroke-opacity=".35" stroke-width="6" fill="none" stroke-linecap="round"/>`;
}

function wheel(x: number, top: number, y: number) {
  return `<path d="M${x} ${top} L${x} ${y - 8}" stroke="${OL}" stroke-width="8" stroke-linecap="round"/>
    <path d="M${x} ${top} L${x} ${y - 8}" stroke="#adb5bd" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="${x}" cy="${y}" rx="12" ry="14" fill="#1f1f24" ${S}/><ellipse cx="${x}" cy="${y}" rx="4" ry="5" fill="#adb5bd"/>`;
}

function prop(p: Plane) {
  return `${propDisc(CX, 150, 80)}${stabilizer(118, 88)}${fin(22, 116, p)}${cockpit(98, 30)}
    ${wing(158, 190, 32, 10, p)}${fuselage(150, 46, p)}${wheel(186, 194, 238)}${wheel(234, 194, 238)}`;
}

function biplane(p: Plane) {
  const strut = (x: number) => `<path d="M${x} 104 L${x} 160" stroke="${OL}" stroke-width="9" stroke-linecap="round"/><path d="M${x} 104 L${x} 160" stroke="${tone(p.body, -0.2)}" stroke-width="4" stroke-linecap="round"/>`;
  const wire = (x1: number, x2: number) => `<path d="M${x1} 106 L${x2} 158" stroke="${OL}" stroke-opacity=".6" stroke-width="2"/>`;
  return `${propDisc(CX, 150, 76)}${stabilizer(124, 80)}${fin(40, 122, p, 12)}${cockpit(112, 26)}
    ${wing(170, 176, 26, 4, p)}
    ${strut(70)}${strut(118)}${strut(302)}${strut(350)}${wire(70, 118)}${wire(118, 70)}${wire(302, 350)}${wire(350, 302)}
    <path d="M176 104 L190 128 M244 104 L230 128" stroke="${OL}" stroke-width="7" stroke-linecap="round"/>
    ${wing(92, 186, 26, 4, p)}${fuselage(150, 42, p)}
    <path d="M178 186 L168 226 M242 186 L252 226" stroke="${OL}" stroke-width="7"/>
    <path d="M150 226 C150 210 186 210 186 226 Z M234 226 C234 210 270 210 270 226Z" fill="${p.dark}" ${T}/>
    <ellipse cx="168" cy="234" rx="12" ry="14" fill="#1f1f24" ${S}/><ellipse cx="252" cy="234" rx="12" ry="14" fill="#1f1f24" ${S}/>`;
}

function sea(p: Plane) {
  const float = (x: number) => `<path d="M${x} 184 L${x - 4} 214" stroke="${OL}" stroke-width="8" stroke-linecap="round"/>
    <path d="M${CX + (x > CX ? 20 : -20)} 176 L${x - 4} 214" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>
    <path d="M${x - 34} 226 C${x - 34} 206 ${x + 26} 206 ${x + 26} 226 C${x + 26} 244 ${x - 34} 244 ${x - 34} 226Z" fill="#f8f9fa" ${S}/>
    <path d="M${x - 30} 230 C${x - 20} 242 ${x + 16} 242 ${x + 22} 230" fill="${p.dark}" opacity=".85"/>
    <path d="M${x - 22} 216 C${x - 14} 212 ${x - 2} 212 ${x + 4} 214" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none"/>`;
  const brace = (x: number) => `<path d="M${CX + (x > CX ? 30 : -30)} 140 L${x} 112" stroke="${OL}" stroke-width="7" stroke-linecap="round"/>`;
  return `${propDisc(CX, 150, 74)}${stabilizer(118, 84)}${fin(24, 116, p)}
    ${brace(110)}${brace(310)}
    ${fuselage(150, 46, p)}
    <rect x="${CX - 30}" y="118" width="60" height="22" rx="8" fill="url(#g)" ${T}/><path d="M${CX} 118 V140" stroke="${OL}" stroke-width="3"/>
    ${wing(100, 196, 30, -4, p)}
    ${float(156)}${float(270)}`;
}

function twin(p: Plane) {
  const engine = (x: number) => `${propDisc(x, 156, 52)}
    <path d="M${x - 24} 156 C${x - 24} 128 ${x + 24} 128 ${x + 24} 156 C${x + 24} 186 ${x - 24} 186 ${x - 24} 156Z" fill="url(#f)" ${S}/>
    <circle cx="${x}" cy="160" r="11" fill="${tone(p.dark, -0.3)}" ${T}/>
    <path d="M${x - 14} 142 C${x - 8} 136 ${x} 134 ${x + 6} 136" stroke="#fff" stroke-opacity=".6" stroke-width="4" stroke-linecap="round" fill="none"/>
    ${wheel(x, 184, 232)}`;
  return `${fin(18, 112, p, 15)}${stabilizer(30, 70)}${cockpit(96, 32)}
    ${wing(150, 200, 30, 6, p)}${engine(116)}${engine(304)}${fuselage(148, 50, p)}`;
}

function jet(p: Plane) {
  const canted = (side: number) => {
    const bx = CX + side * 26;
    const tx = CX + side * 70;
    return `<path d="M${bx - 10 * side} 118 L${tx - 6 * side} 36 C${tx} 30 ${tx + 8 * side} 32 ${tx + 8 * side} 40 L${bx + 14 * side} 124Z" fill="url(#b)" ${S}/>
      <path d="M${bx - 2 * side} 112 L${tx} 46" stroke="#fff" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>`;
  };
  const nozzle = (x: number) => `<circle cx="${x}" cy="166" r="34" fill="url(#j)"/>
    <circle cx="${x}" cy="160" r="17" fill="#495057" ${S}/><circle cx="${x}" cy="160" r="10" fill="#ffb703"/><circle cx="${x}" cy="160" r="5" fill="#fff3b0"/>`;
  return `${canted(-1)}${canted(1)}${cockpit(100, 28)}
    ${wing(156, 188, 22, -14, p)}
    <path d="M${CX - 58} 152 C${CX - 58} 104 ${CX + 58} 104 ${CX + 58} 152 C${CX + 58} 188 ${CX - 58} 188 ${CX - 58} 152Z" fill="url(#f)" ${S}/>
    <path d="M${CX - 46} 132 C${CX - 36} 118 ${CX - 10} 112 ${CX + 8} 114" stroke="#fff" stroke-opacity=".55" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M${CX - 54} 166 C${CX - 20} 180 ${CX + 20} 180 ${CX + 54} 166" stroke="${p.dark}" stroke-width="9" fill="none" opacity=".8"/>
    ${nozzle(CX - 24)}${nozzle(CX + 24)}`;
}

const SHAPES = { prop, biplane, sea, twin, jet } as const;

/** A plane from behind in its colours. */
export function planeSvg(p: Plane): string {
  return s(PLANE_W, PLANE_H, defs(p) + SHAPES[p.shape](p));
}

/** The hangar: an arched building with open doors and a windsock. */
export const HANGAR = s(160, 130, `
  <path d="M8 122 V64 C8 26 152 26 152 64 V122Z" fill="#8ecae6" ${S}/>
  <path d="M8 64 C8 26 152 26 152 64" fill="none" stroke="#219ebc" stroke-width="10"/>
  <path d="M34 122 V70 H126 V122" fill="#14213d" ${S}/>
  <path d="M34 82 H126 M34 96 H126" stroke="#2b2d42" stroke-width="3"/>
  <path d="M60 108 L80 96 L100 108 Z" fill="#e63946" ${T}/>
  <path d="M140 18 V60" stroke="${OL}" stroke-width="5"/>
  <path d="M140 18 L158 22 L156 34 L140 32Z" fill="#fb8500" ${T}/>`);

/** A stripe of runway for the route cards: grey with white dashes. */
export function runwaySvg(): string {
  let dashes = '';
  for (let x = 14; x < 220; x += 34) dashes += `<rect x="${x}" y="27" width="18" height="6" fill="#fff"/>`;
  return s(230, 60, `<rect x="0" y="10" width="230" height="40" fill="#6c757d"/>${dashes}`);
}
