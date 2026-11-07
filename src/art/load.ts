import type Phaser from 'phaser';
import { CHARACTERS, strelkaSvg } from './characters';
import { pieceSvg } from './chess';
import {
  BEACH_BG, BLOT_SHIP, BOTTLE, BUOY_PAINT, buoySvg, COIN, GULL, COLORED_KINDS, CRATE, GOAL_BUOY, HARBOR_BG, islandSvg, NIGHT_BG,
  OBJECT_COLORS, OBJECTS, REEF, SEA_BG, YACHT_SIDE, YACHT_TOP,
} from './objects';

const toUri = (s: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s)))}`;

/** Every texture key the art pass provides, with its SVG. Exported for tests. */
export function artSources(): Record<string, string> {
  const out: Record<string, string> = {
    'yacht-side': YACHT_SIDE,
    'yacht-top': YACHT_TOP,
    'blot-ship': BLOT_SHIP,
    bottle: BOTTLE,
    coin: COIN,
    reef: REEF,
    goal: GOAL_BUOY,
    crate: CRATE,
    'bg-harbor': HARBOR_BG,
    'bg-sea': SEA_BG,
    'bg-beach': BEACH_BG,
    'bg-night': NIGHT_BG,
    gull: GULL,
  };
  for (const [name, hex] of Object.entries(BUOY_PAINT)) {
    for (const shape of ['round', 'cone', 'can'] as const) out[`buoy-${name}-${shape}`] = buoySvg(hex, shape);
  }
  for (const [kind, draw] of Object.entries(OBJECTS)) {
    if ((COLORED_KINDS as readonly string[]).includes(kind)) {
      for (const [name, hex] of Object.entries(OBJECT_COLORS)) out[`obj-${kind}-${name}`] = draw(hex);
      out[`obj-${kind}`] = draw('#a5683a');
    } else {
      out[`obj-${kind}`] = draw('');
    }
  }
  for (const [id, s] of Object.entries(CHARACTERS)) out[`char-${id}`] = s;
  for (let n = 0; n <= 4; n++) out[`strelka-${n}`] = strelkaSvg(n);
  for (const c of ['w', 'b'] as const) for (const t of 'prnbqk') out[`piece-${c}${t}`] = pieceSvg(c, t);
  for (let k = 0; k < 5; k++) for (const v of [true, false]) out[`island-${k}-${v ? 'v' : 'n'}`] = islandSvg(k, v);
  return out;
}

/** Queues all art on the scene's loader. Call from a preload(). */
export function preloadArt(scene: Phaser.Scene) {
  for (const [key, s] of Object.entries(artSources())) {
    // Rasterised at 2× so portraits stay sharp when shown large and on retina phones.
    if (!scene.textures.exists(key)) scene.load.svg(key, toUri(s), { scale: key.startsWith('bg-') ? 1 : 2 });
  }
}
