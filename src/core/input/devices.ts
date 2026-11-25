/**
 * What a gamepad or a key means for the game, without any DOM or Phaser:
 * four directions, OK, Back and "repeat the word".
 */
import type { Dir } from './nav';

export type Button = 'ok' | 'back' | 'alt';

export interface PadState {
  dirs: Set<Dir>;
  buttons: Set<Button>;
  /** Left stick, -1..1 each, 0 inside the dead zone. */
  stick: { x: number; y: number };
}

/** The part of the Gamepad API we read, so tests can pass plain objects. */
export interface PadLike {
  mapping: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}

const DEAD = 0.25;
const DIR_AT = 0.55;

const pressed = (p: PadLike, i: number) => {
  const b = p.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
};

/**
 * One gamepad, "standard" layout (Xbox, PlayStation, most Bluetooth pads):
 * A / Cross and Y / Triangle and Start mean OK, B / Circle and Select mean Back,
 * X / Square repeats the word. The D-pad and the left stick both steer.
 * Cheap USB pads without the standard layout: the first face buttons mean OK
 * (except the second, Back), and the D-pad usually comes as a hat axis.
 */
export function readPad(p: PadLike): PadState {
  const dirs = new Set<Dir>();
  const buttons = new Set<Button>();
  const ax = p.axes[0] ?? 0;
  const ay = p.axes[1] ?? 0;
  const stick = {
    x: Math.abs(ax) > DEAD ? ax : 0,
    y: Math.abs(ay) > DEAD ? ay : 0,
  };
  if (stick.x < -DIR_AT) dirs.add('left');
  if (stick.x > DIR_AT) dirs.add('right');
  if (stick.y < -DIR_AT) dirs.add('up');
  if (stick.y > DIR_AT) dirs.add('down');
  if (p.mapping === 'standard') {
    if (pressed(p, 12)) dirs.add('up');
    if (pressed(p, 13)) dirs.add('down');
    if (pressed(p, 14)) dirs.add('left');
    if (pressed(p, 15)) dirs.add('right');
    if (pressed(p, 0) || pressed(p, 3) || pressed(p, 9)) buttons.add('ok');
    if (pressed(p, 1) || pressed(p, 8)) buttons.add('back');
    if (pressed(p, 2)) buttons.add('alt');
  } else {
    // Hat switch, as Chrome reports many USB pads: axis 9, -1 = up, then clockwise in
    // steps of 2/7; about 1.29 means centered. Other axes (triggers rest at -1) are left alone.
    const v = p.axes[9];
    if (v !== undefined && v >= -1.05 && v <= 1.05) {
      const k = Math.round(((v + 1) * 7) / 2);
      if (k === 0 || k === 1 || k === 7) dirs.add('up');
      if (k >= 1 && k <= 3) dirs.add('right');
      if (k >= 3 && k <= 5) dirs.add('down');
      if (k >= 5 && k <= 7) dirs.add('left');
    }
    for (let i = 12; i <= 15; i++) if (pressed(p, i)) dirs.add((['up', 'down', 'left', 'right'] as Dir[])[i - 12]!);
    if (pressed(p, 0) || pressed(p, 2) || pressed(p, 3) || pressed(p, 9)) buttons.add('ok');
    if (pressed(p, 1) || pressed(p, 8)) buttons.add('back');
  }
  return { dirs, buttons, stick };
}

/** Several pads at once (two kids, or a pad plus a remote): anything pressed on any pad counts. */
export function mergePads(states: PadState[]): PadState {
  const out: PadState = { dirs: new Set(), buttons: new Set(), stick: { x: 0, y: 0 } };
  for (const s of states) {
    s.dirs.forEach((d) => out.dirs.add(d));
    s.buttons.forEach((b) => out.buttons.add(b));
    if (Math.abs(s.stick.x) > Math.abs(out.stick.x)) out.stick.x = s.stick.x;
    if (Math.abs(s.stick.y) > Math.abs(out.stick.y)) out.stick.y = s.stick.y;
  }
  return out;
}

export type KeyMeaning = { dir: Dir } | { button: Button } | undefined;

/**
 * Keyboard and TV remotes. Remotes send arrows and Enter like a keyboard; Back differs:
 * Escape or Backspace on most, GoBack / BrowserBack on Android TV, 10009 on Samsung (Tizen),
 * 461 on LG (webOS). OK on Android TV can come as DPAD_CENTER (23).
 */
export function keyMeaning(e: { key: string; code: string; keyCode: number }): KeyMeaning {
  switch (e.key) {
    case 'ArrowUp':
    case 'Up':
      return { dir: 'up' };
    case 'ArrowDown':
    case 'Down':
      return { dir: 'down' };
    case 'ArrowLeft':
    case 'Left':
      return { dir: 'left' };
    case 'ArrowRight':
    case 'Right':
      return { dir: 'right' };
    case 'Enter':
    case 'Accept':
    case 'Select':
      return { button: 'ok' };
    case 'Escape':
    case 'Esc':
    case 'Backspace':
    case 'GoBack':
    case 'BrowserBack':
      return { button: 'back' };
  }
  switch (e.keyCode) {
    case 38:
      return { dir: 'up' };
    case 40:
      return { dir: 'down' };
    case 37:
      return { dir: 'left' };
    case 39:
      return { dir: 'right' };
    case 13:
    case 23:
      return { button: 'ok' };
    case 27:
    case 8:
    case 461:
    case 10009:
      return { button: 'back' };
  }
  return undefined;
}

/** The keyboard event a game expects for a pad direction or button (for scenes that read keys themselves). */
export const KEY_FOR: Record<Dir | Button, { key: string; code: string; keyCode: number }> = {
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  ok: { key: 'Enter', code: 'Enter', keyCode: 13 },
  back: { key: 'Escape', code: 'Escape', keyCode: 27 },
  alt: { key: ' ', code: 'Space', keyCode: 32 },
};

/** Looks like a TV browser: there the remote's Back key walks the browser history, so we catch it. */
export function looksLikeTv(ua: string): boolean {
  return /\b(SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|Android TV|GoogleTV|AFT[A-Z]+|CrKey|Viera|AQUOS|PhilipsTV|VIDAA|TV Safari)\b/i.test(ua);
}
