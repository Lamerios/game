/** The crew and the island folk (scenario v0.2). All original characters.
 *  Detailed pass: soft volume gradients, a cel shadow on the body, and small
 *  telling details (feathers, rivets, fur tufts, suction cups). */
import { cyl, lin, shine, vol } from './kit';
import { OL, svg } from './objects';

const S = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const S4 = `stroke="${OL}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const eye = (x: number, y: number, r = 12) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${S}/><circle cx="${x + 2}" cy="${y + 1}" r="${r * 0.5}" fill="#3d2b1f"/><circle cx="${x + 2}" cy="${y + 1}" r="${r * 0.3}" fill="${OL}"/><circle cx="${x + 4.5}" cy="${y - 2.5}" r="${r * 0.2}" fill="#fff"/><circle cx="${x - 1}" cy="${y + 4}" r="${r * 0.09}" fill="#fff"/>`;
const blush = (x: number, y: number, rx = 10, ry = 6) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#ff8fa3" opacity=".55"/>`;
const shadowUnder = (cx: number, cy: number, rx: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx / 7}" fill="#1d1f3a" opacity=".16"/>`;

/** Rumb: the navigator parrot. */
const rumb = svg(220, 220, `
  <defs>${vol('rb', '#e63946')}${vol('rh', '#ef4b57', 0.4, 0.25)}${lin('rw', '#5fd0a8', '#2a8a6e')}${lin('rt', '#3a9ad0', '#1d5f86')}${lin('rk', '#ffe08a', '#f4a261')}</defs>
  ${shadowUnder(112, 214, 50)}
  <path d="M70 176 C86 200 104 214 116 216 C110 196 106 186 102 176Z" fill="url(#rt)" ${S}/>
  <path d="M86 178 C98 198 108 208 116 214 M78 178 C90 196 100 206 108 212" fill="none" stroke="#1d4f70" stroke-width="2.5"/>
  <path d="M100 176 C110 198 120 208 132 214 C130 196 124 186 118 176Z" fill="#ffd166" ${S4}/>
  <path d="M96 172 L86 212 M124 172 L132 212" stroke="${OL}" stroke-width="9" stroke-linecap="round"/>
  <path d="M96 172 L86 212 M124 172 L132 212" stroke="#8d99ae" stroke-width="4" stroke-linecap="round"/>
  <path d="M78 212 h18 M124 212 h18" stroke="${OL}" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="110" cy="128" rx="54" ry="62" fill="url(#rb)" ${S}/>
  <path d="M150 104 C164 130 160 166 132 184 C150 160 152 130 142 108Z" fill="#b5202d" opacity=".45"/>
  <path d="M90 150 C98 172 120 182 142 170 C130 160 112 150 96 140Z" fill="#ffd166" opacity=".9"/>
  <path d="M92 140 C100 160 120 170 140 160" fill="none" stroke="#ffd166" stroke-width="18" stroke-linecap="round"/>
  <path d="M98 152 q8 6 16 4 M110 162 q8 4 16 0" fill="none" stroke="#f4a261" stroke-width="3" stroke-linecap="round"/>
  <path d="M74 120 C60 150 70 176 96 184 C92 160 92 140 98 118Z" fill="url(#rw)" ${S}/>
  <path d="M78 138 C80 150 84 162 92 172 M86 128 C86 142 88 156 94 168" fill="none" stroke="#1f6b55" stroke-width="3" stroke-linecap="round"/>
  <path d="M70 162 C76 172 86 180 96 184 C86 178 80 172 76 164Z" fill="#277da1" ${S4}/>
  <circle cx="112" cy="64" r="44" fill="url(#rh)" ${S}/>
  <path d="M98 24 C96 8 112 2 116 20 C122 4 140 10 130 28" fill="url(#rk)" ${S}/>
  <path d="M106 22 C104 14 108 10 112 14" fill="none" stroke="#f4a261" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="128" cy="62" rx="20" ry="18" fill="#fff" opacity=".9"/>
  <path d="M114 50 q4 -2 8 0 M134 72 q4 -2 8 0 M116 74 q4 -2 8 0" fill="none" stroke="#e63946" stroke-width="2" stroke-linecap="round" opacity=".6"/>
  ${eye(126, 58, 13)}
  <path d="M112 42 C120 38 130 38 138 44" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>
  <path d="M140 70 C172 68 178 94 160 106 C156 92 148 86 136 86Z" fill="url(#rk)" ${S}/>
  <path d="M138 86 C148 88 154 96 156 104 C148 102 142 96 138 90Z" fill="#e09f3e" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M150 74 C158 74 164 80 166 86" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  ${blush(104, 82, 9, 5)}
  ${shine('M80 30 C66 40 66 56 70 64', 7, 0.45)}
  ${shine('M70 96 C64 110 62 124 64 136', 6, 0.35)}
`);

/** Pykhtelkin: the galley kettle who tells sea facts. */
const kettle = svg(220, 220, `
  <defs>
    <linearGradient id="kb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa5b1"/><stop offset=".25" stop-color="#f1f3f5"/><stop offset=".45" stop-color="#ced4da"/><stop offset=".8" stop-color="#adb5bd"/><stop offset="1" stop-color="#6c757d"/></linearGradient>
    ${lin('kl', '#e9ecef', '#8d99ae')}${vol('kn', '#e63946', 0.45, 0.25)}
  </defs>
  ${shadowUnder(110, 206, 80)}
  <g fill="#fff" opacity=".85"><circle cx="18" cy="74" r="10"/><circle cx="8" cy="56" r="8"/><circle cx="20" cy="40" r="6"/></g>
  <path d="M150 112 C196 112 200 160 160 170" fill="none" stroke="${OL}" stroke-width="18" stroke-linecap="round"/>
  <path d="M150 112 C190 112 194 156 160 166" fill="none" stroke="#2b2d42" stroke-width="10" stroke-linecap="round"/>
  <path d="M154 114 C186 116 190 150 162 162" fill="none" stroke="#6c757d" stroke-width="4" stroke-linecap="round"/>
  <path d="M58 132 L18 94 L30 84 L72 112Z" fill="url(#kl)" ${S}/>
  <path d="M24 90 L60 120" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M40 200 C26 150 48 92 110 92 C172 92 194 150 180 200Z" fill="url(#kb)" ${S}/>
  <path d="M46 176 C80 186 140 186 174 176" fill="none" stroke="#868e96" stroke-width="4" opacity=".7"/>
  <path d="M62 120 C70 106 84 100 98 98" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
  <path d="M52 150 C52 140 54 132 58 126" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".8"/>
  <ellipse cx="110" cy="94" rx="54" ry="13" fill="url(#kl)" ${S}/>
  <path d="M70 92 C90 86 130 86 150 92" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>
  <path d="M100 82 V72 H120 V82" fill="#495057" ${S4}/>
  <circle cx="110" cy="68" r="14" fill="url(#kn)" ${S}/>
  <circle cx="105" cy="63" r="4" fill="#fff" opacity=".7"/>
  ${eye(90, 140, 13)}${eye(130, 140, 13)}
  <path d="M78 122 q10 -6 20 0 M122 122 q10 -6 20 0" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round"/>
  <path d="M90 166 C102 180 118 180 130 166 C120 172 100 172 90 166Z" fill="#9d0208" ${S4}/>
  ${blush(70, 164)}${blush(150, 164)}
  <path d="M30 200 H190" ${S}/>
  <rect x="52" y="200" width="16" height="8" rx="3" fill="#495057"/><rect x="152" y="200" width="16" height="8" rx="3" fill="#495057"/>`);

/** Boltik: raccoon mechanic with goggles and a wrench. */
const raccoon = svg(220, 220, `
  <defs>${vol('rf', '#b8c0c8', 0.35, 0.25)}${lin('ro', '#5a95bd', '#2f5f80')}${cyl('rw', '#ced4da')}${vol('rg', '#a8dadc', 0.5, 0.15)}</defs>
  ${shadowUnder(110, 214, 70)}
  <path d="M150 170 C200 160 206 120 188 100" fill="none" stroke="${OL}" stroke-width="28" stroke-linecap="round"/>
  <path d="M150 170 C196 160 200 124 186 104" fill="none" stroke="#c9d1d9" stroke-width="18" stroke-linecap="round"/>
  <path d="M150 170 C196 160 200 124 186 104" fill="none" stroke="#3d4248" stroke-width="18" stroke-linecap="butt" stroke-dasharray="10 12"/>
  <path d="M60 214 C56 160 70 130 110 130 C150 130 164 160 160 214Z" fill="url(#ro)" ${S}/>
  <path d="M82 136 V176 M138 136 V176" stroke="${OL}" stroke-width="4"/>
  <circle cx="84" cy="150" r="4" fill="#ffd166" stroke="${OL}" stroke-width="2"/><circle cx="136" cy="150" r="4" fill="#ffd166" stroke="${OL}" stroke-width="2"/>
  <rect x="94" y="152" width="32" height="26" rx="4" fill="#ffd166" ${S4}/>
  <path d="M100 160 H120" stroke="#c98a00" stroke-width="3"/>
  <path d="M74 196 l6 -6 M140 200 l6 -6" stroke="#cfe3f0" stroke-width="3" stroke-linecap="round" opacity=".6"/>
  <path d="M40 60 L58 16 L86 50Z M180 60 L162 16 L134 50Z" fill="#8d99ae" ${S}/>
  <path d="M54 50 L60 30 L72 46Z M166 50 L160 30 L148 46Z" fill="#f4acb7"/>
  <ellipse cx="110" cy="84" rx="70" ry="56" fill="url(#rf)" ${S}/>
  <path d="M42 100 l-8 6 l10 2 l-6 8 l12 -2 M178 100 l8 6 l-10 2 l6 8 l-12 -2" fill="#c9d1d9" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M96 30 l6 -10 l4 10 l6 -8 l2 10" fill="none" stroke="${OL}" stroke-width="3" stroke-linejoin="round"/>
  <path d="M46 86 C70 62 150 62 174 86 C160 104 130 100 110 96 C90 100 60 104 46 86Z" fill="#343a40"/>
  <path d="M48 78 H172" stroke="#6b4f2a" stroke-width="7" stroke-linecap="round"/>
  <circle cx="80" cy="82" r="19" fill="#ffd166" ${S4}/><circle cx="140" cy="82" r="19" fill="#ffd166" ${S4}/>
  <circle cx="80" cy="82" r="13" fill="url(#rg)" stroke="${OL}" stroke-width="2"/><circle cx="140" cy="82" r="13" fill="url(#rg)" stroke="${OL}" stroke-width="2"/>
  <circle cx="82" cy="82" r="6" fill="${OL}"/><circle cx="142" cy="82" r="6" fill="${OL}"/>
  <circle cx="84" cy="79" r="2" fill="#fff"/><circle cx="144" cy="79" r="2" fill="#fff"/>
  <path d="M74 76 l6 -4 M134 76 l6 -4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M99 82 H121" stroke="${OL}" stroke-width="5"/>
  <ellipse cx="110" cy="116" rx="30" ry="19" fill="#f8f9fa" ${S}/>
  <ellipse cx="110" cy="106" rx="8" ry="6" fill="${OL}"/><circle cx="107" cy="104" r="2" fill="#fff"/>
  <path d="M100 120 C106 127 114 127 120 120" fill="none" stroke="${OL}" stroke-width="4" stroke-linecap="round"/>
  <path d="M106 124 v5 h8 v-5" fill="#fff" stroke="${OL}" stroke-width="2"/>
  <path d="M30 150 L64 120" stroke="${OL}" stroke-width="14" stroke-linecap="round"/>
  <path d="M30 150 L64 120" stroke="url(#rw)" stroke-width="7" stroke-linecap="round"/>
  <path d="M18 146 a13 13 0 1 0 20 16 l-6 -6 l-4 -10Z" fill="#ced4da" ${S4}/>
  <ellipse cx="66" cy="120" rx="10" ry="8" fill="url(#rf)" ${S4}/>`);

/** Strelka: the little compass robot. `parts` 0..4 shows how much is rebuilt. */
export function strelkaSvg(parts: number): string {
  const lit = (n: number, on: string, off = '#6c757d') => (parts >= n ? on : off);
  return svg(220, 220, `
    <defs>${vol('sb', '#f1f3f5', 0.6, 0.25)}${lin('ss', '#2e2e52', '#14142a')}${vol('sl', lit(2, '#ffd166'), 0.5, 0.2)}</defs>
    ${shadowUnder(110, 216, 46)}
    ${parts >= 2 ? `<circle cx="110" cy="16" r="18" fill="#ffd166" opacity=".3"/>` : ''}
    <path d="M110 18 V40" ${S}/><circle cx="110" cy="16" r="9" fill="url(#sl)" ${S}/>
    <rect x="44" y="40" width="132" height="100" rx="28" fill="url(#sb)" ${S}/>
    <circle cx="58" cy="128" r="3" fill="#adb5bd"/><circle cx="162" cy="128" r="3" fill="#adb5bd"/>
    <rect x="62" y="58" width="96" height="62" rx="16" fill="url(#ss)" ${S}/>
    <path d="M72 66 C84 62 100 62 110 64" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".25"/>
    ${parts >= 1 ? `<circle cx="90" cy="88" r="16" fill="#4cc9f0" opacity=".25"/><circle cx="130" cy="88" r="16" fill="#4cc9f0" opacity=".25"/><circle cx="90" cy="88" r="12" fill="#4cc9f0"/><circle cx="130" cy="88" r="12" fill="#4cc9f0"/><circle cx="94" cy="84" r="4" fill="#fff"/><circle cx="134" cy="84" r="4" fill="#fff"/><path d="M98 106 q12 6 24 0" fill="none" stroke="#4cc9f0" stroke-width="3" stroke-linecap="round"/>` : `<path d="M80 88 H100 M120 88 H140" stroke="#6c757d" stroke-width="6" stroke-linecap="round"/>`}
    <rect x="96" y="138" width="28" height="10" fill="#adb5bd" stroke="${OL}" stroke-width="3"/>
    <circle cx="110" cy="174" r="40" fill="url(#sb)" ${S}/>
    <circle cx="110" cy="174" r="28" fill="#fff" stroke="${OL}" stroke-width="4"/>
    <path d="M110 148 V154 M110 194 V200 M84 174 H90 M130 174 H136" stroke="${OL}" stroke-width="3" stroke-linecap="round"/>
    ${parts >= 3 ? `<path d="M110 150 L118 174 L110 198 L102 174Z" fill="#e63946" stroke="${OL}" stroke-width="3"/><path d="M110 198 L118 174 L102 174Z" fill="#adb5bd"/><circle cx="110" cy="174" r="3" fill="${OL}"/>` : `<circle cx="110" cy="174" r="5" fill="#adb5bd"/>`}
    <path d="M44 100 C20 100 18 130 30 140 M176 100 C200 100 202 130 190 140" fill="none" stroke="${OL}" stroke-width="12" stroke-linecap="round"/>
    <path d="M44 100 C20 100 18 130 30 140 M176 100 C200 100 202 130 190 140" fill="none" stroke="#ced4da" stroke-width="5" stroke-linecap="round"/>
    <circle cx="30" cy="142" r="7" fill="#adb5bd" ${S4}/><circle cx="190" cy="142" r="7" fill="#adb5bd" ${S4}/>
    ${parts >= 4 ? `<circle cx="60" cy="52" r="6" fill="#80ffdb"/><circle cx="160" cy="52" r="6" fill="#80ffdb"/><circle cx="60" cy="52" r="11" fill="#80ffdb" opacity=".3"/><circle cx="160" cy="52" r="11" fill="#80ffdb" opacity=".3"/>` : ''}
    ${shine('M56 56 C60 48 68 44 78 44', 6, 0.8)}`);
}

/** Captain Klyaksa: a funny ink octopus pirate. Not scary on purpose. */
const blot = svg(240, 220, `
  <defs>${vol('bo', '#8a3fd1', 0.3, 0.3)}${lin('bh', '#3a3a5c', '#16162a')}</defs>
  ${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const x = 40 + i * 23;
      const dir = i % 2 ? 1 : -1;
      const d = `M${x} 140 C${x + dir * 10} 170 ${x - dir * 16} 190 ${x + dir * 6} 212`;
      return `<path d="${d}" fill="none" stroke="${OL}" stroke-width="22" stroke-linecap="round"/>
              <path d="${d}" fill="none" stroke="#7b2cbf" stroke-width="12" stroke-linecap="round"/>
              <circle cx="${x + dir * 2}" cy="176" r="3" fill="#e0aaff"/><circle cx="${x - dir * 2}" cy="192" r="2.5" fill="#e0aaff"/>`;
    })
    .join('')}
  <path d="M28 150 C10 60 60 26 120 26 C180 26 230 60 212 150Z" fill="url(#bo)" ${S}/>
  <path d="M190 70 C210 100 214 130 208 148 H176 C196 120 196 92 190 70Z" fill="#4a1a80" opacity=".4"/>
  <path d="M54 70 C70 48 96 40 120 40" fill="none" stroke="#c77dff" stroke-width="10" stroke-linecap="round"/>
  <circle cx="160" cy="70" r="10" fill="#c77dff"/><circle cx="60" cy="120" r="8" fill="#c77dff"/><circle cx="176" cy="126" r="6" fill="#c77dff"/><circle cx="46" cy="96" r="4" fill="#c77dff"/>
  ${eye(92, 100, 17)}
  <path d="M74 78 q16 -10 32 -2" fill="none" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>
  <path d="M128 84 L200 64" stroke="${OL}" stroke-width="5"/>
  <circle cx="148" cy="100" r="20" fill="#22223b" ${S}/>
  <path d="M140 92 l6 -2" stroke="#5c5f7a" stroke-width="3" stroke-linecap="round"/>
  <path d="M86 132 C104 148 136 148 154 132 C140 140 100 140 86 132Z" fill="#3c096c" ${S4}/>
  ${blush(70, 128)}
  <path d="M48 44 C70 0 170 0 192 44 C150 34 90 34 48 44Z" fill="url(#bh)" ${S}/>
  <path d="M42 46 C80 34 160 34 198 46" fill="none" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/>
  <path d="M108 12 l12 -6 l12 6 l-4 10 h-16Z" fill="#fff" stroke="${OL}" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="116" cy="12" r="2.2" fill="${OL}"/><circle cx="124" cy="12" r="2.2" fill="${OL}"/>
  <path d="M104 28 L136 28" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
  <path d="M206 44 c10 -4 16 4 10 10" fill="none" stroke="#ffd166" stroke-width="4" stroke-linecap="round"/>`);

/** Plombir: walrus trader. */
const walrus = svg(220, 220, `
  <defs>${vol('wb', '#b08968', 0.25, 0.3)}${vol('wh', '#c8a27a', 0.35, 0.25)}${vol('wm', '#efd9c1', 0.4, 0.12)}${lin('wf', '#ef4b57', '#9d0208')}${lin('wt', '#ffffff', '#e2dccf')}</defs>
  <path d="M24 214 C20 150 50 110 110 110 C170 110 200 150 196 214Z" fill="url(#wb)" ${S}/>
  <path d="M30 200 C26 180 36 166 52 170 C52 184 46 200 30 200Z M190 200 C194 180 184 166 168 170 C168 184 174 200 190 200Z" fill="#8a6a4f" ${S4}/>
  <path d="M70 150 q6 -4 12 0 M140 160 q6 -4 12 0 M110 190 q6 -4 12 0 M84 184 q6 -4 12 0" fill="none" stroke="#8a6a4f" stroke-width="3" stroke-linecap="round"/>
  <rect x="80" y="150" width="60" height="44" rx="6" fill="#fff1d0" ${S4}/>
  <path d="M90 166 H130 M90 178 H122" stroke="#c9a66b" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="110" cy="86" rx="70" ry="60" fill="url(#wh)" ${S}/>
  <path d="M60 54 q8 -6 16 -2 M144 52 q8 -4 16 2" fill="none" stroke="#7f5539" stroke-width="5" stroke-linecap="round"/>
  ${eye(84, 68, 11)}${eye(136, 68, 11)}
  <path d="M112 118 C110 150 114 170 120 180 C126 166 126 146 124 120Z M108 118 C110 150 106 170 100 180 C94 166 94 146 96 120Z" fill="url(#wt)" ${S4}/>
  <ellipse cx="88" cy="104" rx="27" ry="21" fill="url(#wm)" ${S}/><ellipse cx="132" cy="104" rx="27" ry="21" fill="url(#wm)" ${S}/>
  <g fill="#8a6a4f"><circle cx="76" cy="100" r="2"/><circle cx="86" cy="96" r="2"/><circle cx="80" cy="110" r="2"/><circle cx="94" cy="106" r="2"/><circle cx="144" cy="100" r="2"/><circle cx="134" cy="96" r="2"/><circle cx="140" cy="110" r="2"/><circle cx="126" cy="106" r="2"/></g>
  <path d="M64 104 L38 98 M64 110 L38 112 M156 104 L182 98 M156 110 L182 112" stroke="${OL}" stroke-width="2.5" stroke-linecap="round"/>
  <ellipse cx="110" cy="88" rx="13" ry="9" fill="${OL}"/><ellipse cx="106" cy="85" rx="4" ry="2.5" fill="#fff" opacity=".6"/>
  ${blush(62, 86)}${blush(158, 86)}
  <path d="M62 30 H158 L148 8 H72Z" fill="url(#wf)" ${S}/>
  <rect x="56" y="28" width="108" height="11" rx="5" fill="#9d0208" ${S4}/>
  <path d="M110 8 C126 4 140 12 146 24" fill="none" stroke="${OL}" stroke-width="3"/>
  <circle cx="146" cy="28" r="6" fill="#ffd166" ${S4}/>
  ${shine('M76 14 L72 26', 4, 0.5)}`);

/** General Ladya: old tortoise, commandant of the chess fort. */
const general = svg(220, 220, `
  <defs>${vol('gs', '#2d6a4f', 0.3, 0.3)}${vol('gh', '#95d5b2', 0.35, 0.22)}${lin('gc', '#ffe38a', '#e0a020')}</defs>
  ${shadowUnder(110, 206, 90)}
  <path d="M30 200 C30 120 190 120 190 200Z" fill="url(#gs)" ${S}/>
  <path d="M70 196 l16 -40 l48 0 l16 40 M86 156 l-24 -14 M134 156 l24 -14 M62 142 L40 180 M158 142 L180 180" fill="none" stroke="#74c69d" stroke-width="5" stroke-linejoin="round"/>
  <path d="M20 200 H200" ${S}/>
  <path d="M26 200 q12 8 24 0 q12 8 24 0 q12 8 24 0 q12 8 24 0 q12 8 24 0 q12 8 24 0 q12 8 24 0" fill="#b7e4c7" stroke="${OL}" stroke-width="3"/>
  <circle cx="160" cy="176" r="12" fill="url(#gc)" ${S4}/><path d="M154 164 L160 150 L166 164" fill="#e63946" stroke="${OL}" stroke-width="3"/>
  <path d="M160 170 l2 4 l4 1 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 -1Z" fill="#fff"/>
  <ellipse cx="110" cy="92" rx="48" ry="44" fill="url(#gh)" ${S}/>
  <path d="M70 110 q6 4 12 0 M140 112 q6 4 12 0 M96 128 q6 4 12 0" fill="none" stroke="#52b788" stroke-width="3" stroke-linecap="round"/>
  ${eye(92, 86, 11)}${eye(128, 86, 11)}
  <circle cx="128" cy="86" r="15" fill="none" stroke="#ffd166" stroke-width="3"/><path d="M143 88 C150 100 150 116 146 128" fill="none" stroke="#ffd166" stroke-width="2"/>
  <path d="M80 70 L104 76 M140 70 L116 76" stroke="#f8f9fa" stroke-width="7" stroke-linecap="round"/>
  <path d="M80 70 L104 76 M140 70 L116 76" stroke="${OL}" stroke-width="2" stroke-linecap="round" opacity=".5"/>
  <path d="M92 110 C100 106 120 106 128 110 C124 120 96 120 92 110Z" fill="#fff" ${S4}/>
  <path d="M70 52 V22 H82 V32 H94 V22 H106 V32 H118 V22 H130 V32 H142 V22 H150 V52Z" fill="url(#gc)" ${S}/>
  <circle cx="90" cy="44" r="4" fill="#e63946"/><circle cx="110" cy="44" r="4" fill="#277da1"/><circle cx="130" cy="44" r="4" fill="#43aa8b"/>
  <path d="M76 28 V46" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`);

/** Treshchotka: a magpie who loves everything shiny and chases the parcel. */
const magpie = svg(220, 220, `
  <defs>${vol('mb', '#33335a', 0.25, 0.35)}${lin('mt', '#2a5a8a', '#14284a')}${lin('mw', '#3a6fa0', '#1d3557')}${vol('mg', '#ffd166', 0.5, 0.2)}</defs>
  ${shadowUnder(106, 214, 50)}
  <path d="M120 140 L206 190 L196 204 L112 160Z" fill="url(#mt)" ${S}/>
  <path d="M150 156 L200 186 M140 160 L190 196" stroke="#4cc9f0" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M96 188 L90 210 M116 188 L118 210" stroke="${OL}" stroke-width="7" stroke-linecap="round"/>
  <path d="M82 212 h14 M112 212 h14" stroke="${OL}" stroke-width="5" stroke-linecap="round"/>
  <ellipse cx="104" cy="138" rx="56" ry="54" fill="url(#mb)" ${S}/>
  <path d="M66 130 C64 170 92 192 118 188 C132 170 128 140 110 128Z" fill="#fff" ${S}/>
  <path d="M80 160 q6 4 12 0 M90 174 q6 4 12 0" fill="none" stroke="#dee2e6" stroke-width="3" stroke-linecap="round"/>
  <path d="M110 104 C150 96 180 120 170 160 C150 158 126 146 112 128Z" fill="url(#mw)" ${S}/>
  <path d="M126 116 C146 116 160 128 162 146" fill="none" stroke="#4cc9f0" stroke-width="6" stroke-linecap="round"/>
  <path d="M120 128 C134 130 146 136 154 146" fill="none" stroke="#80ffdb" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M132 148 C142 150 152 152 160 152" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
  <circle cx="92" cy="72" r="44" fill="url(#mb)" ${S}/>
  <path d="M52 70 L12 82 L52 92Z" fill="#495057" ${S4}/>
  <path d="M52 81 L20 82" stroke="${OL}" stroke-width="2"/>
  ${eye(80, 64, 15)}
  <path d="M62 46 q14 -8 30 -2" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".35"/>
  <path d="M104 20 C108 8 120 6 122 18 C130 10 140 18 132 28" fill="url(#mb)" ${S4}/>
  ${shine('M112 50 C120 54 126 62 128 72', 5, 0.3)}
  <circle cx="34" cy="120" r="13" fill="url(#mg)" ${S4}/><path d="M28 116 L34 110 L40 116" fill="none" stroke="#fff" stroke-width="3"/>
  <path d="M18 104 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3Z" fill="#fff6c2"/>`);

export const CHARACTERS = { rumb, kettle, raccoon, blot, walrus, general, magpie } as const;
export type CharacterId = keyof typeof CHARACTERS | 'strelka';

export const CHARACTER_NAME: Record<CharacterId, string> = {
  rumb: 'Попугай Румб',
  kettle: 'Чайник Пыхтелкин',
  raccoon: 'Енот Болтик',
  blot: 'Капитан Клякса',
  walrus: 'Морж Пломбир',
  general: 'Генерал Ладья',
  magpie: 'Сорока Трещотка',
  strelka: 'Стрелка',
};

