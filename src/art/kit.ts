/**
 * Shared helpers for the detailed art pass: colour math, soft volume gradients,
 * cel shadows and a seeded scatter so backgrounds look rich but stay identical
 * on every load (no Math.random in art).
 */

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const parse = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;

/** Mix a colour with white (amt > 0) or with a deep blue-black (amt < 0). */
export function tone(color: string, amt: number): string {
  const [r, g, b] = parse(color);
  if (amt >= 0) return hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  const k = -amt;
  // Shadows lean cool (towards #1d1f3a) so they look like light, not dirt.
  return hex(r + (29 - r) * k, g + (31 - g) * k, b + (58 - b) * k);
}

/** Radial "ball" gradient: light top-left, base in the middle, darker rim. */
export const vol = (id: string, base: string, light = 0.35, dark = 0.28) =>
  `<radialGradient id="${id}" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="${tone(base, light)}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${tone(base, -dark)}"/></radialGradient>`;

/** Vertical gradient from `a` (top) to `b` (bottom), with optional middle stop. */
export const lin = (id: string, a: string, b: string, mid?: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/>${mid ? `<stop offset=".5" stop-color="${mid}"/>` : ''}<stop offset="1" stop-color="${b}"/></linearGradient>`;

/** Horizontal gradient: used for barrels, masts, cylinders. */
export const cyl = (id: string, base: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${tone(base, -0.25)}"/><stop offset=".3" stop-color="${tone(base, 0.25)}"/><stop offset=".55" stop-color="${base}"/><stop offset="1" stop-color="${tone(base, -0.35)}"/></linearGradient>`;

/** Deterministic pseudo-random numbers, so a scatter of stars or shells never moves. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A soft white highlight stroke along a path. */
export const shine = (d: string, w = 6, op = 0.55) =>
  `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${op}" stroke-width="${w}" stroke-linecap="round"/>`;

/** A row of little wave crests from x0 to x1 at height y. */
export function waveRow(x0: number, x1: number, y: number, step: number, amp: number, color: string, width: number, op = 1): string {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += step) d += ` q${step / 4} ${-amp} ${step / 2} 0 t${step / 2} 0`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${op}"/>`;
}

/** A puffy cloud with a shaded underside, centred at (x, y), `s` = scale. */
export function cloud(x: number, y: number, s: number, op = 1): string {
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}">
    <ellipse cx="0" cy="12" rx="96" ry="26" fill="#c9dff0"/>
    <circle cx="-48" cy="0" r="34" fill="#fff"/><circle cx="-6" cy="-18" r="46" fill="#fff"/><circle cx="44" cy="-4" r="36" fill="#fff"/>
    <ellipse cx="0" cy="8" rx="92" ry="22" fill="#fff"/>
    <path d="M-86 16 C-40 30 40 30 88 14" fill="none" stroke="#b6d3ea" stroke-width="8" stroke-linecap="round"/>
  </g>`;
}

/** A distant gull as a little "v". */
export const farGull = (x: number, y: number, s = 1) =>
  `<path d="M${x - 14 * s} ${y - 4 * s} q${7 * s} ${-8 * s} ${14 * s} ${4 * s} q${7 * s} ${-12 * s} ${14 * s} ${-4 * s}" fill="none" stroke="#3d405b" stroke-width="${3 * s}" stroke-linecap="round" stroke-linejoin="round"/>`;
