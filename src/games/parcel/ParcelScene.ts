import Phaser from 'phaser';
import { startRun, track, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, ENGLISH, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import type { GameState } from '../../game-state';
import { button, COLORS, FONT, H, W } from '../../scenes/ui';
import { mulberry32, type Rng } from '../common/rng';
import {
  BOX_PAINT, checkLoad, checkPlan, choices, freshProgress, LEGS, loadId, parseProgress, planLoad, planOptions, takeId, VEHICLES, WOOD,
  type BoxColor, type Leg, type LoadTask, type Progress, type Vehicle,
} from './logic';

const STORE_KEY = 'parcel-progress';
/** Boxes that fit on the vehicle: two columns of three. */
const MAX_STACK = 6;
const INTRO_KEY = 'parcel-intro';
const PICS = ['ship', 'palm', 'cactus', 'city', 'fir', 'snowman', 'bear', 'globe', 'package', 'cloud', 'sparkles', 'mountain', 'hut', 'temple'];

/** Stops on the round route: the harbour, then where each leg arrives. */
const STOP_PICS = ['hut', 'palm', 'cactus', 'mountain', 'city', 'temple', 'fir'];
/** What lies on each leg, for the route plan. */
const TERRAIN_RU: Record<Leg['terrain'], string> = { sea: 'через море', desert: 'через пустыню', mountains: 'через горы', rails: 'по рельсам', ocean: 'через океан', snow: 'по снегу' };

const STOPS: { name: string; pic: string }[] = ['Гавань', ...LEGS.map((l) => l.place)].map((name, i) => ({ name, pic: STOP_PICS[i]! }));

// Leg screen layout: the pier on the left, the way to go on the right, a wooden board at the bottom.
const GROUND = 470;
const PIER = { x: 200, y: 400 };
const BOARD_Y = 640;
const DEST_X = 1150;

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: progress just isn't remembered */
  }
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** A wooden or painted box. */
function crateSvg(color: number): string {
  const c = hex(color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect x="8" y="12" width="84" height="80" rx="8" fill="#00000033"/>
    <rect x="8" y="6" width="84" height="80" rx="8" fill="${c}" stroke="#2b2d42" stroke-width="6"/>
    <path d="M8 30 H92 M8 62 H92" stroke="#2b2d42" stroke-opacity=".35" stroke-width="6"/>
    <path d="M20 16 C30 12 44 12 54 12" stroke="#fff" stroke-opacity=".5" stroke-width="6" stroke-linecap="round"/>
    <rect x="8" y="6" width="84" height="80" rx="8" fill="none" stroke="#2b2d42" stroke-width="6"/></svg>`;
}

const MEDAL = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="240" viewBox="0 0 200 240">
  <path d="M60 0 L100 90 L140 0Z" fill="#e63946" stroke="#2b2d42" stroke-width="6" stroke-linejoin="round"/>
  <path d="M84 0 L100 40 L116 0Z" fill="#277da1"/>
  <circle cx="100" cy="150" r="80" fill="#ffc94a" stroke="#2b2d42" stroke-width="6"/>
  <circle cx="100" cy="150" r="60" fill="#ffd166" stroke="#e09f3e" stroke-width="6"/>
  <path d="M100 104 L113 136 L148 138 L121 160 L130 194 L100 175 L70 194 L79 160 L52 138 L87 136Z" fill="#fff" stroke="#e09f3e" stroke-width="5" stroke-linejoin="round"/>
  <path d="M50 110 C60 94 76 84 92 80" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="8" stroke-linecap="round"/></svg>`;

/** Every vehicle faces left in the pictures; turn them to go right. The plane points up-right. */
function orient(img: Phaser.GameObjects.Image, v: Vehicle | 'ship') {
  if (v === 'plane') img.setAngle(40);
  else img.setFlipX(true);
  return img;
}

interface PierBox {
  color?: BoxColor;
  home: { x: number; y: number };
  img: Phaser.GameObjects.Image;
  loaded: boolean;
}

/**
 * «Кругосветная посылка»: a mysterious parcel must go round the world. On each of
 * six legs the dispatcher says in English which transport to take, then how many
 * (and later which colour) boxes to load. The magpie Treshchotka tries to snatch
 * the parcel on the way: a tap scares her off. Nothing can be lost: a wrong
 * vehicle is named in English, fails in a funny way, and the task is said again.
 */
export class ParcelScene extends Phaser.Scene {
  private rng!: Rng;
  private progress: Progress = freshProgress();
  private layer: Phaser.GameObjects.GameObject[] = [];
  private cue?: Utterance;
  private talking = false;
  private talkToken = 0;
  private lastSpoken = 0;
  private repeats = 0;
  private busy = false;
  private rumb?: Phaser.GameObjects.Image;
  private bubble?: Phaser.GameObjects.Text;
  private vehicle?: Phaser.GameObjects.Container;
  private boxes: PierBox[] = [];
  private task?: LoadTask;
  private magpieSeen = false;

  constructor() {
    super('Parcel');
  }

  preload() {
    const base = `${import.meta.env.BASE_URL}parcel/`;
    for (const id of [...VEHICLES, ...PICS]) if (!this.textures.exists(`parcel-${id}`)) this.load.image(`parcel-${id}`, `${base}${id}.webp`);
    const svgs: Record<string, string> = { 'parcel-crate-wood': crateSvg(WOOD), 'parcel-medal': MEDAL };
    for (const [c, v] of Object.entries(BOX_PAINT)) svgs[`parcel-crate-${c}`] = crateSvg(v);
    for (const [k, s] of Object.entries(svgs)) if (!this.textures.exists(k)) this.load.svg(k, `data:image/svg+xml;base64,${btoa(s)}`);
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.progress = parseProgress(readStore<unknown>(STORE_KEY, null));
    if (this.progress.leg >= LEGS.length) this.progress = { leg: 0, trips: this.progress.trips + 1 };
    this.layer = [];
    this.cue = undefined;
    this.busy = false;
    this.magpieSeen = false;
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') this.repeatCue();
    });
    void this.showMap(true);
  }

  private get childName() {
    return (this.registry.get('state') as GameState | undefined)?.profile.childName ?? 'Капитан';
  }

  private clear() {
    this.tweens.killAll();
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
    this.boxes = [];
    this.vehicle = undefined;
    this.rumb = undefined;
    this.bubble = undefined;
    this.cue = undefined;
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  // ---------- voice ----------

  private async talk(...lines: Utterance[]): Promise<boolean> {
    const token = ++this.talkToken;
    this.talking = true;
    for (const u of lines) {
      if (token !== this.talkToken) return false;
      const who = u.speaker === 'magpie' ? undefined : u.lang ? undefined : this.rumb;
      const bob = who ? this.tweens.add({ targets: who, y: who.y - 10, yoyo: true, repeat: -1, duration: 180 }) : undefined;
      voice.say(u);
      await voice.idle(7000);
      bob?.stop();
      if (bob && who) who.y = (who.getData('y') as number) ?? who.y;
    }
    if (token !== this.talkToken || !this.sys.isActive()) return false;
    this.talking = false;
    this.lastSpoken = this.time.now;
    return true;
  }

  private repeatCue() {
    if (this.talking || !this.cue) return;
    this.lastSpoken = this.time.now;
    this.run?.event('repeat');
    voice.say(this.cue);
  }

  private wait(ms: number) {
    return new Promise<boolean>((r) => this.time.delayedCall(ms, () => r(this.sys.isActive())));
  }

  update(time: number) {
    // Nothing tapped for a while: say the task again (twice at most).
    if (this.cue && !this.talking && !this.busy && this.repeats < 2 && time - this.lastSpoken > 10000) {
      this.repeats++;
      this.repeatCue();
    }
  }

  // ---------- the round map ----------

  private stopPos(i: number) {
    const a = Math.PI + (i / STOPS.length) * Math.PI * 2;
    return { x: W / 2 + Math.cos(a) * 470, y: 400 + Math.sin(a) * 215 };
  }

  private async showMap(first = false) {
    this.clear();
    const leg = this.progress.leg;
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x1b4965));
    for (let i = 0; i < 40; i++) {
      this.keep(this.add.circle(this.rng() * W, this.rng() * H, 1 + this.rng() * 2, 0xffffff, 0.3 + this.rng() * 0.4));
    }
    const globe = this.keep(this.add.image(W / 2, 400, 'parcel-globe').setDisplaySize(300, 300));
    this.tweens.add({ targets: globe, angle: 360, duration: 60000, repeat: -1 });
    // The route: a dotted ring, gold where the parcel has already been.
    const g = this.keep(this.add.graphics());
    const N = 140;
    for (let k = 0; k < N; k += 2) {
      const t = k / N;
      const a = Math.PI + t * Math.PI * 2;
      const done = t < leg / STOPS.length;
      g.fillStyle(done ? 0xffd166 : 0xffffff, done ? 1 : 0.6).fillCircle(W / 2 + Math.cos(a) * 470, 400 + Math.sin(a) * 215, done ? 5 : 3.5);
    }
    STOPS.forEach((s, i) => {
      const p = this.stopPos(i);
      this.keep(this.add.circle(p.x, p.y, 52, i <= leg ? 0xfff1d0 : 0x5fa8d3).setStrokeStyle(5, 0x2b2d42));
      this.keep(this.add.image(p.x, p.y - 4, `parcel-${s.pic}`).setDisplaySize(78, 78).setAlpha(i <= leg ? 1 : 0.55));
      this.keep(this.add.text(p.x, p.y + 70, s.name, { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0b2233', strokeThickness: 6 }).setOrigin(0.5));
    });
    const at = this.stopPos(leg % STOPS.length);
    const parcel = this.keep(this.add.image(at.x + 40, at.y - 50, 'parcel-package').setDisplaySize(80, 80).setDepth(5));
    this.tweens.add({ targets: parcel, y: parcel.y - 10, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });

    this.keep(
      this.add.text(30, 40, `${this.childName}: кругосветная посылка`, { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0b2233', strokeThickness: 8 }).setOrigin(0, 0.5),
    );
    this.drawStamps(leg);
    this.keep(button(this, 1170, 40, 'Домой', () => this.scene.start('Menu'), { w: 170, h: 64, color: 0x6c757d }));
    this.rumb = this.keep(this.add.image(90, 640, 'char-rumb').setDisplaySize(130, 130).setData('y', 640));

    const go = this.keep(button(this, W / 2, 400, 'В путь!', () => void this.startLeg(), { w: 260, h: 96, color: COLORS.leaf }));
    go.setVisible(false).setDepth(6);
    const lines: Utterance[] = [];
    if (first) {
      if (!readStore(INTRO_KEY, false)) {
        writeStore(INTRO_KEY, true);
        lines.push(phrase('rumb.parcel.hello.0'), phrase('rumb.parcel.hello.1'));
      } else if (leg > 0) {
        lines.push(phrase('rumb.parcel.again'));
      } else {
        lines.push(phrase('rumb.parcel.restart'));
      }
    }
    if (first && lines.length === 2) {
      // First time ever: the magpie shows up and the dispatcher is introduced.
      if (!(await this.talk(...lines))) return;
      const m = this.keep(this.add.image(W + 120, 160, 'char-magpie').setDisplaySize(150, 150).setDepth(7));
      this.tweens.add({ targets: m, x: 1000, y: 200, duration: 900, ease: 'Sine.easeOut' });
      if (!(await this.talk(phrase('magpie.intro')))) return;
      this.tweens.add({ targets: m, x: W + 150, y: 60, duration: 700, ease: 'Sine.easeIn' });
      if (!(await this.talk(phrase('rumb.parcel.hello.2')))) return;
    } else if (lines.length && !(await this.talk(...lines))) {
      return;
    }
    // From the second trip: plan the whole route before setting off.
    if (first && leg === 0 && this.progress.trips >= 1 && !(await this.planRoute())) return;
    go.setVisible(true);
    this.tweens.add({ targets: go, scale: 1.08, yoyo: true, repeat: -1, duration: 500 });
  }

  /** The route plan: one transport per leg, then a test run that stops where the plan breaks. */
  private async planRoute(): Promise<boolean> {
    const layer: Phaser.GameObjects.GameObject[] = [];
    const k = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(30);
      layer.push(o);
      return this.keep(o);
    };
    k(this.add.rectangle(W / 2, H / 2, W, H, 0x0b2233, 0.92).setInteractive());
    k(this.add.text(W / 2, 70, 'План маршрута', { fontFamily: FONT, fontSize: '48px', color: '#ffd166' }).setOrigin(0.5));
    const plan: (Vehicle | undefined)[] = LEGS.map(() => undefined);
    const options = LEGS.map((leg) => planOptions(leg, this.rng));
    const slots: Phaser.GameObjects.Container[] = [];
    const colX = (i: number) => 130 + i * 204;
    LEGS.forEach((leg, i) => {
      k(this.add.circle(colX(i), 200, 62, 0xfff1d0).setStrokeStyle(5, 0x2b2d42));
      k(this.add.image(colX(i), 196, `parcel-${STOPS[i + 1]!.pic}`).setDisplaySize(90, 90));
      k(this.add.text(colX(i), 282, leg.place, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5));
      k(this.add.text(colX(i), 316, TERRAIN_RU[leg.terrain], { fontFamily: FONT, fontSize: '22px', color: '#8ecae6' }).setOrigin(0.5));
      if (i < LEGS.length - 1) k(this.add.text(colX(i) + 102, 200, '→', { fontFamily: FONT, fontSize: '48px', color: '#ffd166' }).setOrigin(0.5));
      const bg = this.add.rectangle(0, 0, 170, 150, 0x1b4965).setStrokeStyle(5, 0xffd166);
      const q = this.add.text(0, 0, '?', { fontFamily: FONT, fontSize: '80px', color: '#ffd166' }).setOrigin(0.5);
      const slot = k(this.add.container(colX(i), 440, [bg, q]).setSize(170, 150).setInteractive({ useHandCursor: true }));
      slot.on('pointerup', () => {
        // Each tap shows the next transport of the three and names it in English.
        const cur = plan[i] ? options[i]!.indexOf(plan[i]!) : -1;
        const v = options[i]![(cur + 1) % options[i]!.length]!;
        plan[i] = v;
        slot.removeAll(true);
        slot.add([this.add.rectangle(0, 0, 170, 150, 0x1b4965).setStrokeStyle(5, 0xffd166), orient(this.add.image(0, 0, `parcel-${v}`).setDisplaySize(120, 120), v)]);
        voice.say(english(v));
        check.setAlpha(plan.every(Boolean) ? 1 : 0.4);
      });
      slots.push(slot);
    });
    const check = k(button(this, W / 2, 610, 'Проверить план', () => void tryPlan(), { w: 420, h: 96, color: COLORS.leaf })).setAlpha(0.4);
    let attempts = 0;
    const t0 = Date.now();
    let resolveDone!: (ok: boolean) => void;
    const done = new Promise<boolean>((r) => (resolveDone = r));
    const parcel = k(this.add.image(colX(0) - 90, 350, 'parcel-package').setDisplaySize(60, 60));
    let checking = false;
    const tryPlan = async () => {
      if (checking || !plan.every(Boolean)) return;
      checking = true;
      attempts++;
      const bad = checkPlan(plan);
      // The parcel travels along the plan and stops where it breaks.
      const stop = bad < 0 ? LEGS.length - 1 : bad;
      parcel.setPosition(colX(0) - 90, 350);
      for (let i = 0; i <= stop; i++) {
        await new Promise((r) => this.tweens.add({ targets: parcel, x: colX(i), duration: 450, onComplete: r }));
        if (!this.sys.isActive()) return resolveDone(false);
      }
      track('parcel', 'answer', { item: 'route-plan', correct: bad < 0, chosen: bad < 0 ? 'ok' : `leg${bad}-${plan[bad]}`, attempt: attempts, skill: 'planning' });
      if (bad >= 0) {
        this.tweens.add({ targets: slots[bad], angle: 8, yoyo: true, repeat: 3, duration: 90 });
        (slots[bad]!.list[0] as Phaser.GameObjects.Rectangle).setStrokeStyle(6, 0xe63946);
        checking = false;
        await this.talk(phrase('rumb.parcel.plan.fix'));
        return;
      }
      track('parcel', 'plan_done', { attempts, ms: Date.now() - t0 });
      await this.talk(phrase('rumb.parcel.plan.ok'));
      layer.forEach((o) => o.destroy());
      resolveDone(this.sys.isActive());
    };
    if (!(await this.talk(phrase('rumb.parcel.plan')))) return false;
    return done;
  }

  private drawStamps(done: number) {
    LEGS.forEach((leg, i) => {
      const x = 640 + i * 76;
      const y = 40;
      const frame = this.keep(this.add.rectangle(x, y, 62, 62, i < done ? 0xfffaf0 : 0xffffff, i < done ? 1 : 0.2).setStrokeStyle(3, 0xffffff, 0.8));
      if (i < done) {
        frame.setStrokeStyle(4, 0xe63946);
        this.keep(orient(this.add.image(x, y, `parcel-${leg.answer}`).setDisplaySize(50, 50), leg.answer));
      }
    });
  }

  // ---------- one leg ----------

  private drawStage(leg: Leg) {
    const sky = this.keep(this.add.graphics());
    const skyTop = { sea: 0x8ecae6, desert: 0xffd6a5, mountains: 0xa9def9, rails: 0xbde0fe, ocean: 0x90e0ef, snow: 0xcaf0f8 }[leg.terrain];
    sky.fillGradientStyle(skyTop, skyTop, 0xffffff, 0xffffff, 1).fillRect(0, 0, W, GROUND);
    const g = this.keep(this.add.graphics());
    const water = (top: number) => {
      g.fillStyle(0x5fa8d3).fillRect(0, top, W, BOARD_Y - top);
      g.lineStyle(4, 0xffffff, 0.6);
      for (let y = top + 24; y < BOARD_Y - 60; y += 34) for (let x = (y / 2) % 80; x < W; x += 120) g.beginPath().arc(x, y, 16, Math.PI * 1.1, Math.PI * 1.9).strokePath();
    };
    switch (leg.terrain) {
      case 'sea':
        water(GROUND);
        g.fillStyle(0xf4d58d).fillEllipse(DEST_X + 40, GROUND + 10, 300, 70);
        this.keep(this.add.image(DEST_X + 40, GROUND - 70, 'parcel-palm').setDisplaySize(160, 160));
        break;
      case 'ocean':
        water(GROUND - 40);
        g.fillStyle(0xadb5bd).fillEllipse(DEST_X + 60, GROUND - 30, 260, 60);
        this.keep(this.add.image(DEST_X + 50, GROUND - 110, 'parcel-temple').setDisplaySize(150, 150));
        for (let k = 0; k < 4; k++) {
          const c = this.keep(this.add.image(350 + k * 230, 90 + (k % 2) * 60, 'parcel-cloud').setDisplaySize(140, 140).setAlpha(0.9));
          this.tweens.add({ targets: c, x: c.x - 60, yoyo: true, repeat: -1, duration: 4000 + k * 500, ease: 'Sine.easeInOut' });
        }
        break;
      case 'desert':
        g.fillStyle(0xe9c46a).fillRect(0, GROUND, W, BOARD_Y - GROUND);
        g.fillStyle(0xf4d58d);
        for (let x = 300; x < W; x += 260) g.fillEllipse(x, GROUND + 10, 340, 90);
        g.fillStyle(0xffb703).fillCircle(1050, 110, 60);
        this.keep(this.add.image(560, GROUND - 40, 'parcel-cactus').setDisplaySize(110, 110));
        this.keep(this.add.image(820, GROUND - 30, 'parcel-cactus').setDisplaySize(80, 80));
        g.fillStyle(0x5fa8d3).fillEllipse(DEST_X + 30, GROUND + 20, 200, 40);
        this.keep(this.add.image(DEST_X + 50, GROUND - 70, 'parcel-palm').setDisplaySize(150, 150));
        break;
      case 'mountains':
        g.fillStyle(0x74c69d).fillRect(0, GROUND, W, BOARD_Y - GROUND);
        g.fillStyle(0x9aa5b1).lineStyle(6, 0x2b2d42);
        g.fillTriangle(560, GROUND, 760, 180, 900, GROUND).strokeTriangle(560, GROUND, 760, 180, 900, GROUND);
        g.fillStyle(0x6c757d).fillTriangle(700, GROUND, 1000, 230, 1280, GROUND).strokeTriangle(700, GROUND, 1000, 230, 1280, GROUND);
        g.fillStyle(0xffffff).fillTriangle(1000, 230, 958, 280, 1042, 280).fillTriangle(760, 180, 732, 230, 788, 230);
        break;
      case 'rails':
        g.fillStyle(0xadb5bd).fillRect(0, GROUND, W, BOARD_Y - GROUND);
        // A skyline of tall houses with lit windows.
        for (let x = 350, k = 0; x < W - 20; k++) {
          const w = 80 + ((k * 37) % 50);
          const h = 140 + ((k * 53) % 160);
          const col = [0x577590, 0x4d908e, 0xf9844a, 0x90be6d, 0x277da1][k % 5]!;
          g.fillStyle(col).lineStyle(5, 0x2b2d42).fillRect(x, GROUND - h, w, h).strokeRect(x, GROUND - h, w, h);
          g.fillStyle(0xffe066);
          for (let wy = GROUND - h + 16; wy < GROUND - 30; wy += 30) for (let wx = x + 12; wx < x + w - 18; wx += 24) g.fillRect(wx, wy, 12, 16);
          x += w + 8;
        }
        g.fillStyle(0x7a4a24);
        for (let x = 0; x < W; x += 40) g.fillRect(x, GROUND + 14, 18, 40);
        g.fillStyle(0x495057).fillRect(0, GROUND + 18, W, 8).fillRect(0, GROUND + 42, W, 8);
        break;
      case 'snow':
        g.fillStyle(0xf8f9fa).fillRect(0, GROUND, W, BOARD_Y - GROUND);
        g.fillStyle(0xffffff).lineStyle(4, 0xced4da);
        for (let x = 380; x < W; x += 240) g.fillEllipse(x, GROUND + 6, 280, 60).strokeEllipse(x, GROUND + 6, 280, 60);
        this.keep(this.add.image(560, GROUND - 60, 'parcel-fir').setDisplaySize(130, 130));
        this.keep(this.add.image(760, GROUND - 50, 'parcel-snowman').setDisplaySize(110, 110));
        this.keep(this.add.image(900, GROUND - 60, 'parcel-fir').setDisplaySize(150, 150));
        this.keep(this.add.image(DEST_X + 40, GROUND - 40, 'parcel-bear').setDisplaySize(110, 110));
        for (let k = 0; k < 24; k++) {
          const f = this.keep(this.add.circle(this.rng() * W, this.rng() * GROUND, 3 + this.rng() * 3, 0xffffff, 0.9));
          this.tweens.add({ targets: f, y: f.y + 200, x: f.x - 40, alpha: 0, duration: 3000 + this.rng() * 3000, repeat: -1 });
        }
        break;
    }
    // Pier.
    if (leg.terrain === 'sea' || leg.terrain === 'ocean') {
      g.fillStyle(0x7a4a24);
      for (let x = 40; x < 340; x += 80) g.fillRect(x, GROUND, 16, BOARD_Y - GROUND);
    }
    g.fillStyle(0xa5683a).lineStyle(5, 0x5c3317).fillRect(0, GROUND - 6, 340, 26).strokeRect(-4, GROUND - 6, 344, 26);
    // Where the parcel goes.
    g.lineStyle(5, 0x2b2d42).lineBetween(DEST_X + 110, GROUND - 10, DEST_X + 110, GROUND - 130);
    g.fillStyle(0xffd166).fillRect(DEST_X + 110, GROUND - 130, 56, 36).strokeRect(DEST_X + 110, GROUND - 130, 56, 36);
    this.keep(
      this.add.text(DEST_X + 40, GROUND + 60, leg.place, { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#2b2d42', strokeThickness: 7 }).setOrigin(0.5),
    );
    // The wooden board at the bottom: pictures to choose, boxes to load.
    const b = this.keep(this.add.graphics());
    b.fillStyle(0x8d5524).fillRect(0, BOARD_Y - 60, W, H - BOARD_Y + 60);
    b.lineStyle(4, 0x5c3317);
    for (let y = BOARD_Y - 60; y < H; y += 40) b.lineBetween(0, y, W, y);
    b.lineStyle(6, 0x5c3317).lineBetween(0, BOARD_Y - 60, W, BOARD_Y - 60);
  }

  /** Top bar: the dispatcher's radio with a bubble ("?" until solved), repeat and home buttons. */
  private drawTopBar() {
    const radio = this.keep(this.add.graphics({ x: 60, y: 60 }));
    radio.fillStyle(0x2b2d42).fillRoundedRect(-36, -30, 72, 60, 12);
    radio.fillStyle(0x52b788).fillCircle(-12, 0, 12);
    radio.fillStyle(0xffd166).fillRect(8, -14, 18, 6).fillRect(8, -2, 18, 6).fillRect(8, 10, 18, 6);
    radio.lineStyle(5, 0x2b2d42).lineBetween(20, -30, 34, -52);
    this.keep(this.add.text(60, 108, 'Dispatcher', { fontFamily: FONT, fontSize: '18px', color: '#2b2d42', fontStyle: 'bold' }).setOrigin(0.5));
    const bg = this.keep(this.add.rectangle(380, 60, 560, 84, 0xfffaf0).setStrokeStyle(5, 0x2b2d42));
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.repeatCue());
    this.keep(this.add.triangle(102, 60, 0, 0, 14, -12, 14, 12, 0xfffaf0));
    this.bubble = this.keep(this.add.text(380, 60, '?', { fontFamily: FONT, fontSize: '40px', color: '#277da1', fontStyle: 'bold' }).setOrigin(0.5));
    const listen = this.keep(button(this, 870, 60, '     Ещё раз', () => this.repeatCue(), { w: 280, h: 84, color: COLORS.leaf }));
    const icon = this.add.graphics({ x: -96, y: 0 });
    icon.fillStyle(0xffffff).fillRect(-22, -12, 14, 24).fillTriangle(-10, -12, 10, -28, 10, 28).fillTriangle(-10, 12, 10, -28, 10, 28);
    icon.lineStyle(5, 0xffffff).beginPath().arc(14, 0, 14, -0.9, 0.9).strokePath();
    listen.add(icon);
    this.keep(button(this, 1170, 60, 'Домой', () => this.scene.start('Menu'), { w: 170, h: 64, color: 0x6c757d }));
    this.rumb = this.keep(this.add.image(80, GROUND - 210, 'char-rumb').setDisplaySize(110, 110).setData('y', GROUND - 210));
  }

  private reveal(text: string) {
    if (!this.bubble) return;
    this.bubble.setText(text).setColor('#1b4332');
    this.tweens.add({ targets: this.bubble, scale: { from: 0.7, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  }

  private hideBubble() {
    this.bubble?.setText('?').setColor('#277da1');
  }

  private run?: Run;

  private async startLeg() {
    const i = this.progress.leg;
    const leg = LEGS[i]!;
    this.run = startRun('parcel', { leg: i, trips: this.progress.trips });
    this.clear();
    this.drawStage(leg);
    this.drawTopBar();
    this.busy = true;
    const parcel = this.keep(this.add.image(PIER.x + 70, GROUND - 40, 'parcel-package').setDisplaySize(80, 80));
    this.tweens.add({ targets: parcel, angle: { from: -3, to: 3 }, yoyo: true, repeat: -1, duration: 700 });

    const options = choices(leg, this.rng);
    const n = options.length;
    const cards = options.map((v, k) => {
      const x = W / 2 + (k - (n - 1) / 2) * 230;
      const bg = this.add.rectangle(0, 0, 200, 120, 0xfffaf0).setStrokeStyle(5, 0x2b2d42);
      const img = orient(this.add.image(0, 0, `parcel-${v}`).setDisplaySize(110, 110), v);
      const c = this.keep(this.add.container(x, BOARD_Y, [bg, img]).setSize(200, 120).setDepth(6));
      c.setScale(0);
      this.tweens.add({ targets: c, scale: 1, delay: k * 120, duration: 350, ease: 'Back.easeOut' });
      return { v, c, img, used: false };
    });

    this.cue = english(takeId(leg.answer));
    this.repeats = 0;
    if (!(await this.talk(phrase(`rumb.parcel.leg.${i}` as PhraseId), this.cue))) return;
    this.busy = false;
    this.run?.ask(takeId(leg.answer), { kind: 'vehicle', options: n });

    for (const card of cards) {
      card.c.setInteractive({ useHandCursor: true });
      card.c.on('pointerup', async () => {
        if (this.busy || this.talking || card.used) return;
        this.busy = true;
        this.repeats = 0;
        this.run?.answer({ item: takeId(leg.answer), correct: card.v === leg.answer, chosen: card.v === leg.answer ? undefined : card.v, kind: 'vehicle' });
        if (card.v === leg.answer) {
          cards.forEach((o) => o.c.disableInteractive());
          await this.chooseRight(leg, card.v, card.c, cards.map((o) => o.c), parcel);
          return;
        }
        card.used = true;
        card.c.setAlpha(0.4);
        await this.failRide(leg, card.v, i);
        this.busy = false;
      });
    }
  }

  private makeVehicle(v: Vehicle, x = PIER.x, y = PIER.y) {
    const img = orient(this.add.image(0, 0, `parcel-${v}`).setDisplaySize(200, 200), v);
    return this.keep(this.add.container(x, y, [img]).setDepth(4));
  }

  private async failRide(leg: Leg, v: Vehicle, i: number) {
    const car = this.makeVehicle(v);
    car.setAlpha(0);
    this.tweens.add({ targets: car, alpha: 1, duration: 200 });
    const out = leg.fail === 'bump' ? 640 : 500;
    await new Promise<void>((r) => this.tweens.add({ targets: car, x: out, duration: 900, ease: 'Quad.easeIn', onComplete: () => r() }));
    const speech = this.talk(english(v));
    if (leg.fail === 'sink') {
      for (let k = 0; k < 8; k++) {
        const bub = this.keep(this.add.circle(car.x + (this.rng() - 0.5) * 120, car.y + 40, 6 + this.rng() * 8).setStrokeStyle(3, 0xffffff).setDepth(5));
        this.tweens.add({ targets: bub, y: bub.y - 120 - this.rng() * 60, alpha: 0, delay: k * 90, duration: 900, onComplete: () => bub.destroy() });
      }
      this.tweens.add({ targets: car, y: car.y + 140, angle: 25, alpha: 0, duration: 1100, ease: 'Quad.easeIn' });
    } else if (leg.fail === 'stuck') {
      const dust = leg.terrain === 'snow' ? 0xffffff : leg.terrain === 'desert' ? 0xf4d58d : 0xced4da;
      for (let k = 0; k < 10; k++) {
        const p = this.keep(this.add.circle(car.x - 60 + this.rng() * 120, GROUND, 10 + this.rng() * 10, dust).setStrokeStyle(2, 0x2b2d42, 0.3).setDepth(5));
        this.tweens.add({ targets: p, y: p.y - 40 - this.rng() * 50, x: p.x - 40, alpha: 0, delay: k * 80, duration: 800, onComplete: () => p.destroy() });
      }
      this.tweens.add({ targets: car, x: car.x + 10, yoyo: true, repeat: 6, duration: 70 });
      this.tweens.add({ targets: car, y: car.y + 30, delay: 600, duration: 500 });
      this.tweens.add({ targets: car, alpha: 0, delay: 1300, duration: 400 });
    } else {
      this.cameras.main.shake(150, 0.006);
      for (let k = 0; k < 6; k++) {
        const s = this.keep(this.add.star(car.x + 60, car.y - 60, 5, 6, 14, 0xffd166).setDepth(6));
        const a = (k / 6) * Math.PI * 2;
        this.tweens.add({ targets: s, x: s.x + Math.cos(a) * 70, y: s.y + Math.sin(a) * 70, alpha: 0, duration: 700, onComplete: () => s.destroy() });
      }
      this.tweens.add({ targets: car, x: car.x - 200, angle: -360, duration: 900, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: car, alpha: 0, delay: 900, duration: 400 });
    }
    if (!(await speech)) return;
    await this.wait(300);
    car.destroy();
    await this.talk(phrase(`rumb.parcel.hint.${i}` as PhraseId), this.cue!);
  }

  private async chooseRight(leg: Leg, v: Vehicle, card: Phaser.GameObjects.Container, all: Phaser.GameObjects.Container[], parcel: Phaser.GameObjects.Image) {
    this.cue = undefined;
    for (const c of all) if (c !== card) this.tweens.add({ targets: c, alpha: 0, scale: 0.5, duration: 300 });
    this.tweens.add({ targets: card, alpha: 0, duration: 300 });
    this.reveal(ENGLISH[takeId(v)]!);
    this.vehicle = this.makeVehicle(v, card.x, card.y);
    this.vehicle.setScale(0.55);
    this.tweens.add({ targets: this.vehicle, x: PIER.x, y: PIER.y, scale: 1, duration: 600, ease: 'Back.easeOut' });
    await this.wait(600);
    // The parcel hops on.
    const top = { x: PIER.x + 45, y: PIER.y + (v === 'camel' ? -95 : -80) };
    this.tweens.killTweensOf(parcel);
    await new Promise<void>((r) =>
      this.tweens.add({ targets: parcel, x: top.x, y: top.y, angle: 0, displayWidth: 70, displayHeight: 70, duration: 500, ease: 'Quad.easeOut', onComplete: () => r() }),
    );
    parcel.destroy();
    this.vehicle.add(this.add.image(top.x - PIER.x, top.y - PIER.y, 'parcel-package').setDisplaySize(70, 70));
    const yes = phrase(`rumb.parcel.yes.${Math.floor(this.rng() * 3)}` as PhraseId);
    if (!(await this.talk(english(v), yes))) return;
    all.forEach((c) => c.destroy());
    await this.startLoad(leg);
  }

  // ---------- loading boxes ----------

  private async startLoad(leg: Leg) {
    this.hideBubble();
    this.task = planLoad(leg, this.rng);
    const task = this.task;
    // Lets the automated play-through find the boxes (only under a test driver).
    if (navigator.webdriver) (window as unknown as { __parcelPier: unknown }).__parcelPier = task.pier;
    this.boxes = task.pier.map((color, k) => {
      const home = { x: 300 + k * 96, y: BOARD_Y };
      const img = this.keep(this.add.image(home.x, home.y, `parcel-crate-${color ?? 'wood'}`).setDisplaySize(82, 82).setDepth(6));
      img.setScale(0);
      this.tweens.add({ targets: img, scaleX: 0.82, scaleY: 0.82, delay: k * 60, duration: 250, ease: 'Back.easeOut' });
      const box: PierBox = { color, home, img, loaded: false };
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.toggleBox(box));
      return box;
    });
    const go = this.keep(button(this, 1150, BOARD_Y, 'Вперёд!', () => void this.checkBoxes(leg), { w: 210, h: 96, color: COLORS.leaf }).setDepth(6));
    this.cue = english(loadId(task.n, task.color));
    this.repeats = 0;
    const lines: Utterance[] = [];
    if (this.progress.leg === 0 || !readStore('parcel-load-intro', false)) {
      writeStore('parcel-load-intro', true);
      lines.push(phrase('rumb.parcel.load.intro'));
    }
    this.busy = true;
    go.setAlpha(0.6);
    if (!(await this.talk(...lines, this.cue))) return;
    go.setAlpha(1);
    this.busy = false;
    this.run?.ask(loadId(task.n, task.color), { kind: 'load', n: task.n, color: task.color ?? null });
  }

  private loadedBoxes() {
    return this.boxes.filter((b) => b.loaded);
  }

  /** Where the k-th loaded box sits: a little stack behind the parcel. */
  private slot(k: number) {
    const v = this.vehicle!;
    return { x: v.x - 75 + (k % 2) * 44, y: v.y - 40 - Math.floor(k / 2) * 42 };
  }

  private toggleBox(box: PierBox) {
    if (this.busy || this.talking || !this.vehicle) return;
    this.lastSpoken = this.time.now;
    this.repeats = 0;
    if (box.loaded) {
      box.loaded = false;
      this.tweens.add({ targets: box.img, x: box.home.x, y: box.home.y, scaleX: 0.82, scaleY: 0.82, duration: 300, ease: 'Quad.easeOut' });
      this.restack();
      return;
    }
    if (this.loadedBoxes().length >= MAX_STACK) return;
    box.loaded = true;
    const p = this.slot(this.loadedBoxes().length - 1);
    box.img.setDepth(5);
    this.tweens.add({ targets: box.img, x: p.x, y: p.y, scaleX: 0.46, scaleY: 0.46, duration: 350, ease: 'Back.easeOut' });
  }

  private restack() {
    this.loadedBoxes().forEach((b, k) => {
      const p = this.slot(k);
      this.tweens.add({ targets: b.img, x: p.x, y: p.y, duration: 200 });
    });
  }

  private unloadAll() {
    for (const b of this.loadedBoxes()) {
      b.loaded = false;
      b.img.setDepth(6);
      this.tweens.add({ targets: b.img, x: b.home.x, y: b.home.y, scaleX: 0.82, scaleY: 0.82, duration: 400, ease: 'Quad.easeOut' });
    }
  }

  private async checkBoxes(leg: Leg) {
    if (this.busy || this.talking || !this.task) return;
    this.busy = true;
    this.repeats = 0;
    const loaded = this.loadedBoxes();
    const res = checkLoad(this.task, loaded.map((b) => b.color));
    this.run?.answer({
      item: loadId(this.task.n, this.task.color), correct: res.ok, kind: 'load',
      why: res.ok ? undefined : res.why, chosen: res.ok ? undefined : String(loaded.length),
    });
    if (res.ok) {
      this.cue = undefined;
      this.reveal(ENGLISH[loadId(this.task.n, this.task.color)]!);
      for (const b of this.boxes) b.img.disableInteractive();
      // The loaded boxes ride along; the rest stay on the pier.
      for (const b of loaded) {
        const v = this.vehicle!;
        this.tweens.killTweensOf(b.img);
        this.layer = this.layer.filter((o) => o !== b.img);
        b.img.setPosition(b.img.x - v.x, b.img.y - v.y);
        v.add(b.img);
      }
      if (!(await this.talk(english('goodjob')))) return;
      await this.travel(leg);
      return;
    }
    this.cameras.main.shake(120, 0.003);
    let first: Utterance;
    let what: Utterance;
    if (res.why === 'color') {
      first = english(res.wrong);
      what = phrase('rumb.parcel.load.color');
    } else {
      first = english(`n${res.count}`);
      what = phrase(res.why === 'many' ? 'rumb.parcel.load.many' : 'rumb.parcel.load.few');
    }
    this.unloadAll();
    await this.talk(first, what, this.cue!);
    this.busy = false;
  }

  // ---------- travel, the magpie, arrival ----------

  private async travel(leg: Leg) {
    const v = this.vehicle!;
    const i = this.progress.leg;
    this.busy = true;
    this.boxes.forEach((b) => this.tweens.add({ targets: b.img, alpha: 0, duration: 300 }));
    void this.talk(phrase('rumb.parcel.go'));
    const flying = leg.answer === 'plane' || leg.answer === 'helicopter';
    const end = leg.terrain === 'mountains' ? { x: 1000, y: 175 } : { x: DEST_X - 40, y: PIER.y };
    const duration = 5200;
    if (flying) {
      this.tweens.add({ targets: v, y: leg.terrain === 'mountains' ? 200 : 260, duration: duration * 0.35, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: v, y: end.y, delay: duration * 0.75, duration: duration * 0.25, ease: 'Sine.easeIn' });
    } else {
      this.tweens.add({ targets: v, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 260 });
    }
    const ride = new Promise<void>((r) => this.tweens.add({ targets: v, x: end.x, duration, ease: 'Sine.easeInOut', onComplete: () => r() }));
    this.time.delayedCall(900, () => void this.magpieAttack(v));
    await ride;
    this.tweens.killTweensOf(v);
    v.setAngle(0);
    if (!this.sys.isActive()) return;
    await this.waitMagpie();
    // Arrived: a stamp for this leg.
    this.burst(v.x, v.y - 60);
    this.progress = { ...this.progress, leg: i + 1 };
    writeStore(STORE_KEY, this.progress);
    this.run?.end({ completed: true, leg: i });
    if (!(await this.talk(phrase(`rumb.parcel.arrive.${i}` as PhraseId)))) return;
    if (this.progress.leg >= LEGS.length) await this.finale();
    else await this.showMap();
  }

  private magpieDone: Promise<void> = Promise.resolve();

  private waitMagpie() {
    return this.magpieDone;
  }

  private magpieAttack(v: Phaser.GameObjects.Container) {
    let resolve!: () => void;
    this.magpieDone = new Promise((r) => (resolve = r));
    const m = this.keep(this.add.image(W + 100, 120, 'char-magpie').setDisplaySize(130, 130).setDepth(9));
    let gone = false;
    const leave = (shooed: boolean) => {
      if (gone) return;
      gone = true;
      this.run?.event('magpie', { shooed });
      m.disableInteractive();
      this.tweens.killTweensOf(m);
      this.tweens.add({ targets: m, x: W + 200, y: -100, angle: shooed ? 30 : 0, duration: 800, ease: 'Quad.easeIn' });
      const line = shooed ? phrase(`magpie.shoo.${Math.floor(this.rng() * 2)}` as PhraseId) : phrase('magpie.miss');
      void this.talk(line).then(() => resolve());
    };
    const above = () => Math.max(170, v.y - 170);
    const follow = () => this.tweens.add({ targets: m, x: v.x + 90, y: above(), duration: 900, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: m, x: v.x + 160, y: Math.max(170, v.y - 200), duration: 900, ease: 'Sine.easeOut',
      onComplete: () => {
        if (gone) return;
        follow();
        this.time.addEvent({ delay: 300, repeat: 8, callback: () => !gone && this.tweens.add({ targets: m, x: v.x + 90, y: above(), duration: 280 }) });
      },
    });
    m.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      for (let k = 0; k < 8; k++) {
        const f = this.keep(this.add.ellipse(m.x, m.y, 14, 26, 0x22223b).setDepth(9));
        this.tweens.add({ targets: f, x: f.x + (this.rng() - 0.5) * 160, y: f.y + 60 + this.rng() * 80, angle: 200, alpha: 0, duration: 900, onComplete: () => f.destroy() });
      }
      leave(true);
    });
    const lines: Utterance[] = [phrase(`magpie.attack.${Math.floor(this.rng() * 3)}` as PhraseId)];
    lines.push(phrase(this.magpieSeen ? 'rumb.parcel.magpie.1' : 'rumb.parcel.magpie.0'));
    this.magpieSeen = true;
    void this.talk(...lines);
    // Not tapped in time: she grabs at the parcel, bumps off it and gives up.
    this.time.delayedCall(4200, () => {
      if (gone) return;
      this.tweens.add({ targets: m, x: v.x + 20, y: v.y - 90, duration: 250, yoyo: true, onComplete: () => leave(false) });
    });
  }

  private burst(x: number, y: number) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const s = this.keep(this.add.star(x, y, 5, 6, 14, k % 2 ? 0xffd166 : 0xffffff).setDepth(8));
      this.tweens.add({ targets: s, x: x + Math.cos(a) * 110, y: y + Math.sin(a) * 110, alpha: 0, angle: 180, duration: 800, onComplete: () => s.destroy() });
    }
  }

  // ---------- the end of the trip ----------

  private async finale() {
    this.clear();
    // Back on the map: the ship sails from Alaska to the harbour, closing the ring.
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x1b4965));
    const globe = this.keep(this.add.image(W / 2, 400, 'parcel-globe').setDisplaySize(300, 300));
    this.tweens.add({ targets: globe, angle: 360, duration: 30000, repeat: -1 });
    const g = this.keep(this.add.graphics());
    for (let k = 0; k < 140; k += 2) {
      const a = Math.PI + (k / 140) * Math.PI * 2;
      g.fillStyle(0xffd166).fillCircle(W / 2 + Math.cos(a) * 470, 400 + Math.sin(a) * 215, 5);
    }
    STOPS.forEach((s, i) => {
      const p = this.stopPos(i);
      this.keep(this.add.circle(p.x, p.y, 52, 0xfff1d0).setStrokeStyle(5, 0x2b2d42));
      this.keep(this.add.image(p.x, p.y - 4, `parcel-${s.pic}`).setDisplaySize(78, 78));
    });
    this.drawStamps(LEGS.length);
    this.rumb = this.keep(this.add.image(90, 640, 'char-rumb').setDisplaySize(130, 130).setData('y', 640));
    const ship = this.keep(orient(this.add.image(0, 0, 'parcel-ship').setDisplaySize(130, 130), 'ship').setDepth(5));
    const from = 6 / STOPS.length;
    const pos = { t: from };
    const place = () => {
      const a = Math.PI + pos.t * Math.PI * 2;
      ship.setPosition(W / 2 + Math.cos(a) * 470, 400 + Math.sin(a) * 215 - 30);
    };
    place();
    await new Promise<void>((r) => this.tweens.add({ targets: pos, t: 1, duration: 2600, ease: 'Sine.easeInOut', onUpdate: place, onComplete: () => r() }));
    if (!(await this.talk(phrase('rumb.parcel.final.0'), phrase('rumb.parcel.final.1')))) return;

    // The parcel is opened.
    const shade = this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(10));
    shade.setInteractive();
    this.keep(this.add.rectangle(W / 2, 390, 1000, 600, 0xfff1d0).setStrokeStyle(8, 0x8d5524).setDepth(10));
    const box = this.keep(this.add.image(W / 2, 380, 'parcel-package').setDisplaySize(260, 260).setDepth(11));
    this.tweens.add({ targets: box, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 120 });
    if (!(await this.talk(phrase('rumb.parcel.final.2')))) return;
    this.tweens.killTweensOf(box);
    this.tweens.add({ targets: box, scale: box.scale * 1.3, alpha: 0, duration: 400 });
    this.burst(W / 2, 380);
    for (const [x, y] of [[W / 2 - 330, 230], [W / 2 + 330, 250], [W / 2, 200]] as const) {
      const sp = this.keep(this.add.image(x, y, 'parcel-sparkles').setDisplaySize(90, 90).setDepth(11));
      this.tweens.add({ targets: sp, scale: sp.scale * 1.25, yoyo: true, repeat: -1, duration: 600 });
    }
    const medal = this.keep(this.add.image(W / 2 - 150, 360, 'parcel-medal').setDisplaySize(200, 240).setDepth(12));
    const globe2 = this.keep(this.add.image(W / 2 + 160, 380, 'parcel-globe').setDisplaySize(200, 200).setDepth(12));
    for (const o of [medal, globe2]) {
      const sx = o.scaleX;
      const sy = o.scaleY;
      o.setScale(0);
      this.tweens.add({ targets: o, scaleX: sx, scaleY: sy, duration: 500, ease: 'Back.easeOut' });
    }
    this.keep(
      this.add.text(W / 2, 150, 'Кругосветный капитан!', { fontFamily: FONT, fontSize: '56px', color: '#ffd166', stroke: '#2b2d42', strokeThickness: 10 }).setOrigin(0.5).setDepth(12),
    );
    if (!(await this.talk(phrase('rumb.parcel.final.3')))) return;
    const m = this.keep(this.add.image(W + 100, 200, 'char-magpie').setDisplaySize(150, 150).setDepth(12));
    await new Promise<void>((r) => this.tweens.add({ targets: m, x: 1010, y: 500, duration: 900, ease: 'Sine.easeOut', onComplete: () => r() }));
    if (!(await this.talk(phrase('magpie.final'), phrase('rumb.parcel.final.4'), phrase('magpie.thanks')))) return;
    this.tweens.add({ targets: m, y: m.y - 20, yoyo: true, repeat: -1, duration: 300 });
    this.keep(
      button(this, W / 2 - 170, 620, 'Ещё раз', () => {
        writeStore(STORE_KEY, { leg: 0, trips: this.progress.trips + 1 });
        this.scene.restart();
      }, { w: 300, h: 90, color: COLORS.leaf }).setDepth(12),
    );
    this.keep(button(this, W / 2 + 170, 620, 'Домой', () => this.scene.start('Menu'), { w: 300, h: 90, color: 0x6c757d }).setDepth(12));
  }
}
