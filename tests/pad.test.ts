import { describe, expect, it } from 'vitest';
import { keyMeaning, looksLikeTv, mergePads, readPad, type PadLike } from '../src/core/input/devices';
import { pickInitial, pickNearest, pickNext, type Rect } from '../src/core/input/nav';

const r = (x: number, y: number, w = 100, h = 60): Rect => ({ x, y, w, h });

describe('spatial navigation', () => {
  // A 3x2 grid of answer cards and a "Домой" button top right.
  const grid = [r(100, 300), r(300, 300), r(500, 300), r(100, 450), r(300, 450), r(500, 450), r(1100, 20)];

  it('moves to the neighbour in a row and a column', () => {
    expect(pickNext(grid[0]!, grid, 'right')).toBe(1);
    expect(pickNext(grid[1]!, grid, 'left')).toBe(0);
    expect(pickNext(grid[1]!, grid, 'down')).toBe(4);
    expect(pickNext(grid[4]!, grid, 'up')).toBe(1);
  });

  it('stops at the edge', () => {
    expect(pickNext(grid[0]!, grid, 'left')).toBe(-1);
    expect(pickNext(grid[3]!, grid, 'down')).toBe(-1);
  });

  it('keeps to the row rather than jumping diagonally', () => {
    const row = [r(100, 300), r(600, 300), r(250, 500)];
    expect(pickNext(row[0]!, row, 'right')).toBe(1);
  });

  it('reaches a button far off to the side when going up', () => {
    expect(pickNext(grid[2]!, grid, 'up')).toBe(6);
  });

  it('starts near the middle, never on "Домой", or where marked', () => {
    const ts = grid.map((rect, i) => ({ rect, back: i === 6 }));
    expect(pickInitial(ts, { x: 640, y: 360 })).toBe(2);
    expect(pickInitial([{ rect: grid[6]!, back: true }], { x: 640, y: 360 })).toBe(-1);
    expect(pickInitial([...ts, { rect: r(0, 0), preferred: true }], { x: 640, y: 360 })).toBe(7);
  });

  it('picks the nearest one when the focused one is gone', () => {
    expect(pickNearest(grid, { x: 360, y: 480 })).toBe(4);
  });
});

const pad = (pressed: number[], axes: number[] = [0, 0, 0, 0], mapping = 'standard'): PadLike => ({
  mapping,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })),
  axes,
});

describe('gamepad', () => {
  it('reads the D-pad and the face buttons of a standard pad', () => {
    const s = readPad(pad([12, 15, 0]));
    expect([...s.dirs].sort()).toEqual(['right', 'up']);
    expect([...s.buttons]).toEqual(['ok']);
    expect([...readPad(pad([1])).buttons]).toEqual(['back']);
    expect([...readPad(pad([2])).buttons]).toEqual(['alt']);
    expect([...readPad(pad([9])).buttons]).toEqual(['ok']);
  });

  it('reads the stick with a dead zone', () => {
    expect(readPad(pad([], [0.1, -0.2])).dirs.size).toBe(0);
    expect(readPad(pad([], [0.1, -0.2])).stick).toEqual({ x: 0, y: 0 });
    expect([...readPad(pad([], [-0.9, 0])).dirs]).toEqual(['left']);
    expect(readPad(pad([], [0.4, 0])).stick.x).toBe(0.4);
  });

  it('reads the hat switch of a cheap USB pad, and ignores a trigger resting at -1', () => {
    const axes = (hat: number) => [0, 0, -1, 0, 0, -1, 0, 0, 0, hat];
    expect([...readPad(pad([], axes(-1), '')).dirs]).toEqual(['up']);
    expect([...readPad(pad([], axes(-3 / 7), '')).dirs]).toEqual(['right']);
    expect([...readPad(pad([], axes(1 / 7), '')).dirs]).toEqual(['down']);
    expect([...readPad(pad([], axes(5 / 7), '')).dirs]).toEqual(['left']);
    expect(readPad(pad([], axes(9 / 7), '')).dirs.size).toBe(0);
  });

  it('merges two pads', () => {
    const s = mergePads([readPad(pad([12])), readPad(pad([0], [0.6, 0]))]);
    expect(s.dirs.has('up') && s.dirs.has('right') && s.buttons.has('ok')).toBe(true);
    expect(s.stick.x).toBe(0.6);
  });
});

describe('keys and TV remotes', () => {
  const k = (key: string, keyCode = 0, code = '') => keyMeaning({ key, keyCode, code });

  it('reads arrows, OK and the Back keys of different TVs', () => {
    expect(k('ArrowLeft')).toEqual({ dir: 'left' });
    expect(k('Enter')).toEqual({ button: 'ok' });
    expect(k('GoBack')).toEqual({ button: 'back' });
    expect(k('Unidentified', 10009)).toEqual({ button: 'back' });
    expect(k('Unidentified', 461)).toEqual({ button: 'back' });
    expect(k('Unidentified', 23)).toEqual({ button: 'ok' });
    expect(k('a', 65)).toBeUndefined();
  });

  it('knows TV browsers', () => {
    expect(looksLikeTv('Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36')).toBe(true);
    expect(looksLikeTv('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36')).toBe(true);
    expect(looksLikeTv('Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36')).toBe(true);
    expect(looksLikeTv('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15')).toBe(false);
  });
});
