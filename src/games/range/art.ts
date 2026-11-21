import { OL, svg } from '../../art/objects';
import type { WeaponId } from './logic';

/**
 * Toy weapons for the range, side view, muzzle to the right (200 × 120).
 * Bright plastic colours, no realistic guns: water, bubbles, suction cups,
 * a pirate cannon, a space blaster, a confetti gun, a firework mortar.
 */

const S = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const shine = (d: string) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="6" stroke-linecap="round"/>`;

const pistol = (body: string, tank: string, tip: string) => `
  <path d="M40 60 L28 110 L62 110 L72 72Z" fill="${body}" ${S}/>
  <rect x="30" y="34" width="120" height="34" rx="14" fill="${body}" ${S}/>
  <rect x="146" y="40" width="34" height="22" rx="6" fill="${tip}" ${S}/>
  <path d="M74 68 C76 84 92 86 94 70" fill="none" ${S}/>
  <circle cx="98" cy="22" r="20" fill="${tank}" ${S}/>
  ${shine('M44 44 H120')}`;

const ART: Record<WeaponId, string> = {
  water: svg(200, 120, pistol('#4cc9f0', '#90e0ef', '#ffd166')),
  bubble: svg(200, 120, `${pistol('#b5179e', '#f1c0e8', '#80ffdb')}
    <circle cx="186" cy="30" r="10" fill="#e0fbfc" fill-opacity=".8" ${S}/><circle cx="170" cy="16" r="6" fill="#e0fbfc" fill-opacity=".8" stroke="${OL}" stroke-width="4"/>`),
  twins: svg(200, 120, `
    <g transform="translate(0,-14) scale(.85)">${pistol('#f15bb5', '#fee440', '#ffffff')}<circle cx="196" cy="51" r="14" fill="#ff006e" ${S}/></g>
    <g transform="translate(20,36) scale(.85)">${pistol('#00bbf9', '#fee440', '#ffffff')}<circle cx="196" cy="51" r="14" fill="#ff006e" ${S}/></g>`),
  cannon: svg(200, 120, `
    <path d="M30 50 L160 30 C178 28 186 40 184 52 C182 66 172 72 160 70 L36 82Z" fill="#495057" ${S}/>
    <ellipse cx="184" cy="50" rx="8" ry="20" fill="#212529" ${S}/>
    <rect x="22" y="44" width="18" height="44" rx="8" fill="#343a40" ${S}/>
    <path d="M40 88 L150 88 L140 104 L50 104Z" fill="#a5683a" ${S}/>
    <circle cx="66" cy="102" r="14" fill="#7a4a24" ${S}/><circle cx="126" cy="102" r="14" fill="#7a4a24" ${S}/>
    <path d="M70 44 L76 82 M120 36 L126 76" stroke="#ffc94a" stroke-width="8"/>
    ${shine('M50 52 L150 38')}`),
  blaster: svg(200, 120, `
    <path d="M44 62 L34 110 L66 110 L76 70Z" fill="#7209b7" ${S}/>
    <path d="M24 32 L140 32 L150 46 L140 70 L24 70Z" fill="#e0e1dd" ${S}/>
    <rect x="140" y="40" width="44" height="14" rx="6" fill="#80ffdb" ${S}/>
    <circle cx="60" cy="51" r="10" fill="#80ffdb" ${S}/><circle cx="92" cy="51" r="10" fill="#ff006e" ${S}/>
    <path d="M110 20 L130 20 L124 32" fill="#7209b7" ${S}/>
    ${shine('M34 40 H128')}`),
  confetti: svg(200, 120, `
    <path d="M60 64 L50 112 L82 112 L90 72Z" fill="#06d6a0" ${S}/>
    <rect x="20" y="30" width="130" height="40" rx="10" fill="#ffd166" ${S}/>
    <rect x="146" y="36" width="40" height="28" rx="6" fill="#ef476f" ${S}/>
    <path d="M100 70 L96 104 L118 104 L120 70Z" fill="#118ab2" ${S}/>
    <path d="M40 30 V70 M64 30 V70 M88 30 V70" stroke="#ef476f" stroke-width="6"/>
    <rect x="186" y="26" width="8" height="8" fill="#06d6a0"/><rect x="190" y="62" width="8" height="8" fill="#118ab2"/>
    ${shine('M28 40 H136')}`),
  mortar: svg(200, 120, `
    <path d="M60 110 L140 110 L130 88 L70 88Z" fill="#a5683a" ${S}/>
    <path d="M74 92 L118 20 L150 36 L112 98Z" fill="#9d4edd" ${S}/>
    <ellipse cx="134" cy="27" rx="18" ry="9" transform="rotate(26 134 27)" fill="#3c096c" ${S}/>
    <path d="M90 66 L130 86 M104 42 L140 60" stroke="#ffd166" stroke-width="7"/>
    <path d="M150 10 l6 -8 M164 16 l10 -4 M160 2 l2 -2" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/>`),
  golden: svg(200, 120, `
    <path d="M30 50 L160 30 C178 28 186 40 184 52 C182 66 172 72 160 70 L36 82Z" fill="#ffb703" ${S}/>
    <ellipse cx="184" cy="50" rx="8" ry="20" fill="#fb8500" ${S}/>
    <rect x="22" y="44" width="18" height="44" rx="8" fill="#fb8500" ${S}/>
    <path d="M40 88 L150 88 L140 104 L50 104Z" fill="#e63946" ${S}/>
    <circle cx="66" cy="102" r="14" fill="#ffd166" ${S}/><circle cx="126" cy="102" r="14" fill="#ffd166" ${S}/>
    <path d="M96 38 l6 -14 l6 14 l14 -6 l-6 14 h-20 l-6 -14Z" fill="#fff3b0" stroke="${OL}" stroke-width="4"/>
    ${shine('M50 52 L150 38')}`),
};

export const weaponSvg = (id: WeaponId) => ART[id];

/** A locked weapon: the same shape as a dark silhouette with a padlock. */
export function lockedSvg(id: WeaponId): string {
  const body = ART[id].replace(/fill="#[0-9a-f]{3,6}"/gi, 'fill="#6c757d"').replace(/<svg[^>]*>|<\/svg>/g, '');
  return svg(200, 120, `<g opacity=".55">${body}</g>
    <rect x="80" y="54" width="40" height="34" rx="6" fill="#ffd166" ${S}/>
    <path d="M88 54 V44 C88 30 112 30 112 44 V54" fill="none" ${S}/>`);
}

/** Tin target board on a post (for the shelf). */
export const BOTTLE_SVG = svg(80, 140, `
  <path d="M30 6 H50 V40 C68 50 72 64 72 80 V128 C72 134 68 136 62 136 H18 C12 136 8 134 8 128 V80 C8 64 12 50 30 40Z" fill="#95d5b2" fill-opacity=".9" ${S}/>
  <rect x="26" y="2" width="28" height="14" rx="4" fill="#a5683a" ${S}/>
  <path d="M18 70 V120" stroke="#fff" stroke-opacity=".6" stroke-width="7" stroke-linecap="round"/>`);
