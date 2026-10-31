import Phaser from 'phaser';

export const W = 1280;
export const H = 720;
export const FONT = 'Nunito, "Trebuchet MS", Arial, sans-serif';

export const COLORS = {
  sea: 0x1b4965,
  seaLight: 0x5fa8d3,
  sand: 0xe9c46a,
  wood: 0x8d5524,
  leaf: 0x2a9d8f,
  night: 0x0b2233,
  white: 0xffffff,
};

/** Big tap target, at least 64px (SDD section 6). Click or tap both work. */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: { w?: number; h?: number; color?: number } = {},
) {
  const w = opts.w ?? 360;
  const h = Math.max(64, opts.h ?? 96);
  const bg = scene.add.rectangle(0, 0, w, h, opts.color ?? COLORS.wood).setStrokeStyle(6, 0x5c3317);
  const text = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: '40px', color: '#ffffff' }).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, text]).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.96));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    onClick();
  });
  return c;
}

/** Blocky placeholder art: a stack of square "blocks". Replaced by real tiles later. */
export function blocks(scene: Phaser.Scene, x: number, y: number, rows: string[], size = 16, palette: Record<string, number> = {}) {
  const g = scene.add.graphics({ x, y });
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const color = palette[ch];
      if (color === undefined) return;
      g.fillStyle(color).fillRect(c * size, r * size, size, size);
      g.lineStyle(1, 0x000000, 0.15).strokeRect(c * size, r * size, size, size);
    }),
  );
  return g;
}

export const YACHT = ['....W....', '....WW...', '....WWW..', '....M....', 'BBBBBBBBB', '.BBBBBBB.'];
export const YACHT_PALETTE = { W: COLORS.white, M: COLORS.wood, B: 0xb5651d };

export function title(scene: Phaser.Scene, text: string, y = 80) {
  return scene.add.text(W / 2, y, text, { fontFamily: FONT, fontSize: '56px', color: '#ffffff' }).setOrigin(0.5);
}
