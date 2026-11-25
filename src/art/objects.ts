/**
 * Vector art for island objects, cargo, the sea and the map.
 * Plain SVG strings, turned into textures by art/load.ts.
 *
 * Style (detailed pass, v0.3): the same dark outline (OL) and bold shapes a child
 * reads at a glance, plus soft volume gradients, a cel shadow on each form,
 * material texture (wood grain, rivets, foam) and a ground shadow. The main
 * colour of anything a task asks about (red chest, blue flag) stays dominant.
 */
import { cloud, cyl, farGull, lin, seeded, shine, tone, vol, waveRow } from './kit';

export const OL = '#2b2d42';
const S = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const S4 = `stroke="${OL}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

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

const groundShadow = (cx: number, cy: number, rx: number, ry = rx / 6) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1d1f3a" opacity=".18"/>`;
const rivet = (x: number, y: number, r = 3.5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff3c4" stroke="#8a5a00" stroke-width="1.5"/>`;

/** One palm frond as a leaf with a midrib and leaflet cuts. */
function frond(bx: number, by: number, tx: number, ty: number, bend: number, w: number, fill: string, vein: string): string {
  const mx = (bx + tx) / 2;
  const my = (by + ty) / 2;
  const len = Math.hypot(tx - bx, ty - by);
  const nx = -(ty - by) / len;
  const ny = (tx - bx) / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  const up = `${cx + nx * w} ${cy + ny * w}`;
  const dn = `${cx - nx * w * 0.5} ${cy - ny * w * 0.5}`;
  const q = (t: number) => {
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return [a * bx + b * cx + c * tx, a * by + b * cy + c * ty] as const;
  };
  const cuts = [0.3, 0.45, 0.6, 0.75, 0.88]
    .map((t) => {
      const [x, y] = q(t);
      const k = w * 0.55 * (1 - t * 0.6);
      return `M${x.toFixed(1)} ${y.toFixed(1)} l${(nx * k + (tx - bx) / len * 6).toFixed(1)} ${(ny * k + (ty - by) / len * 6).toFixed(1)}`;
    })
    .join(' ');
  return `<path d="M${bx} ${by} Q${up} ${tx} ${ty} Q${dn} ${bx} ${by}Z" fill="${fill}" ${S}/>
    <path d="M${bx} ${by} Q${cx} ${cy} ${tx} ${ty}" fill="none" stroke="${vein}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="${cuts}" stroke="${vein}" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>`;
}

/** Objects the notes point at. `c` is the object's colour (chest, barrel, boat, flag). */
export const OBJECTS: Record<string, (c: string) => string> = {
  palm: () =>
    svg(200, 200, `
      <defs>${cyl('pt', PAINT.wood)}${lin('pl', '#7ee0a8', '#2a9d8f')}${lin('pd', '#3fb68b', '#1f7a6e')}${vol('pc', '#8d5524')}</defs>
      ${groundShadow(100, 190, 46)}
      <path d="M74 192 c6 -14 12 -16 18 -2 M112 192 c4 -14 12 -16 16 -2" fill="#57cc99" stroke="#2a9d8f" stroke-width="4" stroke-linecap="round"/>
      <path d="M100 192 C96 150 92 110 104 70" fill="none" stroke="${OL}" stroke-width="24" stroke-linecap="round"/>
      <path d="M100 192 C96 150 92 110 104 70" fill="none" stroke="url(#pt)" stroke-width="14" stroke-linecap="round"/>
      <path d="M92 176 q8 6 15 0 M91 158 q8 6 15 0 M91 140 q8 6 15 0 M92 122 q8 6 15 0 M95 104 q8 6 14 0 M99 88 q7 5 12 0" fill="none" stroke="${PAINT.woodDark}" stroke-width="3" stroke-linecap="round"/>
      ${frond(104, 70, 40, 112, -14, 18, 'url(#pd)', '#1b6b5f')}
      ${frond(104, 70, 164, 118, 14, 18, 'url(#pd)', '#1b6b5f')}
      ${frond(104, 70, 14, 74, 18, 18, 'url(#pl)', '#2a9d8f')}
      ${frond(104, 70, 190, 80, -18, 18, 'url(#pl)', '#2a9d8f')}
      ${frond(104, 70, 128, 8, -10, 14, 'url(#pl)', '#2a9d8f')}
      ${frond(104, 70, 66, 14, 12, 14, 'url(#pl)', '#2a9d8f')}
      <circle cx="94" cy="80" r="11" fill="url(#pc)" ${S}/><circle cx="114" cy="82" r="11" fill="url(#pc)" ${S}/><circle cx="104" cy="92" r="10" fill="url(#pc)" ${S}/>
      <circle cx="90" cy="76" r="3" fill="#fff" opacity=".5"/><circle cx="110" cy="78" r="3" fill="#fff" opacity=".5"/>`),
  stone: () =>
    svg(200, 200, `
      <defs>${vol('sg', PAINT.stone)}</defs>
      ${groundShadow(100, 174, 80, 10)}
      <path d="M30 170 C20 130 50 80 100 76 C150 72 182 120 172 170Z" fill="url(#sg)" ${S}/>
      <path d="M118 80 C150 90 176 130 168 168 H134 C150 140 146 106 118 80Z" fill="#6c7a89" opacity=".45"/>
      <path d="M40 160 C56 150 70 156 84 166 C60 168 46 168 40 160Z" fill="#7fb069" stroke="#4f772d" stroke-width="3"/>
      ${shine('M60 110 C76 94 96 90 112 92', 8, 0.7)}
      <path d="M120 128 l14 10 l4 18 M70 140 l14 -8 l10 6" fill="none" stroke="#5c6b7a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="82" cy="118" r="4" fill="#bcc6d0"/><circle cx="142" cy="112" r="3" fill="#bcc6d0"/><circle cx="104" cy="150" r="3" fill="#7d8b99"/>
      <ellipse cx="180" cy="172" rx="12" ry="8" fill="url(#sg)" ${S4}/><ellipse cx="22" cy="176" rx="9" ry="6" fill="url(#sg)" ${S4}/>`),
  chest: (c) =>
    svg(200, 200, `
      <defs>${lin('cb', tone(c, 0.18), tone(c, -0.3))}${lin('cl', tone(c, 0.3), tone(c, -0.1))}${lin('cg', '#ffe38a', '#e0a020')}</defs>
      ${groundShadow(100, 180, 84, 10)}
      <rect x="28" y="92" width="144" height="84" rx="8" fill="url(#cb)" ${S}/>
      <path d="M34 118 H166 M34 146 H166" stroke="${tone(c, -0.45)}" stroke-width="3" opacity=".7"/>
      <path d="M52 104 h4 M100 132 h5 M150 158 h4 M46 160 h3" stroke="${tone(c, -0.45)}" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <path d="M40 92 C40 84 160 84 160 92" fill="#ffd166" stroke="${OL}" stroke-width="3"/>
      <circle cx="56" cy="88" r="5" fill="#ffd166" stroke="#c98a00" stroke-width="2"/><circle cx="148" cy="88" r="5" fill="#ffd166" stroke="#c98a00" stroke-width="2"/>
      <path d="M28 92 C28 48 172 48 172 92Z" fill="url(#cl)" ${S}/>
      <path d="M44 76 C70 66 130 66 156 76" fill="none" stroke="${tone(c, -0.4)}" stroke-width="3" opacity=".6"/>
      <path d="M28 92 H172" ${S}/>
      <rect x="60" y="54" width="16" height="122" fill="url(#cg)" ${S}/>
      <rect x="124" y="54" width="16" height="122" fill="url(#cg)" ${S}/>
      ${rivet(68, 70)}${rivet(68, 110)}${rivet(68, 160)}${rivet(132, 70)}${rivet(132, 110)}${rivet(132, 160)}
      <path d="M28 160 h18 v16 h-10 a8 8 0 0 1 -8 -8Z M172 160 h-18 v16 h10 a8 8 0 0 0 8 -8Z" fill="url(#cg)" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <rect x="84" y="86" width="32" height="38" rx="5" fill="url(#cg)" ${S}/>
      <circle cx="100" cy="100" r="5.5" fill="${OL}"/><path d="M100 102 L96 114 H104Z" fill="${OL}"/>
      ${shine('M40 78 C50 64 70 60 84 60', 6, 0.5)}
      ${shine('M38 104 V132', 5, 0.35)}`),
  turtle: () =>
    svg(200, 200, `
      <defs>${vol('ts', '#2d6a4f', 0.3, 0.3)}${vol('tk', '#95d5b2', 0.3, 0.2)}</defs>
      ${groundShadow(110, 172, 74, 9)}
      <path d="M168 146 l18 6 l-16 8Z" fill="url(#tk)" ${S4}/>
      <ellipse cx="70" cy="160" rx="16" ry="12" fill="url(#tk)" ${S}/>
      <ellipse cx="146" cy="160" rx="16" ry="12" fill="url(#tk)" ${S}/>
      <ellipse cx="44" cy="126" rx="22" ry="18" fill="url(#tk)" ${S}/>
      <circle cx="38" cy="120" r="5" fill="${OL}"/><circle cx="36" cy="118" r="1.8" fill="#fff"/>
      <path d="M30 132 q6 4 12 0" fill="none" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="52" cy="130" r="2.5" fill="#52b788"/><circle cx="66" cy="164" r="2.5" fill="#52b788"/><circle cx="150" cy="164" r="2.5" fill="#52b788"/>
      <path d="M56 150 C56 86 160 80 174 150Z" fill="url(#ts)" ${S}/>
      <path d="M90 146 l10 -30 h26 l10 30 M100 116 l-12 -14 M126 116 l14 -14 M88 102 h52 M70 146 l18 -44 M156 146 l-16 -44" fill="none" stroke="#74c69d" stroke-width="4" stroke-linejoin="round"/>
      <path d="M52 150 H178" ${S}/>
      <path d="M58 150 q10 8 20 0 q10 8 20 0 q10 8 20 0 q10 8 20 0 q10 8 20 0 q10 8 20 0" fill="#b7e4c7" stroke="${OL}" stroke-width="3"/>
      ${shine('M80 108 C90 96 104 92 116 92', 6, 0.45)}`),
  barrel: (c) =>
    svg(200, 200, `
      <defs>${cyl('bw', PAINT.wood)}${cyl('bh', c)}</defs>
      ${groundShadow(100, 176, 64, 9)}
      <path d="M52 28 C36 70 36 130 52 172 H148 C164 130 164 70 148 28Z" fill="url(#bw)" ${S}/>
      <path d="M72 30 C62 70 62 130 72 170 M100 30 V170 M128 30 C138 70 138 130 128 170" fill="none" stroke="${PAINT.woodDark}" stroke-width="3.5"/>
      <path d="M84 84 q4 6 0 12 M114 120 q-4 6 0 12 M60 118 q3 4 0 8 M140 80 q-3 4 0 8" fill="none" stroke="${PAINT.woodDark}" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
      <path d="M45 54 C80 60 120 60 155 54 L157 72 C120 78 80 78 43 72Z" fill="url(#bh)" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M41 128 C80 134 120 134 159 128 L157 146 C120 152 80 152 43 146Z" fill="url(#bh)" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      ${rivet(60, 64, 3)}${rivet(100, 67, 3)}${rivet(140, 64, 3)}${rivet(60, 138, 3)}${rivet(100, 141, 3)}${rivet(140, 138, 3)}
      <ellipse cx="100" cy="30" rx="48" ry="9" fill="${PAINT.woodDark}" ${S}/>
      <path d="M68 28 H132 M60 32 H140" stroke="#5c3a1c" stroke-width="2"/>
      <circle cx="100" cy="100" r="7" fill="${PAINT.woodDark}" stroke="${OL}" stroke-width="3"/>
      ${shine('M66 40 C58 70 58 110 64 150', 6, 0.35)}`),
  crab: () =>
    svg(200, 200, `
      <defs>${vol('cr', '#ef7a5a', 0.3, 0.3)}</defs>
      ${groundShadow(100, 172, 70, 8)}
      <path d="M40 130 l-20 26 M56 140 l-14 30 M160 130 l20 26 M144 140 l14 30" stroke="${OL}" stroke-width="11" stroke-linecap="round"/>
      <path d="M40 130 l-20 26 M56 140 l-14 30 M160 130 l20 26 M144 140 l14 30" stroke="#e76f51" stroke-width="5" stroke-linecap="round"/>
      <path d="M58 104 C40 90 34 70 40 56" fill="none" stroke="${OL}" stroke-width="13" stroke-linecap="round"/>
      <path d="M58 104 C40 90 34 70 40 56" fill="none" stroke="#e76f51" stroke-width="6" stroke-linecap="round"/>
      <path d="M142 104 C160 90 166 70 160 56" fill="none" stroke="${OL}" stroke-width="13" stroke-linecap="round"/>
      <path d="M142 104 C160 90 166 70 160 56" fill="none" stroke="#e76f51" stroke-width="6" stroke-linecap="round"/>
      <path d="M22 56 C16 26 56 22 56 48 L44 44 L40 56Z" fill="url(#cr)" ${S}/>
      <path d="M178 56 C184 26 144 22 144 48 L156 44 L160 56Z" fill="url(#cr)" ${S}/>
      <ellipse cx="100" cy="124" rx="64" ry="42" fill="url(#cr)" ${S}/>
      <path d="M44 120 C60 150 140 150 156 120" fill="none" stroke="#c4472d" stroke-width="4" opacity=".6"/>
      <circle cx="66" cy="112" r="4" fill="#f4a261"/><circle cx="134" cy="112" r="4" fill="#f4a261"/><circle cx="76" cy="100" r="3" fill="#f4a261"/><circle cx="126" cy="100" r="3" fill="#f4a261"/>
      <path d="M86 92 V72 M114 92 V72" ${S}/>
      <circle cx="86" cy="66" r="11" fill="#fff" ${S}/><circle cx="114" cy="66" r="11" fill="#fff" ${S}/>
      <circle cx="88" cy="67" r="5" fill="${OL}"/><circle cx="116" cy="67" r="5" fill="${OL}"/>
      <circle cx="90" cy="64" r="1.8" fill="#fff"/><circle cx="118" cy="64" r="1.8" fill="#fff"/>
      <path d="M82 130 C94 142 106 142 118 130" fill="none" ${S}/>
      <ellipse cx="70" cy="134" rx="8" ry="5" fill="#ffadad" opacity=".8"/><ellipse cx="130" cy="134" rx="8" ry="5" fill="#ffadad" opacity=".8"/>
      ${shine('M60 104 C70 94 84 90 96 90', 6, 0.45)}`),
  boat: (c) =>
    svg(200, 200, `
      <defs>${lin('bh', tone(c, 0.2), tone(c, -0.3))}${lin('bs', '#ffffff', '#efe4cc')}</defs>
      <path d="M8 182 C30 174 50 190 72 182 C94 174 112 190 134 182 C156 174 174 190 194 182" fill="none" stroke="#8ecae6" stroke-width="6" stroke-linecap="round"/>
      <path d="M100 24 V134" stroke="${OL}" stroke-width="8" stroke-linecap="round"/>
      <path d="M100 24 V134" stroke="${PAINT.wood}" stroke-width="3" stroke-linecap="round"/>
      <path d="M102 22 L124 28 L102 34Z" fill="${c}" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M106 36 C150 70 160 100 158 124 H106Z" fill="url(#bs)" ${S}/>
      <path d="M112 60 C130 78 140 96 144 120 M108 92 H152" fill="none" stroke="#d9cbb0" stroke-width="3"/>
      <path d="M94 50 C70 80 60 104 62 124 H94Z" fill="url(#bs)" ${S}/>
      <path d="M90 74 C80 90 74 106 74 120" fill="none" stroke="#d9cbb0" stroke-width="3"/>
      <path d="M20 134 H180 L156 176 H44Z" fill="url(#bh)" ${S}/>
      <path d="M30 148 H172 M38 162 H164" stroke="${tone(c, -0.45)}" stroke-width="2.5" opacity=".7"/>
      <path d="M22 140 H178" stroke="#ffffff" stroke-opacity=".7" stroke-width="5"/>
      <path d="M20 134 H180" stroke="${PAINT.woodDark}" stroke-width="6" stroke-linecap="round"/>`),
  anchor: () =>
    svg(200, 200, `
      <defs>${cyl('ai', '#6b7094')}</defs>
      <circle cx="100" cy="34" r="16" fill="none" stroke="${OL}" stroke-width="18"/>
      <circle cx="100" cy="34" r="16" fill="none" stroke="#6b7094" stroke-width="8"/>
      <path d="M100 50 V170 M66 76 H134 M30 120 C40 170 160 170 170 120" fill="none" stroke="${OL}" stroke-width="22" stroke-linecap="round"/>
      <path d="M100 50 V170 M66 76 H134 M30 120 C40 170 160 170 170 120" fill="none" stroke="url(#ai)" stroke-width="12" stroke-linecap="round"/>
      <path d="M18 128 L30 102 L48 124Z M182 128 L170 102 L152 124Z" fill="#6b7094" ${S}/>
      <circle cx="66" cy="76" r="7" fill="#6b7094" ${S4}/><circle cx="134" cy="76" r="7" fill="#6b7094" ${S4}/>
      <path d="M96 56 V164" stroke="#b8bdd6" stroke-width="3" stroke-linecap="round"/>
      <path d="M84 18 C70 30 78 44 92 52 C106 60 112 80 98 92 C86 102 90 116 104 120" fill="none" stroke="${OL}" stroke-width="11" stroke-linecap="round"/>
      <path d="M84 18 C70 30 78 44 92 52 C106 60 112 80 98 92 C86 102 90 116 104 120" fill="none" stroke="#d4a373" stroke-width="6" stroke-linecap="round" stroke-dasharray="5 3"/>`),
  /** A proper waving flag on a pole, with a big emblem so it reads at a glance. */
  flag: (c) =>
    svg(200, 200, `
      <defs>
        ${cyl('fp', PAINT.wood)}
        <linearGradient id="ff" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${tone(c, -0.15)}"/><stop offset=".22" stop-color="${tone(c, 0.2)}"/>
          <stop offset=".45" stop-color="${tone(c, -0.22)}"/><stop offset=".7" stop-color="${tone(c, 0.15)}"/><stop offset="1" stop-color="${tone(c, -0.18)}"/>
        </linearGradient>
      </defs>
      ${groundShadow(42, 192, 30, 5)}
      <rect x="34" y="18" width="12" height="174" rx="6" fill="url(#fp)" ${S}/>
      <path d="M38 40 v8 M41 90 v6 M38 140 v8" stroke="${PAINT.woodDark}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="40" cy="16" r="10" fill="${PAINT.gold}" ${S}/><circle cx="37" cy="13" r="3" fill="#fff" opacity=".7"/>
      <path d="M46 30 C80 16 110 44 150 30 C164 26 176 22 186 20 L186 108 C150 122 116 92 80 108 C66 114 56 116 46 116Z" fill="url(#ff)" ${S}/>
      <path d="M46 30 C80 16 110 44 150 30 C164 26 176 22 186 20" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="6"/>
      <path d="M116 46 l8 18 l20 2 l-15 13 l5 20 l-18 -11 l-18 11 l5 -20 l-15 -13 l20 -2Z" fill="#ffffff" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M116 52 l5 12 l-5 10 l-12 -6Z" fill="#e9ecef"/>
      <path d="M46 34 l-6 -2 M46 112 l-6 2" stroke="#d4a373" stroke-width="4" stroke-linecap="round"/>`),
  cannon: () =>
    svg(200, 200, `
      <defs>${lin('cn', '#7a7fa8', '#2f3250')}${vol('cbl', '#4a4e69', 0.35, 0.3)}${lin('cw', '#c08552', '#7a4a24')}</defs>
      ${groundShadow(100, 186, 88, 8)}
      <path d="M40 176 L110 120 L150 176Z" fill="url(#cw)" ${S}/>
      <path d="M30 110 L150 60 L166 100 L46 150Z" fill="url(#cn)" ${S}/>
      <path d="M70 92 L86 132 M118 72 L134 112" stroke="${OL}" stroke-width="7"/>
      <path d="M70 92 L86 132 M118 72 L134 112" stroke="#9a8c98" stroke-width="3"/>
      <ellipse cx="158" cy="80" rx="12" ry="22" transform="rotate(-22 158 80)" fill="#6b7094" ${S4}/>
      <ellipse cx="160" cy="80" rx="7" ry="14" transform="rotate(-22 160 80)" fill="#14152a"/>
      <circle cx="30" cy="132" r="9" fill="#6b7094" ${S4}/>
      ${shine('M48 112 L140 74', 5, 0.5)}
      <circle cx="70" cy="152" r="30" fill="url(#cw)" ${S}/>
      <path d="M70 124 V180 M42 152 H98 M50 132 L90 172 M90 132 L50 172" stroke="${PAINT.woodDark}" stroke-width="4"/>
      <circle cx="70" cy="152" r="30" fill="none" stroke="#4a4e69" stroke-width="5"/>
      <circle cx="70" cy="152" r="9" fill="${PAINT.gold}" ${S4}/>
      <circle cx="136" cy="168" r="16" fill="url(#cbl)" ${S4}/><circle cx="166" cy="170" r="14" fill="url(#cbl)" ${S4}/><circle cx="152" cy="146" r="13" fill="url(#cbl)" ${S4}/>`),
};

export const COLORED_KINDS = ['chest', 'barrel', 'boat', 'flag'] as const;
export const OBJECT_COLORS = { red: PAINT.red, blue: PAINT.blue, green: PAINT.green } as const;

/** A sailing hull + two sails + rigging, shared by the yacht and Klyaksa's ship. */
function sideShip(hull: string, stripe: string, sail: string, seam: string, extra = '', pennant = PAINT.red): string {
  return svg(260, 240, `
    <defs>
      ${lin('hl', tone(hull, 0.15), tone(hull, -0.35))}
      <linearGradient id="sl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${tone(sail, -0.08)}"/><stop offset=".5" stop-color="${sail}"/><stop offset="1" stop-color="${tone(sail, -0.18)}"/></linearGradient>
      ${cyl('ms', PAINT.wood)}
    </defs>
    <path d="M128 34 L26 182 M128 34 L234 182" stroke="${OL}" stroke-width="2.5" opacity=".55"/>
    <path d="M128 20 V180" stroke="${OL}" stroke-width="12" stroke-linecap="round"/>
    <path d="M128 22 V178" stroke="url(#ms)" stroke-width="6" stroke-linecap="round"/>
    <path d="M112 70 H144" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>
    <path d="M132 18 C146 16 156 26 172 24 C162 32 150 34 132 40Z" fill="${pennant}" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="128" cy="16" r="5" fill="${PAINT.gold}" stroke="${OL}" stroke-width="3"/>
    <path d="M136 44 C196 90 214 140 210 172 H136Z" fill="url(#sl)" ${S}/>
    <path d="M136 76 C170 104 186 128 192 150 M136 110 C160 124 174 140 180 160 M156 64 L150 172" fill="none" stroke="${seam}" stroke-width="3"/>
    <path d="M120 54 C80 100 64 140 68 172 H120Z" fill="url(#sl)" ${S}/>
    <path d="M120 90 C100 112 88 136 84 160 M100 80 L104 172" fill="none" stroke="${seam}" stroke-width="3"/>
    <path d="M132 172 H214" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>
    ${extra}
    <path d="M12 180 H248 L218 224 H44Z" fill="url(#hl)" ${S}/>
    <path d="M14 180 C10 172 12 168 18 166 M246 180 C252 172 250 166 242 164" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round"/>
    <path d="M18 166 H242" stroke="${OL}" stroke-width="3"/>
    <path d="M30 166 V180 M60 166 V180 M90 166 V180 M170 166 V180 M200 166 V180 M230 166 V180" stroke="${OL}" stroke-width="2.5"/>
    <path d="M24 192 H238" stroke="${stripe}" stroke-width="7"/>
    <path d="M24 192 H238" stroke="${OL}" stroke-width="1.5" opacity=".4"/>
    <path d="M40 214 H222" stroke="${tone(hull, -0.5)}" stroke-width="3" opacity=".6"/>
    ${[80, 110, 140]
      .map(
        (x) => `<circle cx="${x}" cy="205" r="8" fill="${PAINT.gold}" stroke="${OL}" stroke-width="3"/><circle cx="${x}" cy="205" r="4.5" fill="#bde0fe"/><circle cx="${x - 1.5}" cy="203.5" r="1.5" fill="#fff"/>`,
      )
      .join('')}
    <path d="M196 200 l14 0" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    <path d="M30 228 C50 222 64 234 86 228 C108 222 122 234 144 228 C166 222 180 234 202 228 C220 222 232 232 244 228" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>`);
}

/** Side view of the yacht "Ветерок" with the captain's pennant on top. */
export const YACHT_SIDE = sideShip(PAINT.blue, '#ffffff', PAINT.sail, '#e0d6c2');

/** Top view for the course grid. Points right (east) at angle 0. */
export const YACHT_TOP = svg(120, 120, `
  <defs>${lin('yt', '#f06a74', '#b3202d')}${lin('ys', '#ffffff', '#e9dcc0')}</defs>
  <ellipse cx="62" cy="64" rx="56" ry="26" fill="#1d1f3a" opacity=".15"/>
  <path d="M10 36 H76 C102 36 116 50 118 60 C116 70 102 84 76 84 H10Z" fill="url(#yt)" ${S}/>
  <path d="M18 48 H74 C90 48 102 56 104 60 C102 64 90 72 74 72 H18Z" fill="#d9b48a" stroke="${OL}" stroke-width="3"/>
  <path d="M24 54 H90 M24 60 H100 M24 66 H90" stroke="#b08060" stroke-width="1.5"/>
  <rect x="14" y="50" width="12" height="20" rx="3" fill="#e9ecef" stroke="${OL}" stroke-width="2.5"/>
  <path d="M50 60 L30 16 C60 28 76 42 82 60Z" fill="url(#ys)" ${S}/>
  <path d="M46 50 C58 44 66 46 72 52" fill="none" stroke="#d9cbb0" stroke-width="2.5"/>
  <circle cx="50" cy="60" r="6" fill="${PAINT.wood}" stroke="${OL}" stroke-width="3"/>
  <path d="M8 44 C2 52 2 68 8 76" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`);

/** Klyaksa's ship: black sail with an ink blot. */
export const BLOT_SHIP = sideShip(
  '#3c3c5a',
  '#7b2cbf',
  '#2e2e4a',
  '#4a4a6e',
  `<path d="M172 104 c10 -14 26 0 16 12 c14 4 6 22 -8 16 c-2 14 -22 12 -20 -2 c-14 0 -12 -20 2 -18 c-6 -6 4 -16 10 -8Z" fill="#7b2cbf" stroke="#c77dff" stroke-width="3"/>
   <circle cx="196" cy="140" r="4" fill="#7b2cbf"/><circle cx="160" cy="88" r="3" fill="#7b2cbf"/>
   <path d="M96 118 c6 -8 16 0 10 8 c8 4 2 14 -6 10 c-2 8 -14 6 -12 -2 c-8 -2 -4 -14 8 -16Z" fill="#7b2cbf" opacity=".8"/>`,
  '#7b2cbf',
);

export const BOTTLE = svg(200, 120, `
  <defs>${lin('gl', '#c4f1f4', '#5fb3b8')}${lin('pp', '#fff8e1', '#f1dca7')}</defs>
  <ellipse cx="100" cy="92" rx="88" ry="8" fill="#1d1f3a" opacity=".15"/>
  <path d="M20 40 H120 C140 40 150 50 160 54 H184 V66 H160 C150 70 140 80 120 80 H20 C8 80 8 40 20 40Z" fill="url(#gl)" fill-opacity=".92" ${S}/>
  <path d="M38 48 C34 56 34 64 38 72 H112 C116 64 116 56 112 48Z" fill="url(#pp)" stroke="${OL}" stroke-width="3"/>
  <path d="M38 48 C42 54 42 66 38 72 M112 48 C108 54 108 66 112 72" fill="none" stroke="#c9a66b" stroke-width="3"/>
  <path d="M52 56 H98 M52 62 H90 M52 68 H94" stroke="#9c6644" stroke-width="2" stroke-linecap="round" opacity=".7"/>
  <path d="M74 72 L70 84 M80 72 L84 84" stroke="#e63946" stroke-width="3" stroke-linecap="round"/>
  <rect x="180" y="50" width="14" height="20" rx="3" fill="${PAINT.wood}" stroke="${OL}" stroke-width="4"/>
  <path d="M184 52 v16" stroke="${PAINT.woodDark}" stroke-width="2"/>
  ${shine('M30 46 C50 43 80 43 100 44', 5, 0.9)}
  ${shine('M130 50 C140 52 148 56 156 58', 3, 0.8)}
  <path d="M24 76 H118" stroke="#2a7f86" stroke-width="3" opacity=".5"/>`);

export const COIN = svg(80, 80, `
  <defs>${vol('co', '#ffc94a', 0.5, 0.2)}</defs>
  <circle cx="40" cy="40" r="32" fill="url(#co)" ${S}/>
  <circle cx="40" cy="40" r="22" fill="none" stroke="#e09f3e" stroke-width="4"/>
  <path d="M40 26 l4 9 l10 1 l-8 6 l3 10 l-9 -6 l-9 6 l3 -10 l-8 -6 l10 -1Z" fill="#e09f3e"/>
  ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    .map((a) => {
      const r = (a * Math.PI) / 180;
      return `<circle cx="${(40 + Math.cos(r) * 27).toFixed(1)}" cy="${(40 + Math.sin(r) * 27).toFixed(1)}" r="1.4" fill="#c47f17"/>`;
    })
    .join('')}
  ${shine('M24 24 C30 18 40 16 48 18', 5, 0.9)}
  <path d="M60 14 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2Z" fill="#fff"/>`);

export const REEF = svg(80, 80, `
  <defs>${lin('rf', '#8d99a6', '#495057')}</defs>
  <path d="M6 70 L18 30 L30 46 L42 14 L56 40 L66 26 L76 70Z" fill="url(#rf)" ${S}/>
  <path d="M42 14 L46 70 L56 40Z M18 30 L22 70 L30 46Z" fill="#343a40" opacity=".35"/>
  <path d="M20 44 L28 52 M44 26 L48 40" stroke="#ced4da" stroke-width="4" stroke-linecap="round"/>
  <path d="M10 60 c4 -6 8 -6 10 0 M56 60 c4 -6 8 -6 10 0" fill="#52b788" stroke="#2d6a4f" stroke-width="2"/>
  <circle cx="34" cy="58" r="3" fill="#f4a261"/>
  <path d="M2 72 C16 64 26 78 40 70 C54 62 64 78 78 70" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
  <circle cx="10" cy="64" r="2.5" fill="#fff"/><circle cx="70" cy="62" r="2" fill="#fff"/>`);

/** Course goal: a buoy with a pennant, so the goal never looks like a random flag. */
export const GOAL_BUOY = svg(80, 80, `
  <defs>${vol('gb', PAINT.red, 0.35, 0.25)}</defs>
  <path d="M40 8 V44" stroke="${OL}" stroke-width="5"/>
  <path d="M42 8 C52 6 58 14 70 14 C62 20 54 26 42 28Z" fill="${PAINT.gold}" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M18 70 C18 44 62 44 62 70Z" fill="url(#gb)" ${S}/>
  <path d="M22 58 H58" stroke="#fff" stroke-width="7"/>
  <circle cx="40" cy="46" r="4" fill="${PAINT.gold}" stroke="${OL}" stroke-width="2.5"/>
  <path d="M4 72 C16 66 26 78 40 72 C54 66 64 78 76 72" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`);

export const CRATE = svg(100, 100, `
  <defs>${lin('cr', '#e3b884', '#b9834e')}</defs>
  <rect x="8" y="8" width="84" height="84" rx="6" fill="url(#cr)" ${S}/>
  <path d="M8 36 H92 M8 64 H92" stroke="#9c6b3c" stroke-width="2.5"/>
  <path d="M14 14 L86 86 M86 14 L14 86" stroke="${OL}" stroke-width="13" stroke-linecap="round"/>
  <path d="M14 14 L86 86 M86 14 L14 86" stroke="#a5683a" stroke-width="7" stroke-linecap="round"/>
  <rect x="8" y="8" width="84" height="84" rx="6" fill="none" ${S}/>
  <rect x="15" y="15" width="70" height="70" rx="3" fill="none" stroke="#7a4a24" stroke-width="2" opacity=".5"/>
  <circle cx="16" cy="16" r="3" fill="#4a4e69"/><circle cx="84" cy="16" r="3" fill="#4a4e69"/><circle cx="16" cy="84" r="3" fill="#4a4e69"/><circle cx="84" cy="84" r="3" fill="#4a4e69"/>
  ${shine('M16 22 V50', 4, 0.45)}`);

/** An island for the map, in a few looks. */
export function islandSvg(kind: number, visited: boolean): string {
  const sand = visited ? PAINT.sand : '#e9d8a6';
  const extra = [
    // 0: palm
    `<path d="M96 70 C92 50 96 36 104 26" fill="none" stroke="${OL}" stroke-width="10" stroke-linecap="round"/>
     <path d="M96 70 C92 50 96 36 104 26" fill="none" stroke="${PAINT.wood}" stroke-width="4" stroke-linecap="round"/>
     <path d="M104 26 C84 10 64 16 54 32 C72 26 86 26 104 26Z M104 26 C124 8 146 14 152 32 C136 26 120 26 104 26Z M104 26 C96 10 104 0 116 2 C108 10 106 18 104 26Z" fill="${PAINT.leafLight}" ${S4}/>
     <circle cx="100" cy="30" r="4" fill="#8d5524" stroke="${OL}" stroke-width="2"/>
     <path d="M126 72 c4 -8 10 -8 14 0" fill="#57cc99" stroke="${OL}" stroke-width="3"/>`,
    // 1: barrels
    `<rect x="70" y="40" width="26" height="32" rx="6" fill="${PAINT.wood}" ${S4}/><rect x="100" y="44" width="26" height="28" rx="6" fill="${PAINT.wood}" ${S4}/>
     <path d="M70 50 H96 M70 62 H96 M100 54 H126 M100 64 H126" stroke="${PAINT.red}" stroke-width="3"/>
     <rect x="128" y="56" width="16" height="16" fill="#d4a373" stroke="${OL}" stroke-width="3"/>`,
    // 2: fog rocks
    `<path d="M70 72 L84 36 L96 52 L108 30 L124 72Z" fill="#6c757d" ${S4}/><path d="M108 30 L112 72 L124 72Z" fill="#495057"/>
     <g fill="#fff" opacity=".7"><ellipse cx="80" cy="44" rx="20" ry="7"/><ellipse cx="118" cy="38" rx="16" ry="6"/></g>`,
    // 3: fort
    `<path d="M66 72 V40 H76 V48 H86 V40 H96 V48 H106 V40 H116 V48 H126 V40 H136 V72Z" fill="#b08968" ${S4}/>
     <path d="M66 56 H136 M84 56 V72 M118 56 V72" stroke="#7f5539" stroke-width="2"/>
     <path d="M94 72 V62 a7 7 0 0 1 14 0 V72Z" fill="#3d2b1f"/>
     <path d="M101 40 V20" stroke="${OL}" stroke-width="3"/><path d="M102 20 L116 25 L102 30Z" fill="${PAINT.gold}" stroke="${OL}" stroke-width="2"/>`,
    // 4: ink island
    `<path d="M80 72 C70 50 90 30 104 40 C118 26 140 46 128 72Z" fill="#22223b" ${S4}/><circle cx="104" cy="50" r="8" fill="#c77dff"/>
     <circle cx="88" cy="60" r="3" fill="#7b2cbf"/><circle cx="120" cy="56" r="4" fill="#7b2cbf"/>`,
  ][kind % 5];
  return svg(200, 120, `
    <defs>${lin('is', tone(sand, 0.2), tone(sand, -0.15))}</defs>
    <ellipse cx="100" cy="92" rx="94" ry="26" fill="#5fa8d3" opacity=".55"/>
    <ellipse cx="100" cy="90" rx="88" ry="20" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="10 8" opacity=".8"/>
    <path d="M18 88 C30 62 170 62 182 88 C160 104 40 104 18 88Z" fill="url(#is)" ${S}/>
    <path d="M30 90 C60 98 140 98 170 90" fill="none" stroke="${tone(sand, -0.3)}" stroke-width="3" opacity=".6"/>
    <path d="M40 78 C44 72 52 70 58 70" fill="#57cc99" stroke="${OL}" stroke-width="2" opacity="${visited ? 1 : 0.6}"/>
    ${extra}`);
}

/** Little town on a hill for the harbour: houses with roofs and lit windows. */
function town(): string {
  const r = seeded(7);
  const roofs = ['#e63946', '#f4a261', '#2a9d8f', '#e76f51', '#457b9d'];
  const walls = ['#fff1d0', '#f8edeb', '#ffe8d6', '#edf6f9'];
  let out = '';
  for (let i = 0; i < 9; i++) {
    const x = 150 + i * 50 + Math.floor(r() * 10);
    const h = 40 + Math.floor(r() * 26);
    const w = 40 + Math.floor(r() * 10);
    const base = 372 - Math.abs(i - 4) * 10;
    const y = base - h;
    out += `<rect x="${x}" y="${y}" width="${w}" height="${400 - y}" fill="${walls[i % walls.length]}" stroke="#5c677d" stroke-width="2.5"/>
      <path d="M${x - 5} ${y} L${x + w / 2} ${y - 22} L${x + w + 5} ${y}Z" fill="${roofs[i % roofs.length]}" stroke="#5c677d" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="${x + 8}" y="${y + 10}" width="10" height="12" fill="#8ecae6" stroke="#5c677d" stroke-width="1.5"/>
      <rect x="${x + w - 18}" y="${y + 10}" width="10" height="12" fill="#8ecae6" stroke="#5c677d" stroke-width="1.5"/>`;
  }
  return out;
}

export const HARBOR_BG = svg(1280, 720, `
  <defs>
    ${lin('sky', '#6fb7e0', '#e4f6ff', '#a8dbf5')}
    ${lin('sea', '#4a9ad4', '#123a5a', '#2a6fa8')}
    ${lin('hill1', '#9fd3a8', '#6fae84')}
    ${lin('hill2', '#6fbf73', '#3f8f5a')}
    ${lin('pier', '#b77b47', '#7a4a24')}
    <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c2"/><stop offset=".45" stop-color="#ffd166"/><stop offset=".7" stop-color="#ffd166" stop-opacity=".35"/><stop offset="1" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1280" height="420" fill="url(#sky)"/>
  <circle cx="1100" cy="110" r="130" fill="url(#sun)"/>
  <circle cx="1100" cy="110" r="54" fill="#ffd166" stroke="#f4a261" stroke-width="4"/>
  <circle cx="1084" cy="94" r="16" fill="#fff6c2" opacity=".8"/>
  ${cloud(270, 120, 1.1)}${cloud(720, 76, 0.8)}${cloud(470, 200, 0.55, 0.85)}${cloud(1240, 250, 0.6, 0.9)}
  ${farGull(560, 150)}${farGull(600, 170, 0.8)}${farGull(880, 120, 0.9)}
  <path d="M0 400 C120 330 260 320 380 350 C470 300 620 300 700 350 C760 330 840 340 900 400Z" fill="url(#hill1)"/>
  ${town()}
  <path d="M40 400 C160 360 320 360 520 384 C600 370 680 376 720 400Z" fill="url(#hill2)"/>
  <g>
    <path d="M1000 404 C1010 370 1060 360 1100 370 C1140 362 1180 380 1190 404Z" fill="#8d99ae" stroke="#4a4e69" stroke-width="4"/>
    <path d="M1076 372 L1084 250 H1116 L1124 372Z" fill="#fff" stroke="#4a4e69" stroke-width="4" stroke-linejoin="round"/>
    <path d="M1080 330 H1120 L1121 346 H1079Z M1082 290 H1118 L1119 306 H1081Z" fill="#e63946"/>
    <rect x="1078" y="236" width="44" height="16" fill="#4a4e69"/>
    <rect x="1086" y="214" width="28" height="22" fill="#ffe066" stroke="#4a4e69" stroke-width="4"/>
    <path d="M1080 214 L1100 196 L1120 214Z" fill="#e63946" stroke="#4a4e69" stroke-width="4" stroke-linejoin="round"/>
  </g>
  <g fill="#fff" stroke="#4a4e69" stroke-width="2.5" stroke-linejoin="round">
    <path d="M840 392 L840 360 L862 392Z"/><path d="M828 394 H866 L860 402 H834Z" fill="#e76f51"/>
    <path d="M560 396 L560 372 L576 396Z"/><path d="M552 397 H580 L576 403 H556Z" fill="#457b9d"/>
  </g>
  <rect y="400" width="1280" height="320" fill="url(#sea)"/>
  <path d="M0 402 H1280" stroke="#d9f1ff" stroke-width="3" opacity=".8"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${1070 + i * 12} ${420 + i * 40} h${40 - i * 2}" stroke="#fff6c2" stroke-width="4" stroke-linecap="round" opacity=".8"/>`).join('')}
  ${waveRow(0, 1280, 430, 80, 10, '#bde0fe', 4, 0.9)}
  ${waveRow(-40, 1280, 480, 120, 14, '#8ecae6', 5, 0.6)}
  ${waveRow(20, 760, 550, 140, 16, '#8ecae6', 5, 0.5)}
  ${waveRow(-20, 760, 630, 160, 18, '#5fa8d3', 6, 0.5)}
  ${waveRow(-60, 760, 700, 180, 20, '#5fa8d3', 6, 0.45)}
  <path d="M760 560 H1280 V720 H700Z" fill="url(#pier)" stroke="${OL}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M780 590 H1280 M770 630 H1280 M760 670 H1280 M745 704 H1280" stroke="#6b3f1d" stroke-width="4"/>
  ${[800, 870, 940, 1010, 1080, 1150, 1220]
    .map((x, i) => `<path d="M${x + (i % 2) * 20} ${575 + (i % 3) * 40} h18" stroke="#6b3f1d" stroke-width="3" stroke-linecap="round" opacity=".7"/><circle cx="${x + 30}" cy="${600 + (i % 2) * 40}" r="2.5" fill="#4a3020"/>`)
    .join('')}
  <path d="M760 560 H1280" stroke="#d9a066" stroke-width="5"/>
  ${[820, 960, 1100, 1240]
    .map(
      (x) => `<rect x="${x - 12}" y="540" width="24" height="180" rx="4" fill="#8a5a33" stroke="${OL}" stroke-width="5"/>
        <ellipse cx="${x}" cy="540" rx="12" ry="5" fill="#b77b47" stroke="${OL}" stroke-width="4"/>
        <path d="M${x - 12} 600 h24 M${x - 12} 608 h24" stroke="#d4a373" stroke-width="4"/>`,
    )
    .join('')}
  <path d="M832 556 C870 600 920 600 948 556" fill="none" stroke="#d4a373" stroke-width="6" stroke-linecap="round"/>
  <path d="M972 556 C1010 600 1060 600 1088 556" fill="none" stroke="#d4a373" stroke-width="6" stroke-linecap="round"/>
  <path d="M760 560 L700 720" stroke="${OL}" stroke-width="6"/>
  <ellipse cx="1000" cy="726" rx="300" ry="20" fill="#0b2a42" opacity=".4"/>`);

function compassRose(): string {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (i * Math.PI) / 8;
    const long = i % 4 === 0;
    const mid = i % 2 === 0;
    const len = long ? 66 : mid ? 44 : 30;
    const w = long ? 10 : 6;
    const x = Math.sin(a) * len;
    const y = -Math.cos(a) * len;
    const lx = Math.sin(a + Math.PI / 2) * w;
    const ly = -Math.cos(a + Math.PI / 2) * w;
    const fill = long ? (i === 0 ? '#e63946' : '#e9c46a') : mid ? '#f4e3b2' : '#c9a66b';
    return `<path d="M0 0 L${(lx).toFixed(1)} ${(ly).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}Z" fill="${fill}" stroke="#7a5c2e" stroke-width="2" stroke-linejoin="round"/>
            <path d="M0 0 L${(-lx).toFixed(1)} ${(-ly).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)}Z" fill="${tone(fill, -0.25)}" stroke="#7a5c2e" stroke-width="2" stroke-linejoin="round"/>`;
  })
    .reverse()
    .join('');
  const ticks = Array.from({ length: 32 }, (_, i) => {
    const a = (i * Math.PI) / 16;
    const r1 = 50;
    const r2 = i % 2 ? 54 : 58;
    return `M${(Math.sin(a) * r1).toFixed(1)} ${(-Math.cos(a) * r1).toFixed(1)} L${(Math.sin(a) * r2).toFixed(1)} ${(-Math.cos(a) * r2).toFixed(1)}`;
  }).join(' ');
  return `<g transform="translate(1170 610)" opacity=".92">
    <circle r="60" fill="#173f5f" fill-opacity=".5" stroke="#e9c46a" stroke-width="3"/>
    <circle r="50" fill="none" stroke="#e9c46a" stroke-width="2"/>
    <path d="${ticks}" stroke="#e9c46a" stroke-width="2"/>
    ${pts}
    <circle r="6" fill="#e9c46a" stroke="#7a5c2e" stroke-width="2"/>
    <path d="M-6 -78 V-90 L6 -78 V-90" fill="none" stroke="#e9c46a" stroke-width="3" stroke-linejoin="round"/>
  </g>`;
}

export const SEA_BG = svg(1280, 720, (() => {
  const r = seeded(11);
  let waves = '';
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(r() * 1240);
    const y = Math.floor(r() * 700);
    const s = 0.6 + r() * 0.9;
    const op = (0.35 + r() * 0.45).toFixed(2);
    waves += `<path d="M${x} ${y} q${10 * s} ${-7 * s} ${20 * s} 0 t${20 * s} 0" fill="none" stroke="#7fc4ea" stroke-width="${(3 + s).toFixed(1)}" stroke-linecap="round" opacity="${op}"/>`;
  }
  let foam = '';
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * 1240);
    const y = Math.floor(r() * 680);
    foam += `<path d="M${x} ${y} c6 -6 14 -6 20 0 c-6 3 -14 3 -20 0Z" fill="#e0f4ff" opacity=".55"/><circle cx="${x + 26}" cy="${y - 2}" r="2" fill="#e0f4ff" opacity=".6"/>`;
  }
  return `
  <defs>
    <radialGradient id="s" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#3a82b8"/><stop offset=".6" stop-color="#245f8f"/><stop offset="1" stop-color="#123352"/></radialGradient>
    <radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5fb8de" stop-opacity=".45"/><stop offset="1" stop-color="#5fb8de" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#s)"/>
  <ellipse cx="300" cy="260" rx="260" ry="160" fill="url(#sh)"/>
  <ellipse cx="900" cy="420" rx="320" ry="180" fill="url(#sh)"/>
  <ellipse cx="640" cy="120" rx="220" ry="90" fill="url(#sh)"/>
  <g stroke="#9fd3f0" stroke-width="1.5" opacity=".12">
    ${[160, 320, 480, 640, 800, 960, 1120].map((x) => `<path d="M${x} 0 V720"/>`).join('')}
    ${[120, 240, 360, 480, 600].map((y) => `<path d="M0 ${y} H1280"/>`).join('')}
  </g>
  ${waves}${foam}
  ${compassRose()}
  <rect width="1280" height="720" fill="none" stroke="#0b2236" stroke-width="40" opacity=".25"/>`;
})());

function shoreScatter(): string {
  const r = seeded(23);
  let out = '';
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r() * 1280);
    const y = 300 + Math.floor(r() * 420);
    out += `<circle cx="${x}" cy="${y}" r="${(1.5 + r() * 2.5).toFixed(1)}" fill="${r() > 0.5 ? '#e0b96a' : '#fbe7b5'}"/>`;
  }
  return out;
}

const shell = (x: number, y: number, rot: number, c: string) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 C-16 -2 -18 -22 0 -26 C18 -22 16 -2 0 0Z" fill="${c}" stroke="#9c6644" stroke-width="3"/><path d="M0 -2 V-22 M-6 -4 L-10 -20 M6 -4 L10 -20" stroke="#9c6644" stroke-width="2"/></g>`;
const starfish = (x: number, y: number, rot: number) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 -24 L7 -8 L24 -7 L11 4 L15 21 L0 12 L-15 21 L-11 4 L-24 -7 L-7 -8Z" fill="#f4845f" stroke="#9c3d1f" stroke-width="3" stroke-linejoin="round"/><circle cx="0" cy="-12" r="2" fill="#ffd6a5"/><circle cx="9" cy="-3" r="2" fill="#ffd6a5"/><circle cx="-9" cy="-3" r="2" fill="#ffd6a5"/><circle cx="6" cy="10" r="2" fill="#ffd6a5"/><circle cx="-6" cy="10" r="2" fill="#ffd6a5"/></g>`;

function edgePalm(x: number, flip: boolean): string {
  const f = flip ? -1 : 1;
  return `<g transform="translate(${x} 30) scale(${f * 0.8} 0.8)">
    <path d="M-10 900 C30 600 60 460 130 330" fill="none" stroke="${OL}" stroke-width="40" stroke-linecap="round"/>
    <path d="M-10 900 C30 600 60 460 130 330" fill="none" stroke="#a5683a" stroke-width="28" stroke-linecap="round"/>
    ${[380, 430, 480, 530, 580, 630, 680, 730, 780].map((y, i) => `<path d="M${88 - i * 11} ${y} q16 8 30 -4" fill="none" stroke="#7a4a24" stroke-width="4" stroke-linecap="round"/>`).join('')}
    ${frond(130, 330, 330, 360, -40, 40, '#3fb68b', '#1b6b5f')}
    ${frond(130, 330, 290, 230, 30, 34, '#57cc99', '#2a9d8f')}
    ${frond(130, 330, -20, 260, -30, 36, '#57cc99', '#2a9d8f')}
    ${frond(130, 330, 160, 170, -20, 30, '#7ee0a8', '#2a9d8f')}
    ${frond(130, 330, 20, 420, 30, 34, '#2a9d8f', '#1b6b5f')}
    <circle cx="122" cy="344" r="14" fill="#8d5524" ${S}/><circle cx="144" cy="348" r="14" fill="#8d5524" ${S}/>
  </g>`;
}

export const BEACH_BG = svg(1280, 720, `
  <defs>
    ${lin('sk', '#6fb7e0', '#e4f6ff', '#a8dbf5')}
    ${lin('sw', '#4a9ad4', '#7fcfe0')}
    ${lin('sd', '#f8e0a0', '#e9c46a')}
  </defs>
  <rect width="1280" height="260" fill="url(#sk)"/>
  ${cloud(300, 90, 0.9)}${cloud(860, 60, 0.7)}${cloud(1120, 150, 0.5, 0.85)}
  ${farGull(520, 90)}${farGull(560, 110, 0.7)}
  <path d="M760 204 C790 180 860 178 900 204Z" fill="#6fae84"/>
  <path d="M846 186 C840 170 846 160 852 152 M852 152 c-10 -8 -20 -4 -24 4 M852 152 c10 -8 20 -4 24 4" fill="none" stroke="#3f8f5a" stroke-width="4" stroke-linecap="round"/>
  <rect y="200" width="1280" height="90" fill="url(#sw)"/>
  <path d="M0 202 H1280" stroke="#d9f1ff" stroke-width="3"/>
  ${waveRow(0, 1280, 222, 70, 6, '#d9f1ff', 3, 0.7)}
  ${waveRow(-30, 1280, 248, 90, 8, '#e0f4ff', 3, 0.6)}
  <path d="M0 278 C200 248 400 288 640 270 C880 252 1080 288 1280 266 V300 C1080 318 880 284 640 302 C400 318 200 282 0 306Z" fill="#d9b56a" opacity=".7"/>
  <path d="M0 290 C200 262 400 300 640 282 C880 264 1080 300 1280 278 V720 H0Z" fill="url(#sd)"/>
  <path d="M0 272 C200 242 400 282 640 264 C880 246 1080 282 1280 260" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".9"/>
  <path d="M0 280 C200 252 400 292 640 274 C880 256 1080 292 1280 270" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 10" opacity=".7"/>
  ${shoreScatter()}
  <path d="M120 420 c20 -4 40 4 60 0 M980 470 c24 -6 48 4 70 -2 M420 640 c20 -4 40 4 60 0" fill="none" stroke="#d9a94f" stroke-width="4" stroke-linecap="round" opacity=".6"/>
  ${shell(240, 600, -20, '#ffd6e0')}${shell(1030, 640, 15, '#ffe5b4')}${shell(700, 690, 5, '#fff1e6')}
  ${starfish(1110, 540, 10)}${starfish(160, 680, -15)}
  <g><ellipse cx="1220" cy="700" rx="70" ry="30" fill="#8d99ae" stroke="${OL}" stroke-width="5"/><path d="M1170 690 C1190 676 1220 672 1250 680" fill="none" stroke="#ced4da" stroke-width="5" stroke-linecap="round"/></g>
  <path d="M60 712 c6 -22 12 -28 18 -6 c4 -18 12 -22 16 2 c6 -14 12 -12 12 6" fill="#57cc99" stroke="#2a9d8f" stroke-width="3"/>
  ${edgePalm(-60, false)}
  ${edgePalm(1340, true)}`);

export const NIGHT_BG = svg(1280, 720, (() => {
  const r = seeded(5);
  let stars = '';
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(r() * 1280);
    const y = Math.floor(r() * 440);
    const s = r();
    stars += s > 0.93
      ? `<path d="M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2}Z" fill="#fff6d5"/>`
      : `<circle cx="${x}" cy="${y}" r="${(0.8 + s * 1.8).toFixed(1)}" fill="#fff" opacity="${(0.4 + s * 0.6).toFixed(2)}"/>`;
  }
  return `
  <defs>
    ${lin('n', '#070d22', '#2a3a6b', '#121c3f')}
    ${lin('ns', '#1a2c55', '#050b1a')}
    <linearGradient id="beam" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ffe066" stop-opacity=".45"/><stop offset="1" stop-color="#ffe066" stop-opacity="0"/></linearGradient>
    <radialGradient id="mh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fdf0d5" stop-opacity=".45"/><stop offset="1" stop-color="#fdf0d5" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#n)"/>
  <path d="M0 260 C200 200 400 280 620 220 C820 170 1040 250 1280 200 V300 C1040 340 820 260 620 300 C400 340 200 290 0 320Z" fill="#6a7bc4" opacity=".05"/>
  ${stars}
  <circle cx="1060" cy="120" r="140" fill="url(#mh)"/>
  <circle cx="1060" cy="120" r="56" fill="#fdf0d5"/>
  <circle cx="1040" cy="104" r="10" fill="#e9dcc0"/><circle cx="1078" cy="140" r="14" fill="#e9dcc0"/><circle cx="1084" cy="96" r="6" fill="#e9dcc0"/><circle cx="1040" cy="146" r="5" fill="#e9dcc0"/>
  <g fill="#3a4a7a" opacity=".85">
    <ellipse cx="300" cy="140" rx="110" ry="18"/><ellipse cx="340" cy="126" rx="60" ry="18"/>
    <ellipse cx="900" cy="230" rx="90" ry="14"/><ellipse cx="930" cy="220" rx="44" ry="14"/>
  </g>
  <path d="M620 470 C680 446 740 450 780 462 C820 444 880 448 920 470Z" fill="#0e1631"/>
  <path d="M758 452 L762 384 H778 L782 452Z" fill="#c9d1e6"/><path d="M760 420 H780 M761 400 H779" stroke="#e63946" stroke-width="6"/><rect x="758" y="374" width="24" height="12" fill="#1b2445"/>
  <circle cx="770" cy="368" r="9" fill="#ffe066"/>
  <path d="M770 368 L450 334 L450 404Z" fill="url(#beam)"/>
  <rect y="470" width="1280" height="250" fill="url(#ns)"/>
  ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${1030 - i * 4 + (i % 2) * 16} ${490 + i * 32} h${60 + i * 8}" stroke="#fdf0d5" stroke-width="${4 - i * 0.3}" stroke-linecap="round" opacity="${(0.8 - i * 0.08).toFixed(2)}"/>`).join('')}
  ${waveRow(0, 1280, 480, 80, 8, '#415a77', 4, 0.9)}
  ${waveRow(-40, 1280, 540, 120, 12, '#2c4466', 4, 0.8)}
  ${waveRow(-10, 1280, 620, 150, 14, '#22385a', 5, 0.8)}
  ${waveRow(-60, 1280, 700, 180, 16, '#1c2e4e', 5, 0.8)}`;
})());

/** A seagull with wings up, seen from the side; it carries a letter sign under it (drawn by the scene). */
export const GULL = svg(160, 110, `
  <defs>${lin('gw', '#ffffff', '#cfd6de')}${vol('gb', '#ffffff', 0.2, 0.18)}</defs>
  <path d="M80 62 C60 30 34 16 8 22 C34 30 52 46 62 66Z" fill="url(#gw)" ${S}/>
  <path d="M80 62 C100 30 126 16 152 22 C126 30 108 46 98 66Z" fill="url(#gw)" ${S}/>
  <path d="M62 50 C52 40 42 34 30 30 M98 50 C108 40 118 34 130 30" fill="none" stroke="#aab4c0" stroke-width="3" stroke-linecap="round"/>
  <path d="M8 22 C20 22 28 26 32 30" fill="none" stroke="#495057" stroke-width="7" stroke-linecap="round"/>
  <path d="M152 22 C140 22 132 26 128 30" fill="none" stroke="#495057" stroke-width="7" stroke-linecap="round"/>
  <path d="M52 72 L34 78 L50 82Z" fill="#dee2e6" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
  <ellipse cx="80" cy="70" rx="30" ry="18" fill="url(#gb)" ${S}/>
  <circle cx="104" cy="58" r="14" fill="url(#gb)" ${S}/>
  <path d="M116 56 L138 62 L130 66 L116 68Z" fill="${PAINT.gold}" stroke="${OL}" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="132" cy="64" r="2" fill="#e63946"/>
  <circle cx="106" cy="55" r="4" fill="${OL}"/><circle cx="107.5" cy="53.5" r="1.4" fill="#fff"/>
  <path d="M74 88 v8 M86 88 v8" stroke="#f4a261" stroke-width="4" stroke-linecap="round"/>`);

export const BUOY_PAINT = { red: PAINT.red, blue: PAINT.blue, yellow: PAINT.gold, green: PAINT.green } as const;

/** Pattern buoys: three shapes a child can tell apart and name (ball, cone, barrel-can). */
export function buoySvg(color: string, shape: 'round' | 'cone' | 'can'): string {
  const defs = `<defs>${vol('bv', color, 0.35, 0.28)}${cyl('bc', color)}</defs>`;
  const body =
    shape === 'round'
      ? `<circle cx="60" cy="70" r="40" fill="url(#bv)" ${S}/><path d="M22 70 C40 78 80 78 98 70" fill="none" stroke="#fff" stroke-width="8"/>${shine('M40 46 C46 40 54 36 62 36', 6, 0.6)}`
      : shape === 'cone'
        ? `<path d="M60 22 L100 104 H20Z" fill="url(#bc)" ${S}/><path d="M38 80 H82" stroke="#fff" stroke-width="8"/>${shine('M54 40 L40 70', 5, 0.55)}`
        : `<rect x="26" y="34" width="68" height="70" rx="8" fill="url(#bc)" ${S}/><path d="M26 66 H94" stroke="#fff" stroke-width="8"/><ellipse cx="60" cy="36" rx="30" ry="5" fill="${tone(color, 0.3)}" stroke="${OL}" stroke-width="3"/>`;
  return svg(120, 130, `
    ${defs}
    ${body}
    <path d="M60 22 V10" stroke="${OL}" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="9" r="4" fill="${PAINT.gold}" stroke="${OL}" stroke-width="2.5"/>
    <path d="M8 116 C24 106 38 124 60 114 C82 104 96 124 112 114" fill="none" stroke="#bde0fe" stroke-width="6" stroke-linecap="round"/>
    <circle cx="16" cy="108" r="2.5" fill="#e0f4ff"/><circle cx="104" cy="106" r="2" fill="#e0f4ff"/>`);
}
