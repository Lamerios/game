/**
 * Gamepad and TV remote for every scene, in one place.
 *
 * The games are built for taps. This layer lets a pad or a remote "tap" for the child:
 * arrows (D-pad, stick, remote) move a glowing ring between the things on screen that
 * can be tapped, and OK (A, Enter, the remote's middle button) taps the one in the ring.
 * The tap is a real mouse event on the canvas, so every button, card and board square
 * works without code in the scene. Back (B, Esc, the remote's Back) presses "Домой".
 *
 * A scene can ask for another way by a field, no import needed:
 *   padMode = 'keys'    the scene reads arrows and Enter itself (snake, race while driving,
 *                       the menu carousel); the pad is turned into those key presses.
 *   padMode = 'cursor'  a free pointer that arrows move smoothly (aiming in the shooting
 *                       range, dropping the anchor at a spot on the line).
 *   padDragStep = 90    how far one arrow press moves something being dragged.
 * The field can be a getter that changes with what is on screen. pushPadMode() does the
 * same for a while from code that is not the scene itself (a pit stop inside the race).
 *
 * Something draggable (a puzzle piece, a boat in the jam) is picked up with OK,
 * carried with the arrows and put down with OK again.
 */
import type Phaser from 'phaser';
import { KEY_FOR, keyMeaning, looksLikeTv, mergePads, readPad, type Button, type KeyMeaning, type PadState } from './devices';
import { center, DIR_VEC, pickInitial, pickNearest, pickNext, type Dir, type Rect } from './nav';

export type PadMode = 'focus' | 'cursor' | 'keys';

export interface PadSceneFields {
  padMode?: PadMode;
  padDragStep?: number;
  /** Called on Back when the scene has no "Домой" button; true if it did something. */
  padBack?: () => boolean;
}

const overrides = new WeakMap<Phaser.Scene, PadMode[]>();

/** Switch a scene's pad mode until the returned function is called (or the scene ends). */
export function pushPadMode(scene: Phaser.Scene, mode: PadMode): () => void {
  const stack = overrides.get(scene) ?? [];
  overrides.set(scene, stack);
  stack.push(mode);
  let done = false;
  const pop = () => {
    if (done) return;
    done = true;
    const i = stack.lastIndexOf(mode);
    if (i >= 0) stack.splice(i, 1);
  };
  scene.events.once('shutdown', pop);
  return pop;
}

type GO = Phaser.GameObjects.GameObject & {
  input: Phaser.Types.Input.InteractiveObject | null;
  displayOriginX?: number;
  displayOriginY?: number;
  scrollFactorX?: number;
  scrollFactorY?: number;
  getWorldTransformMatrix?: () => Phaser.GameObjects.Components.TransformMatrix;
  getBounds?: () => Phaser.Geom.Rectangle;
};

interface Target {
  obj: GO;
  rect: Rect;
  back: boolean;
  preferred: boolean;
  draggable: boolean;
}

const BACK_LABELS = /^(Домой|Назад|Выход)$/;

/** Mark a game object as the one Back presses (button() does it for "Домой" itself). */
export function markBack(obj: Phaser.GameObjects.GameObject) {
  obj.setData('padBack', true);
  return obj;
}

/** Mark the object the ring should start on when a screen opens. */
export function markPreferred(obj: Phaser.GameObjects.GameObject) {
  obj.setData('padFirst', true);
  return obj;
}

export const isBackLabel = (label: string) => BACK_LABELS.test(label.trim());

const CSS = `
#pad-ring{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:15;display:none;box-sizing:border-box;
border:6px solid #ffd166;border-radius:20px;box-shadow:0 0 0 3px #0b2233cc,0 0 26px 8px #ffd166aa;
transition:left .14s ease-out,top .14s ease-out,width .14s ease-out,height .14s ease-out,border-color .14s;animation:padpulse 1.1s ease-in-out infinite}
#pad-ring.carry{border-color:#06d6a0;box-shadow:0 0 0 3px #0b2233cc,0 0 26px 8px #06d6a0aa}
#pad-cursor{position:fixed;left:0;top:0;width:56px;height:56px;margin:-28px 0 0 -28px;pointer-events:none;z-index:15;display:none;box-sizing:border-box;
border:6px solid #ffd166;border-radius:50%;box-shadow:0 0 0 3px #0b2233cc,0 0 18px 4px #ffd166aa}
#pad-cursor::before,#pad-cursor::after{content:"";position:absolute;background:#ffd166;left:50%;top:50%}
#pad-cursor::before{width:6px;height:18px;margin:-9px 0 0 -3px}#pad-cursor::after{width:18px;height:6px;margin:-3px 0 0 -9px}
#pad-cursor.down{transform:scale(.8);border-color:#ff006e}
@keyframes padpulse{50%{box-shadow:0 0 0 3px #0b2233cc,0 0 34px 14px #ffd166dd}}
#pad-toast{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:16;pointer-events:none;padding:10px 22px;border-radius:16px;
background:#0b2233e6;color:#fff;font:24px Nunito,"Trebuchet MS",Arial,sans-serif;border:3px solid #ffd166;opacity:0;transition:opacity .3s}
#pad-toast.on{opacity:1}
`;

/** Events this layer made itself, so it does not handle them twice. */
const synthetic = new WeakSet<Event>();

export function setupPadControls(game: Phaser.Game) {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.append(st);
  const ring = document.createElement('div');
  ring.id = 'pad-ring';
  const cursorEl = document.createElement('div');
  cursorEl.id = 'pad-cursor';
  const toastEl = document.createElement('div');
  toastEl.id = 'pad-toast';
  document.body.append(ring, cursorEl, toastEl);

  const GW = () => game.scale.width;
  const GH = () => game.scale.height;

  /** Shown after the first pad or arrow press; hidden again when a real mouse or finger is used. */
  let active = false;
  let focused: GO | undefined;
  let lastPos = { x: 0, y: 0 };
  let cursor = { x: 0, y: 0 };
  let pressing = false;
  let pressAt = { x: 0, y: 0 };
  let carrying = false;
  let lastScene: Phaser.Scene | undefined;
  let lastMode: PadMode = 'focus';
  let targets: Target[] = [];
  let targetsAt = 0;
  const keyHeld = new Set<Dir>();
  /** When the free pointer started moving: it speeds up the longer an arrow is held. */
  let moveSince = 0;
  let backHandled = false;

  // ---------- reading the screen ----------

  const topScene = () => (game.scene.getScenes(true, true) as Phaser.Scene[]).find((s) => s.input?.enabled);

  const modeOf = (scene: Phaser.Scene | undefined): PadMode => {
    if (!scene) return 'focus';
    const o = overrides.get(scene);
    if (o?.length) return o[o.length - 1]!;
    const m = (scene as Phaser.Scene & PadSceneFields).padMode;
    return m === 'keys' || m === 'cursor' ? m : 'focus';
  };

  const sceneOf = (obj: GO) => obj.scene;

  /** The object's tap area on the screen, in game pixels. */
  const screenRect = (obj: GO): Rect | undefined => {
    const ha = obj.input?.hitArea as (Phaser.Geom.Rectangle & { type: number; radius?: number; points?: { x: number; y: number }[]; x1?: number }) | undefined;
    const scene = sceneOf(obj);
    if (!ha || !scene || !obj.getWorldTransformMatrix) return undefined;
    let pts: { x: number; y: number }[];
    switch (ha.type) {
      case 0: // circle
        pts = [{ x: ha.x - ha.radius!, y: ha.y - ha.radius! }, { x: ha.x + ha.radius!, y: ha.y + ha.radius! }];
        break;
      case 1: // ellipse
        pts = [{ x: ha.x - ha.width / 2, y: ha.y - ha.height / 2 }, { x: ha.x + ha.width / 2, y: ha.y + ha.height / 2 }];
        break;
      case 4: // polygon
        pts = ha.points ?? [];
        break;
      case 6: {
        const t = ha as unknown as Phaser.Geom.Triangle;
        pts = [{ x: t.x1, y: t.y1 }, { x: t.x2, y: t.y2 }, { x: t.x3, y: t.y3 }];
        break;
      }
      default:
        pts = [{ x: ha.x, y: ha.y }, { x: ha.x + ha.width, y: ha.y + ha.height }];
    }
    if (!pts.length) return undefined;
    const ox = obj.displayOriginX ?? 0;
    const oy = obj.displayOriginY ?? 0;
    const xs = pts.map((p) => p.x - ox);
    const ys = pts.map((p) => p.y - oy);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const m = obj.getWorldTransformMatrix();
    const corners = [m.transformPoint(x0, y0), m.transformPoint(x1, y0), m.transformPoint(x0, y1), m.transformPoint(x1, y1)];
    const cam = scene.cameras.main;
    const sx = cam.x - cam.scrollX * (obj.scrollFactorX ?? 1);
    const sy = cam.y - cam.scrollY * (obj.scrollFactorY ?? 1);
    const cx = corners.map((p) => p.x + sx);
    const cy = corners.map((p) => p.y + sy);
    const r = { x: Math.min(...cx), y: Math.min(...cy), w: Math.max(...cx) - Math.min(...cx), h: Math.max(...cy) - Math.min(...cy) };
    return r.w > 2 && r.h > 2 ? r : undefined;
  };

  /** What a tap at this point would hit first, the way Phaser decides it (top scene, top object). */
  const topAt = (x: number, y: number): GO | undefined => {
    for (const scene of game.scene.getScenes(true, true) as Phaser.Scene[]) {
      const input = scene.input as Phaser.Input.InputPlugin & { _list: GO[] };
      if (!input?.enabled) continue;
      const ptr = { x, y, worldX: 0, worldY: 0, camera: undefined as Phaser.Cameras.Scene2D.Camera | undefined };
      const cams = input.cameras.getCamerasBelowPointer(ptr as unknown as Phaser.Input.Pointer);
      for (const cam of cams) {
        const hits = input.manager.hitTest(ptr as unknown as Phaser.Input.Pointer, input._list, cam, []) as GO[];
        if (!hits.length) continue;
        ptr.camera = cam;
        return input.sortGameObjects(hits, ptr as unknown as Phaser.Input.Pointer)[0] as GO;
      }
    }
    return undefined;
  };

  const tappable = (o: GO) => o.listenerCount('pointerdown') + o.listenerCount('pointerup') + o.listenerCount('dragstart') > 0;

  const collect = (): Target[] => {
    const out: Target[] = [];
    const big = GW() * GH() * 0.45;
    for (const scene of game.scene.getScenes(true, true) as Phaser.Scene[]) {
      const input = scene.input as Phaser.Input.InputPlugin & { _list: GO[] };
      if (!input?.enabled) continue;
      for (const obj of input._list) {
        if (!obj.active || !obj.input?.enabled || !tappable(obj)) continue;
        const rect = screenRect(obj);
        if (!rect || rect.w * rect.h > big) continue;
        const c = center(rect);
        if (c.x < 0 || c.y < 0 || c.x > GW() || c.y > GH()) continue;
        if (topAt(c.x, c.y) !== obj) continue;
        out.push({
          obj,
          rect,
          back: !!obj.data?.get('padBack'),
          preferred: !!obj.data?.get('padFirst'),
          draggable: !!obj.input.draggable,
        });
      }
    }
    return out;
  };

  const refresh = (now = performance.now()) => {
    targets = collect();
    targetsAt = now;
    return targets;
  };

  // ---------- making taps and keys ----------

  const toClient = (x: number, y: number) => {
    const r = game.canvas.getBoundingClientRect();
    return { clientX: r.left + (x * r.width) / GW(), clientY: r.top + (y * r.height) / GH() };
  };

  const mouse = (type: 'mousemove' | 'mousedown' | 'mouseup', x: number, y: number) => {
    const ev = new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0, buttons: type === 'mouseup' ? 0 : pressing ? 1 : 0, ...toClient(x, y) });
    synthetic.add(ev);
    game.canvas.dispatchEvent(ev);
  };

  const down = (p: { x: number; y: number }) => {
    if (pressing) up();
    mouse('mousemove', p.x, p.y);
    pressing = true;
    pressAt = { ...p };
    mouse('mousedown', p.x, p.y);
  };

  const up = (p = pressAt) => {
    if (!pressing) return;
    pressing = false;
    mouse('mouseup', p.x, p.y);
    targetsAt = 0;
  };

  const tap = (p: { x: number; y: number }) => {
    down(p);
    up(p);
  };

  const wheel = (dir: Dir) => {
    const c = toClient(GW() / 2, GH() / 2);
    const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: dir === 'down' ? 240 : -240, ...c });
    synthetic.add(ev);
    game.canvas.dispatchEvent(ev);
  };

  const key = (type: 'keydown' | 'keyup', what: Dir | Button, repeat = false) => {
    const k = KEY_FOR[what];
    const ev = new KeyboardEvent(type, { key: k.key, code: k.code, bubbles: true, cancelable: true, repeat });
    Object.defineProperty(ev, 'keyCode', { get: () => k.keyCode });
    Object.defineProperty(ev, 'which', { get: () => k.keyCode });
    synthetic.add(ev);
    document.body.dispatchEvent(ev);
  };

  // ---------- the ring ----------

  let toastTimer = 0;
  const toast = (text: string) => {
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('on'), 2200);
  };

  const activate = () => {
    const was = active;
    active = true;
    return was;
  };

  const deactivate = () => {
    if (!active) return;
    if (carrying) {
      carrying = false;
      up(cursor);
    }
    active = false;
    focused = undefined;
    keyHeld.clear();
  };

  const focus = (t: Target | undefined) => {
    focused = t?.obj;
    if (t) lastPos = center(t.rect);
  };

  const current = () => (focused ? targets.find((t) => t.obj === focused) : undefined);

  const initial = (ts: Target[]) => ts[pickInitial(ts, { x: GW() / 2, y: GH() / 2 })];

  const place = (el: HTMLElement, r: Rect, pad: number) => {
    const a = toClient(r.x - pad, r.y - pad);
    const b = toClient(r.x + r.w + pad, r.y + r.h + pad);
    el.style.left = `${a.clientX}px`;
    el.style.top = `${a.clientY}px`;
    el.style.width = `${b.clientX - a.clientX}px`;
    el.style.height = `${b.clientY - a.clientY}px`;
  };

  const draw = (mode: PadMode) => {
    const showCursor = active && (mode === 'cursor' || (carrying && mode === 'focus'));
    const cur = active && mode === 'focus' && !carrying ? current() : undefined;
    cursorEl.style.display = showCursor && !carrying ? 'block' : 'none';
    if (showCursor && !carrying) {
      const c = toClient(cursor.x, cursor.y);
      cursorEl.style.left = `${c.clientX}px`;
      cursorEl.style.top = `${c.clientY}px`;
      cursorEl.classList.toggle('down', pressing);
    }
    if (carrying && active) {
      // The carried thing moves with the pointer: ring around it.
      const r = focused?.active ? screenRect(focused) : undefined;
      if (r) place(ring, r, 8);
      ring.classList.add('carry');
      ring.style.display = r ? 'block' : 'none';
      return;
    }
    ring.classList.remove('carry');
    if (!cur) {
      ring.style.display = 'none';
      return;
    }
    const r = cur.obj.active ? screenRect(cur.obj) ?? cur.rect : cur.rect;
    place(ring, r, 8);
    ring.style.display = 'block';
  };

  // ---------- what the buttons do ----------

  const doBack = (): boolean => {
    if (carrying) {
      carrying = false;
      up(cursor);
      return true;
    }
    const back = refresh().find((t) => t.back);
    if (back) {
      tap(center(back.rect));
      return true;
    }
    const scene = topScene() as (Phaser.Scene & PadSceneFields) | undefined;
    return !!scene?.padBack?.();
  };

  const onDir = (dir: Dir, mode: PadMode) => {
    if (mode === 'cursor') return; // moved every frame while held
    const step = dragStep();
    if (carrying) {
      if (!step) return; // smooth carrying, every frame
      const v = DIR_VEC[dir];
      const from = { ...cursor };
      cursor = clamp({ x: cursor.x + v.x * step, y: cursor.y + v.y * step });
      for (let i = 1; i <= 6; i++) mouse('mousemove', from.x + ((cursor.x - from.x) * i) / 6, from.y + ((cursor.y - from.y) * i) / 6);
      return;
    }
    const was = activate();
    const ts = refresh();
    if (!ts.length) {
      if (dir === 'up' || dir === 'down') wheel(dir);
      return;
    }
    const cur = current();
    // Only "Домой" on screen (an intro is playing): arrows wait, so button mashing cannot leave the game.
    if (!cur || !was) return focus(cur ?? initial(ts));
    const i = pickNext(cur.rect, ts.map((t) => t.rect), dir);
    if (i >= 0) focus(ts[i]);
    else if (dir === 'up' || dir === 'down') wheel(dir);
  };

  const onOk = (isDown: boolean, mode: PadMode) => {
    if (mode === 'cursor') {
      const was = activate();
      if (!isDown) return up(cursor);
      if (!was) return; // the first press only shows the pointer
      down(cursor);
      return;
    }
    if (!isDown) {
      if (!carrying) up();
      return;
    }
    if (carrying) {
      carrying = false;
      up(cursor);
      return;
    }
    const was = activate();
    const ts = refresh();
    const cur = current() ?? (was ? undefined : initial(ts));
    if (!was && ts.length > 1) return focus(cur); // the first press only shows the ring
    const t = cur ?? initial(ts);
    if (!t) {
      // Nothing to aim at (a story page): a tap in the middle turns the page.
      down({ x: GW() / 2, y: GH() / 2 });
      return;
    }
    focus(t);
    const c = center(t.rect);
    down(c);
    if (t.draggable) {
      carrying = true;
      cursor = { ...c };
    }
  };

  /** Arrows move the pointer smoothly while held (free pointer, or carrying without fixed steps). */
  const dragStep = () => (topScene() as (Phaser.Scene & PadSceneFields) | undefined)?.padDragStep;
  const isSmooth = (mode: PadMode) => mode === 'cursor' || (carrying && !dragStep());

  const clamp = (p: { x: number; y: number }) => ({ x: Math.max(0, Math.min(GW() - 1, p.x)), y: Math.max(0, Math.min(GH() - 1, p.y)) });

  // ---------- keyboard and TV remote ----------

  let historyArmed = false;
  const armHistory = () => {
    if (historyArmed) return;
    historyArmed = true;
    history.pushState({ pad: true }, '');
  };
  window.addEventListener('popstate', () => {
    if (!historyArmed) return;
    historyArmed = false;
    // The remote's Back: press "Домой" and stay in the game; with nothing to go back to, let the browser go.
    if (doBack()) armHistory();
  });
  if (looksLikeTv(navigator.userAgent)) armHistory();

  const typing = (t: EventTarget | null) => {
    if (!(t instanceof HTMLElement)) return false;
    if (t === document.body || t === document.documentElement) return false;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return true;
    return !t.closest('#game') && t.id !== 'fs';
  };

  const dashboardOpen = () => !!document.querySelector('.pd');

  const onKey = (e: KeyboardEvent) => {
    if (synthetic.has(e) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (typing(e.target) || dashboardOpen()) return;
    const m: KeyMeaning = keyMeaning(e);
    if (!m) return;
    const isDown = e.type === 'keydown';
    if (isDown && /Android/i.test(navigator.userAgent)) armHistory();
    const mode = modeOf(topScene());
    let handled = true;
    if ('button' in m && m.button === 'back') {
      if (isDown && !e.repeat) backHandled = doBack();
      handled = backHandled;
    } else if (mode === 'keys') {
      handled = false; // the scene reads its keys itself
    } else if ('dir' in m) {
      const smooth = isSmooth(mode);
      if (isDown) {
        if (smooth) {
          keyHeld.add(m.dir);
          activate();
        } else onDir(m.dir, mode);
      } else keyHeld.delete(m.dir);
    } else if (!e.repeat) onOk(isDown, mode);
    if (handled) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKey, true);
  window.addEventListener('blur', () => keyHeld.clear());

  // A real mouse or finger: hide the ring until the next pad or arrow press.
  window.addEventListener(
    'mousemove',
    (e) => {
      if (!synthetic.has(e) && e.isTrusted && (Math.abs(e.movementX) > 1 || Math.abs(e.movementY) > 1)) deactivate();
    },
    true,
  );
  for (const ev of ['touchstart', 'mousedown'] as const) window.addEventListener(ev, (e) => !synthetic.has(e) && e.isTrusted && deactivate(), true);

  // ---------- gamepads ----------

  let prev: PadState = { dirs: new Set(), buttons: new Set(), stick: { x: 0, y: 0 } };
  const repeatAt = new Map<Dir, number>();

  window.addEventListener('gamepadconnected', () => toast('🎮 Джойстик подключён'));
  window.addEventListener('gamepaddisconnected', () => toast('🎮 Джойстик отключён'));

  const pollPads = (now: number, mode: PadMode) => {
    const pads = (navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected);
    if (!pads.length && !prev.dirs.size && !prev.buttons.size) return;
    const s = pads.length ? mergePads(pads.map(readPad)) : { dirs: new Set<Dir>(), buttons: new Set<Button>(), stick: { x: 0, y: 0 } };
    if (dashboardOpen()) {
      prev = s;
      return;
    }
    const smooth = isSmooth(mode);
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
      const on = s.dirs.has(d);
      const was = prev.dirs.has(d);
      if (on && !was) {
        repeatAt.set(d, now + 380);
        if (mode === 'keys') key('keydown', d);
        else if (smooth) activate();
        else onDir(d, mode);
      } else if (on && now >= (repeatAt.get(d) ?? Infinity)) {
        repeatAt.set(d, now + 150);
        if (mode === 'keys') key('keydown', d, true);
        else if (!smooth) onDir(d, mode);
      } else if (!on && was) {
        repeatAt.delete(d);
        if (mode === 'keys') key('keyup', d);
      }
    }
    for (const b of ['ok', 'back', 'alt'] as Button[]) {
      const on = s.buttons.has(b);
      const was = prev.buttons.has(b);
      if (on === was) continue;
      if (b === 'alt') key(on ? 'keydown' : 'keyup', 'alt');
      else if (b === 'back') {
        if (on && !doBack() && mode === 'keys') {
          key('keydown', 'back');
          key('keyup', 'back');
        }
      } else if (mode === 'keys') key(on ? 'keydown' : 'keyup', 'ok');
      else onOk(on, mode);
    }
    prev = s;
  };

  // ---------- every frame ----------

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      const scene = topScene();
      const mode = modeOf(scene);
      if (scene !== lastScene || mode !== lastMode) {
        // A new screen: let go of anything held, start the ring afresh.
        if (pressing) up(carrying ? cursor : pressAt);
        carrying = false;
        focused = undefined;
        keyHeld.clear();
        if (mode === 'cursor' && (scene !== lastScene || (!cursor.x && !cursor.y))) cursor = { x: GW() / 2, y: GH() / 2 };
        lastScene = scene;
        lastMode = mode;
      }
      pollPads(now, mode);
      // Smooth movement: the free pointer, or something being carried.
      if (active && isSmooth(mode)) {
        let vx = 0;
        let vy = 0;
        const stick = prev.stick;
        if (stick.x || stick.y) {
          vx = stick.x;
          vy = stick.y;
        } else {
          const held = new Set([...keyHeld, ...prev.dirs]);
          held.forEach((d) => {
            vx += DIR_VEC[d].x;
            vy += DIR_VEC[d].y;
          });
          const n = Math.hypot(vx, vy);
          if (n > 0) {
            vx /= n;
            vy /= n;
          }
        }
        if (vx || vy) {
          const speed = 300 + Math.min(1, (now - moveSince) / 900) * 600;
          cursor = clamp({ x: cursor.x + vx * speed * dt, y: cursor.y + vy * speed * dt });
          mouse('mousemove', cursor.x, cursor.y);
        } else moveSince = now;
      }
      if (active && mode === 'focus' && !carrying && now - targetsAt > 150) {
        const cur = refresh(now).length ? current() : undefined;
        if (!cur && targets.length) {
          // The focused thing is gone (a new question, a pop-up): the nearest one takes over.
          const rest = targets.filter((t) => !t.back);
          const i = focused || lastPos.x || lastPos.y ? pickNearest(rest.map((t) => t.rect), lastPos) : -1;
          focus(i >= 0 ? rest[i] : initial(targets));
        }
      }
      draw(mode);
    } catch (err) {
      // Never let the helper break the game itself.
      if (import.meta.env.DEV) console.warn('pad', err);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
