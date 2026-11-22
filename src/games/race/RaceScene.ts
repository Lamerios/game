import Phaser from 'phaser';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { recordWord } from '../../core/wordLog';
import { levelLog, nextLevelSmart, statsFromRun } from '../../core/smartLevel';
import { english, ENGLISH, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import type { GameState } from '../../game-state';
import { button, FONT, H, W } from '../../scenes/ui';
import { mulberry32, pick, shuffle, type Rng } from '../common/rng';
import { COLORS, numberOf, PICTURES } from '../snake/logic';
import {
  ARCH, BILLBOARD, CAR_H, CAR_W, carSvg, CLOUD, COIN, colorBlobSvg, CONE, GARAGE, houseSvg, ISLAND, lampSvg, MOON, NITRO, PALETTES, PART, PLANE_H, PLANE_W,
  planeSvg, SHIP, skylineSvg, STAR, STAR_OFF, STORM, SUN, TRAFFIC_LIGHT, TREE, WRENCH, type Palette,
} from './art';
import { runGarage } from './garage';
import { runPitStop } from './pitstop';
import {
  BOOST_AFTER, boosterTask, boostSteps, carById, carLine, CARS, PLANES, planeLine, CRASHES_TO_PIT, FLAWLESS_BONUS, isFlawless, landingOptions, LINE_MAX, freshProgress, parseProgress, planRace, PRAISE_LINES,
  isPractice, LEVEL_RULES, levelStats, recordRace, ROWS_PER_RACE, withLevel, starsFor, TRACKS, unlocked, type BoostTask, type Card, type Progress, type Row, type Track,
} from './logic';

const STORE_KEY = 'race-progress';
const HELLO_KEY = 'race-hello';

// ---------- the pseudo-3D camera ----------
/** Screen line of the horizon. */
const HOR = 300;
/** Pixels per road unit at distance 1. */
const FOCAL = 440;
/** Camera height above the road, in road units. */
const CAM_H = 0.94;
/** Nothing is drawn farther than this. */
const ZFAR = 60;
const ZNEAR = 0.7;
/** Where the car's front bumper is: boards and cones are hit here. */
const Z_HIT = 1.3;
/** Word boards appear this far ahead. */
const Z_SPAWN = 46;
/** Road stripes: one light and one dark segment make a pair. */
const SEG = 1.3;
const LANE_W = 1;
const RUMBLE = 0.14;
const WALK = 1.5;
const CAR_PX = 300;
const CAR_Y = 700;
/** Boards closer than this slow the car to SLOW of its speed. */
const SLOW_Z = 18;
const SLOW = 0.75;
const LANE_COLORS = [0x3a86ff, 0xf77f00, 0x8338ec, 0x06d6a0];
/** Plane: distance between the two card heights, and how far below the sea is. */
const ALT_STEP = 1.1;
const SEA_Y = -5;
/** The plane's camera sits higher above it than the car's, so the cards ahead stay in sight. */
const PLANE_CAM = 1.3;
/** Plane cards are smaller than road boards so two heights fit with their balloons. */
const AIR_W = 0.6;
const PLANE_PX = 330;
/** Nitro: seconds of full speed and a bit more. */
const NITRO_S = 3;

interface Thing {
  /** Position along the road. */
  s: number;
  x: number;
  /** Width in road units. */
  w: number;
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Container;
  /** Natural size of obj, for scaling. */
  baseW: number;
  kind: 'scenery' | 'board' | 'cone' | 'arch';
  /** Height above the road (plane cards and clouds). */
  y?: number;
  lane?: number;
  /** Height step of a plane card or storm cloud. */
  h?: number;
  word?: string;
  gone?: boolean;
  /** A cone already passed the car. */
  checked?: boolean;
  /** Boards of a passed row fade out so they don't cover the car. */
  fade?: number;
  /** For things that fly away after a hit. */
  fly?: { vx: number; vy: number; spin: number; t: number };
}

type RowResult = { ok: true; word: string } | { ok: false; word: string };
export type { Thing };

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
    /* private mode */
  }
}

const toUri = (s: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s)))}`;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(c1: number, c2: number, t: number): number {
  const r = lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t);
  const g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t);
  const b = lerp(c1 & 255, c2 & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/**
 * «Гонка слов»: pick a race car, then drive through the city seen from behind
 * the car. The voice says an English word; word boards stand across the lanes;
 * drive into the right one (left/right to change lanes, up/down for speed).
 * A wrong board or a cone is a crash; after three crashes the car goes to the
 * pit stop: ten squats, ten push-ups and a maze. After the car tracks comes the
 * plane: three lanes and two heights, up/down to climb and dive.
 * 10 right words = 3 stars, 7 = 2, 5 = 1; a race without mistakes brings a new car.
 */
export class RaceScene extends Phaser.Scene {
  private rng!: Rng;
  private progress: Progress = freshProgress();
  private layer: Phaser.GameObjects.GameObject[] = [];
  private talkToken = 0;
  private talking = false;
  private run = 0;

  // race state
  private track!: Track;
  private trackIdx = 0;
  private pal!: Palette;
  private rows: Row[] = [];
  private things: Thing[] = [];
  private pos = 0;
  private speed = 0;
  private driving = false;
  private carX = 0;
  private lane = 1;
  private camX = 0;
  private curve = 0;
  private nextHouse = 0;
  private nextProp = 0;
  private correct = 0;
  /** Where the car is on the number line 0–LINE_MAX. */
  private linePos = 0;
  private lineCar?: Phaser.GameObjects.Container;
  private lineText?: Phaser.GameObjects.Text;
  private results: (boolean | undefined)[] = [];
  private crashes = 0;
  /** Slows the car down to 75% while word boards come close. */
  private slow = 1;
  /** Speed while the car rolls to a stop after a crash. */
  private coast = 0;
  /** What the car really does now, road units per second. */
  private shown = 0;
  /** Analytics run of the current race. */
  private tele?: Run;
  private sincePit = 0;
  private coneHit = false;
  private coneTold = false;
  private hits: string[] = [];
  private missed: string[] = [];
  private cue?: Utterance;
  private cueRepeated = false;
  private pendingRow?: { s: number; row: Row; done: (r: RowResult) => void };
  private spin = 0;
  private gas = false;
  private brake = false;
  private streaks: { a: number; r: number; v: number }[] = [];
  /** Plane: which height step it flies at, where it is now, and the camera height. */
  private plane = false;
  private alt = 0;
  private planeY = 0;
  private camY = CAM_H;
  /** Cones / storm clouds hit and words asked in this race. */
  private bumps = 0;
  private asked: string[] = [];
  /** Booster answers in this race, for the smart level. */
  private boostRight = 0;
  private boostTotal = 0;
  private nitroLeft = 0;
  private nitroBtn?: Phaser.GameObjects.Container;
  private nitroText?: Phaser.GameObjects.Text;

  // objects
  private road?: Phaser.GameObjects.Graphics;
  private fx?: Phaser.GameObjects.Graphics;
  private skyline?: Phaser.GameObjects.TileSprite;
  private car?: Phaser.GameObjects.Image;
  private brakeGlow?: Phaser.GameObjects.Ellipse;
  private needle?: Phaser.GameObjects.Graphics;
  private kmh?: Phaser.GameObjects.Text;
  private dots: Phaser.GameObjects.Arc[] = [];
  private wrenches: Phaser.GameObjects.Image[] = [];
  private raccoon?: Phaser.GameObjects.Image;
  private subtitle?: Phaser.GameObjects.Text;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('Race');
  }

  preload() {
    const base = `${import.meta.env.BASE_URL}snake/`;
    for (const w of PICTURES) if (!this.textures.exists(`snake-${w.id}`)) this.load.image(`snake-${w.id}`, `${base}${w.id}.webp`);
    const svgs: Record<string, string> = {
      'race-tree': TREE, 'race-traffic': TRAFFIC_LIGHT, 'race-billboard': BILLBOARD, 'race-cone': CONE, 'race-arch': ARCH,
      'race-cloud': CLOUD, 'race-moon': MOON, 'race-sun': SUN, 'race-wrench': WRENCH, 'race-star': STAR, 'race-star-off': STAR_OFF,
      'race-lamp-off': lampSvg(false), 'race-lamp-on': lampSvg(true), 'race-storm': STORM, 'race-island': ISLAND, 'race-ship': SHIP,
      'race-coin': COIN, 'race-nitro': NITRO, 'race-part': PART, 'race-garage': GARAGE,
    };
    for (const c of CARS) svgs[`race-car-${c.id}`] = carSvg(c);
    for (const c of PLANES) svgs[`race-plane-${c.id}`] = planeSvg(c);
    for (const c of COLORS) svgs[`race-${c.id}`] = colorBlobSvg(c.paint);
    for (const [time, pal] of Object.entries(PALETTES)) {
      svgs[`race-skyline-${time}`] = skylineSvg(pal);
      for (let i = 0; i < 8; i++) svgs[`race-house-${time}-${i}`] = houseSvg(i, pal);
    }
    for (const [k, s] of Object.entries(svgs)) if (!this.textures.exists(k)) this.load.svg(k, toUri(s));
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.progress = parseProgress(readStore<unknown>(STORE_KEY, null));
    this.layer = [];
    this.things = [];
    this.driving = false;
    this.events.once('shutdown', () => {
      this.talkToken++;
      this.run++;
      voice.stop();
    });
    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('UP,DOWN,LEFT,RIGHT,W,S,A,D,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
      kb.on('keydown', (e: KeyboardEvent) => {
        if (!this.driving) return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.steer(-1);
        if (e.code === 'ArrowRight' || e.code === 'KeyD') this.steer(1);
        if (this.plane && (e.code === 'ArrowUp' || e.code === 'KeyW')) this.climb(1);
        if (this.plane && (e.code === 'ArrowDown' || e.code === 'KeyS')) this.climb(-1);
        if (e.code === 'KeyN' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.useNitro();
        if (e.code === 'Space' || e.code === 'Enter') this.repeatCue();
        if (e.code.startsWith('Arrow')) e.preventDefault();
      });
    }
    this.showMenu();
  }

  private get childName() {
    return (this.registry.get('state') as GameState | undefined)?.profile.childName ?? 'Гонщик';
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private clear() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
    this.things.forEach((t) => t.obj.destroy());
    this.things = [];
    this.dots = [];
    this.wrenches = [];
    this.streaks = [];
    this.driving = false;
    this.pendingRow = undefined;
    this.cue = undefined;
    this.road = this.fx = this.needle = undefined;
    this.skyline = undefined;
    this.car = undefined;
    this.raccoon = undefined;
    this.subtitle = undefined;
  }

  // ---------- voice ----------

  private async talk(...lines: Utterance[]): Promise<boolean> {
    const token = ++this.talkToken;
    this.talking = true;
    for (const u of lines) {
      if (token !== this.talkToken) return false;
      const russian = !u.lang;
      if (russian && this.subtitle) this.subtitle.setText(u.show).setVisible(true);
      const who = russian ? this.raccoon : undefined;
      const y0 = who?.y ?? 0;
      const bob = who ? this.tweens.add({ targets: who, y: y0 - 8, yoyo: true, repeat: -1, duration: 170 }) : undefined;
      voice.say(u);
      await voice.idle(8000);
      bob?.stop();
      if (who) who.y = y0;
    }
    if (token !== this.talkToken || !this.sys.isActive()) return false;
    this.talking = false;
    this.subtitle?.setVisible(false);
    return true;
  }

  private ru(id: string) {
    return phrase(id as PhraseId);
  }

  private repeatCue() {
    if (this.talking || !this.cue) return;
    this.tele?.event('repeat');
    voice.say(this.cue);
  }

  private wait(ms: number, run = this.run) {
    return new Promise<boolean>((r) => this.time.delayedCall(ms, () => r(this.sys.isActive() && run === this.run)));
  }

  // ---------- sounds made on the fly ----------

  private get audio(): AudioContext | undefined {
    return (this.sound as Phaser.Sound.WebAudioSoundManager).context;
  }

  private beep(freqs: number[], dur = 0.12, type: OscillatorType = 'triangle', vol = 0.12) {
    const ctx = this.audio;
    if (!ctx) return;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      const t = ctx.currentTime + i * dur;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.6);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur * 1.7);
    });
  }

  private crashSound() {
    const ctx = this.audio;
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }

  // ---------- menu: car and track ----------

  private save() {
    writeStore(STORE_KEY, this.progress);
  }

  private showMenu() {
    this.clear();
    const bg = this.keep(this.add.graphics());
    bg.fillGradientStyle(0x14213d, 0x14213d, 0x3a0ca3, 0x3a0ca3, 1).fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) bg.fillStyle(i % 2 ? 0xffffff : 0x222222, 0.9).fillRect(i * 32, 452, 32, 14).fillStyle(i % 2 ? 0x222222 : 0xffffff, 0.9).fillRect(i * 32, 466, 32, 14);
    this.keep(
      this.add.text(W / 2, 46, 'Гонка слов', { fontFamily: FONT, fontSize: '58px', color: '#ffd166', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 10 }).setOrigin(0.5),
    );
    this.keep(button(this, 1170, 46, 'Домой', () => this.scene.start('Menu'), { w: 170, h: 64, color: 0x6c757d }));
    this.raccoon = this.keep(this.add.image(80, 70, 'char-raccoon').setDisplaySize(130, 130));
    this.subtitle = this.keep(
      this.add
        .text(W / 2, 690, '', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', backgroundColor: '#14213dcc', padding: { x: 14, y: 8 }, align: 'center', wordWrap: { width: 1100 } })
        .setOrigin(0.5)
        .setDepth(50)
        .setVisible(false),
    );

    // the chosen car on a podium; tap to hear its name
    const car = carById(this.progress.car);
    this.keep(this.add.ellipse(330, 330, 380, 70, 0xffd166, 0.9).setStrokeStyle(5, 0x14213d));
    const img = this.keep(this.add.image(330, 330, `race-car-${car.id}`).setOrigin(0.5, 0.92).setScale(0.75));
    this.tweens.add({ targets: img, y: 320, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.easeInOut' });
    img.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.beep([660, 880], 0.08);
      void this.talk(english(carLine(car.id)));
    });
    this.keep(this.add.text(330, 380, car.name, { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#14213d', strokeThickness: 6 }).setOrigin(0.5));
    const g = this.keep(button(this, 760, 210, '         Гараж', () => this.openGarage(), { w: 340, h: 100, color: 0xe63946 }));
    g.add(this.add.image(-108, 0, 'race-garage').setDisplaySize(84, 72));
    // coins, nitro, cars
    this.keep(this.add.image(660, 320, 'race-coin').setDisplaySize(56, 56));
    this.keep(this.add.text(700, 320, String(this.progress.coins), { fontFamily: FONT, fontSize: '40px', color: '#ffd166', fontStyle: 'bold' }).setOrigin(0, 0.5));
    this.keep(this.add.image(830, 320, 'race-nitro').setDisplaySize(40, 56));
    this.keep(this.add.text(860, 320, `${this.progress.nitro}`, { fontFamily: FONT, fontSize: '40px', color: '#7dd3fc', fontStyle: 'bold' }).setOrigin(0, 0.5));
    this.keep(
      this.add
        .text(1000, 320, `Машин: ${this.progress.cars.length} из ${CARS.length}\nСамолётов: ${this.progress.planes.length} из ${PLANES.length}\nБез ошибок: ${this.progress.flawless}`, { fontFamily: FONT, fontSize: '26px', color: '#ffffff', lineSpacing: 6 })
        .setOrigin(0, 0.5),
    );
    this.keep(
      this.add
        .text(760, 400, `Без ошибок на трассе «${TRACKS[this.progress.level]!.name}» и труднее — новая машина или самолёт!`, { fontFamily: FONT, fontSize: '22px', color: '#adb5bd', align: 'center', wordWrap: { width: 700 } })
        .setOrigin(0.5),
    );

    TRACKS.forEach((t, i) => {
      const x = 140 + i * 250;
      const y = 585;
      const open = unlocked(this.progress, i);
      const pal = PALETTES[t.time];
      const card = this.keep(this.add.container(x, y));
      const gr = this.add.graphics();
      gr.fillStyle(0x000000, 0.3).fillRoundedRect(-112, -76, 232, 170, 16);
      gr.fillGradientStyle(pal.skyTop, pal.skyTop, pal.skyBottom, pal.skyBottom, 1).fillRect(-115, -85, 230, 95);
      if (t.vehicle === 'car') {
        gr.fillStyle(pal.grass[0]).fillRect(-115, 10, 230, 75);
        gr.fillStyle(pal.road[0]).fillTriangle(-80, 85, 80, 85, 0, 10);
        gr.fillStyle(0xffffff).fillRect(-3, 28, 6, 12).fillRect(-4, 54, 8, 20);
      } else {
        gr.fillStyle(t.time === 'day' ? 0x219ebc : 0xffc8dd).fillRect(-115, 10, 230, 75);
        gr.fillStyle(0xffffff, 0.5).fillRect(-115, 30, 230, 4).fillRect(-115, 56, 230, 4);
      }
      gr.lineStyle(6, open ? 0xffd166 : 0x6c757d).strokeRoundedRect(-115, -85, 230, 170, 16);
      card.add(gr);
      if (t.vehicle === 'plane') card.add(this.add.image(0, 34, `race-plane-${this.progress.plane}`).setDisplaySize(105, 65));
      card.add(this.add.text(0, -62, t.name, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 6 }).setOrigin(0.5));
      card.add(this.add.text(0, -30, t.vehicle === 'car' ? `машина · ${t.lanes} полосы` : 'самолёт', { fontFamily: FONT, fontSize: '17px', color: '#14213d', backgroundColor: '#ffd166', padding: { x: 6, y: 2 } }).setOrigin(0.5));
      const stars = this.progress.stars[i] ?? 0;
      for (let k = 0; k < 3; k++) card.add(this.add.image(-48 + k * 48, t.vehicle === 'car' ? 58 : 70, k < stars ? 'race-star' : 'race-star-off').setDisplaySize(40, 40));
      if (!open) {
        card.add(this.add.rectangle(0, 0, 230, 170, 0x000000, 0.5));
        const lock = this.add.graphics();
        lock.lineStyle(9, 0xffd166).beginPath().arc(0, 0, 18, Math.PI, 0).strokePath();
        lock.fillStyle(0xffd166).fillRoundedRect(-26, 0, 52, 40, 7);
        card.add(lock);
      }
      // the child's own track and the easier ones (practice)
      if (open && i === this.progress.level) {
        card.add(this.add.rectangle(0, -98, 170, 30, 0xffd166).setStrokeStyle(3, 0x14213d));
        card.add(this.add.text(0, -98, 'твоя трасса', { fontFamily: FONT, fontSize: '18px', color: '#14213d', fontStyle: 'bold' }).setOrigin(0.5));
      } else if (isPractice(this.progress, i)) {
        card.add(this.add.rectangle(0, -98, 150, 28, 0x6c757d).setStrokeStyle(2, 0xffffff));
        card.add(this.add.text(0, -98, 'тренировка', { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5));
      }
      card.setSize(230, 170).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => card.setScale(0.96));
      card.on('pointerout', () => card.setScale(1));
      card.on('pointerup', () => {
        card.setScale(1);
        if (!open) {
          void this.talk(this.ru('raccoon.race.locked'));
          return;
        }
        this.beep([520, 780], 0.08);
        this.startRace(i);
      });
    });

    if (!readStore<boolean>(HELLO_KEY, false)) {
      writeStore(HELLO_KEY, true);
      void this.talk(this.ru('raccoon.race.hello'), this.ru('raccoon.race.rules'));
    } else {
      void this.talk(this.ru('raccoon.race.hello'));
    }
  }

  private openGarage() {
    this.clear();
    this.run++;
    const run = this.run;
    void runGarage(this.garageHost(), run).then(() => {
      if (run === this.run && this.sys.isActive()) this.showMenu();
    });
  }

  /** What the garage and the pit stop need from the scene. */
  private garageHost() {
    return {
      scene: this as Phaser.Scene,
      rng: this.rng,
      progress: () => this.progress,
      setProgress: (p: Progress) => {
        this.progress = p;
        this.save();
      },
      keep: <T extends Phaser.GameObjects.GameObject>(o: T) => this.keep(o),
      talk: (...u: Utterance[]) => this.talk(...u),
      ru: (id: string) => this.ru(id),
      beep: (f: number[], d?: number) => this.beep(f, d),
      wait: (ms: number, run: number) => this.wait(ms, run),
      alive: (run: number) => run === this.run && this.sys.isActive(),
      setRaccoon: (img?: Phaser.GameObjects.Image, sub?: Phaser.GameObjects.Text) => {
        this.raccoon = img;
        this.subtitle = sub;
      },
    };
  }

  // ---------- the race ----------

  private laneX(i: number) {
    return (i - (this.track.lanes - 1) / 2) * LANE_W;
  }

  private get roadHalf() {
    return (this.track.lanes * LANE_W) / 2;
  }

  /** Bend of the road at distance z: the far end swings, the car stays put. */
  private bend(z: number) {
    return this.curve * z * z;
  }

  private project(z: number, x: number, y = 0) {
    const k = FOCAL / z;
    return { x: W / 2 + (x + this.bend(z) - this.camX) * k, y: HOR + (this.camY - y) * k, k };
  }

  private altY(h: number) {
    return h * ALT_STEP;
  }

  private startRace(idx: number) {
    this.clear();
    this.run++;
    this.trackIdx = idx;
    this.track = TRACKS[idx]!;
    this.pal = PALETTES[this.track.time];
    this.rows = planRace(this.track, this.rng, this.progress.misses, this.progress.seen);
    this.plane = this.track.vehicle === 'plane';
    this.tele = startRun('race', { track: idx, car: this.progress.car, lanes: this.track.lanes, rows: this.rows.length, vehicle: this.track.vehicle });
    this.pos = 0;
    this.speed = 0;
    this.lane = Math.floor((this.track.lanes - 1) / 2);
    this.carX = this.laneX(this.lane);
    this.camX = this.carX * 0.8;
    this.curve = 0;
    this.nextHouse = -2;
    this.nextProp = 0;
    this.correct = 0;
    this.boostRight = this.boostTotal = 0;
    this.linePos = 0;
    this.results = this.rows.map(() => undefined);
    this.crashes = 0;
    this.sincePit = 0;
    this.coneHit = false;
    this.coneTold = false;
    this.hits = [];
    this.missed = [];
    this.spin = 0;
    this.gas = this.brake = false;
    this.alt = 0;
    this.planeY = 0;
    this.camY = this.plane ? PLANE_CAM : CAM_H;
    this.bumps = 0;
    this.asked = [];
    this.nitroLeft = 0;

    // sky, sun or moon, clouds, the far city
    const sky = this.keep(this.add.graphics().setDepth(-30));
    sky.fillGradientStyle(this.pal.skyTop, this.pal.skyTop, this.pal.skyBottom, this.pal.skyBottom, 1).fillRect(0, 0, W, HOR + 2);
    if (this.track.time === 'night') {
      for (let i = 0; i < 70; i++) sky.fillStyle(0xffffff, 0.4 + this.rng() * 0.6).fillCircle(this.rng() * W, this.rng() * (HOR - 60), this.rng() * 1.8 + 0.6);
      this.keep(this.add.image(980, 90, 'race-moon').setDisplaySize(130, 130).setDepth(-29));
    } else {
      this.keep(this.add.image(this.track.time === 'day' ? 1000 : 640, this.track.time === 'day' ? 90 : 230, 'race-sun').setDisplaySize(this.track.time === 'day' ? 150 : 220, this.track.time === 'day' ? 150 : 220).setDepth(-29));
      for (let i = 0; i < 4; i++) {
        const cl = this.keep(this.add.image(this.rng() * W, 50 + this.rng() * 120, 'race-cloud').setScale(0.6 + this.rng() * 0.6).setAlpha(this.track.time === 'day' ? 0.95 : 0.6).setDepth(-28));
        this.tweens.add({ targets: cl, x: cl.x - 300, duration: 40000 + this.rng() * 30000, repeat: -1, onRepeat: () => (cl.x = W + 150) });
      }
    }
    if (!this.plane) this.skyline = this.keep(this.add.tileSprite(0, HOR + 4, W, 160, `race-skyline-${this.track.time}`).setOrigin(0, 1).setDepth(-27));

    this.road = this.keep(this.add.graphics().setDepth(-20));
    this.fx = this.keep(this.add.graphics().setDepth(1900));

    // the car
    this.car = this.plane
      ? this.keep(this.add.image(W / 2, CAR_Y, `race-plane-${this.progress.plane}`).setOrigin(0.5, 0.9).setDisplaySize(PLANE_PX, (PLANE_PX * PLANE_H) / PLANE_W).setDepth(2000))
      : this.keep(this.add.image(W / 2, CAR_Y, `race-car-${this.progress.car}`).setOrigin(0.5, 1).setDisplaySize(CAR_PX, (CAR_PX * CAR_H) / CAR_W).setDepth(2000));
    this.brakeGlow = this.keep(this.add.ellipse(W / 2, CAR_Y - 90, 320, 60, 0xff3030, 0).setDepth(2001));

    this.drawHud();
    this.bindTouch();
    for (let i = 0; i < 40; i++) this.spawnScenery();
    if (!this.plane) this.addThing({ s: 3, x: 0, w: this.roadHalf * 2 + 0.6, kind: 'arch', key: 'race-arch' });
    void this.raceLoop(this.run);
  }

  private drawHud() {
    // word dots
    const panel = this.keep(this.add.graphics().setDepth(3000));
    panel.fillStyle(0x14213d, 0.7).fillRoundedRect(150, 14, 44 * ROWS_PER_RACE + 20, 56, 28);
    this.dots = this.rows.map((_, i) => this.keep(this.add.circle(176 + i * 44, 42, 15, 0xffffff, 0.35).setStrokeStyle(3, 0xffffff).setDepth(3001)));
    // crashes until the pit stop
    panel.fillStyle(0x14213d, 0.7).fillRoundedRect(150, 78, 3 * 54 + 16, 50, 25);
    this.wrenches = Array.from({ length: CRASHES_TO_PIT }, (_, i) => this.keep(this.add.image(182 + i * 54, 103, 'race-wrench').setDisplaySize(40, 40).setAlpha(0.3).setDepth(3001)));
    this.raccoon = this.keep(this.add.image(70, 70, 'char-raccoon').setDisplaySize(120, 120).setDepth(3001));
    this.subtitle = this.keep(
      this.add
        .text(W / 2, 170, '', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', backgroundColor: '#14213dcc', padding: { x: 14, y: 8 }, align: 'center', wordWrap: { width: 900 } })
        .setOrigin(0.5)
        .setDepth(3400)
        .setVisible(false),
    );
    this.keep(button(this, 1180, 42, 'Домой', () => this.scene.start('Menu'), { w: 170, h: 64, color: 0x6c757d }).setDepth(3001));
    const listen = this.keep(button(this, 990, 42, '      Ещё', () => this.repeatCue(), { w: 180, h: 64, color: 0x2a9d8f }).setDepth(3001));
    const icon = this.add.graphics({ x: -52, y: 0 });
    icon.fillStyle(0xffffff).fillRect(-18, -9, 11, 18).fillTriangle(-8, -9, 8, -22, 8, 22).fillTriangle(-8, 9, 8, -22, 8, 22);
    icon.lineStyle(4, 0xffffff).beginPath().arc(11, 0, 10, -0.9, 0.9).strokePath().beginPath().arc(11, 0, 19, -0.9, 0.9).strokePath();
    listen.add(icon);
    this.drawNumberLine();
    // speedometer
    const sp = this.keep(this.add.graphics({ x: 1180, y: 190 }).setDepth(3000));
    sp.fillStyle(0x14213d, 0.85).fillCircle(0, 0, 76).lineStyle(6, 0xffffff).strokeCircle(0, 0, 76);
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * 0.75 + (k / 10) * Math.PI * 1.5;
      sp.lineStyle(k % 5 ? 3 : 5, k >= 8 ? 0xff4d4d : 0xffffff).lineBetween(Math.cos(a) * 58, Math.sin(a) * 58, Math.cos(a) * 70, Math.sin(a) * 70);
    }
    this.needle = this.keep(this.add.graphics({ x: 1180, y: 190 }).setDepth(3001));
    this.kmh = this.keep(this.add.text(1180, 232, '0', { fontFamily: FONT, fontSize: '28px', color: '#ffd166', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3002));
    this.keep(this.add.text(1180, 258, 'км/ч', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setDepth(3002));
    // nitro bottles bought in the garage
    this.nitroBtn = undefined;
    if (this.progress.nitro > 0) {
      const ring = this.add.circle(0, 0, 52, 0xf77f00, 0.9).setStrokeStyle(5, 0xffffff);
      const icon = this.add.image(-8, 0, 'race-nitro').setDisplaySize(44, 62);
      this.nitroText = this.add.text(30, 24, String(this.progress.nitro), { fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 5 }).setOrigin(0.5);
      this.nitroBtn = this.keep(this.add.container(1180, 350, [ring, icon, this.nitroText]).setSize(110, 110).setDepth(3001).setInteractive({ useHandCursor: true }));
      this.nitroBtn.on('pointerdown', () => this.useNitro());
      this.keep(this.add.text(1180, 412, 'нитро', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5).setDepth(3001));
    }
  }

  private lineX(n: number) {
    return 390 + (n / LINE_MAX) * 540;
  }

  /** A straight number line 0–30 under the word dots: right words move the car along it. */
  private drawNumberLine() {
    const g = this.keep(this.add.graphics().setDepth(3000));
    g.fillStyle(0x14213d, 0.7).fillRoundedRect(360, 76, 600, 58, 20);
    g.lineStyle(4, 0xffffff).lineBetween(this.lineX(0), 96, this.lineX(LINE_MAX), 96);
    for (let n = 0; n <= LINE_MAX; n++) {
      const big = n % 5 === 0;
      g.lineStyle(big ? 4 : 2, 0xffffff, big ? 1 : 0.6).lineBetween(this.lineX(n), big ? 87 : 90, this.lineX(n), big ? 105 : 102);
      if (big) this.keep(this.add.text(this.lineX(n), 120, String(n), { fontFamily: FONT, fontSize: '17px', color: '#ffd166' }).setOrigin(0.5).setDepth(3001));
    }
    const dot = this.add.circle(0, 0, 11, 0xe63946).setStrokeStyle(3, 0xffffff);
    this.lineText = this.add.text(0, -21, '0', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 5 }).setOrigin(0.5);
    this.lineCar = this.keep(this.add.container(this.lineX(0), 96, [dot, this.lineText]).setDepth(3002));
  }

  private stepLine(n: number) {
    this.linePos = Math.max(0, Math.min(LINE_MAX, n));
    this.lineText?.setText(String(this.linePos));
    if (this.lineCar) this.tweens.add({ targets: this.lineCar, x: this.lineX(this.linePos), duration: 260, ease: 'Quad.easeOut' });
  }

  /**
   * Booster after rows 4, 8 and 11. The task grows with the track: pick the
   * bigger booster; two boosters at once (a sum); which pair gives more; or an
   * oil puddle (headwind for the plane) that rolls the car back. Then guess
   * where we land and count the steps aloud in English.
   */
  private async booster(after: number, run: number): Promise<boolean> {
    const ok = () => run === this.run && this.sys.isActive();
    const task: BoostTask = boosterTask(this.track.boost, after, this.linePos, this.rng);
    const layer: Phaser.GameObjects.GameObject[] = [];
    const d = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(3200);
      layer.push(this.keep(o));
      return o;
    };
    d(this.add.rectangle(W / 2, 420, 820, 320, 0x14213d, 0.92).setStrokeStyle(5, 0xffd166));
    const title = d(this.add.text(W / 2, 305, '', { fontFamily: FONT, fontSize: '34px', color: '#ffd166', align: 'center', wordWrap: { width: 780 } }).setOrigin(0.5));
    const choose = <T,>(opts: { label: string; v: T; color: number; w?: number }[], y: number) =>
      new Promise<T>((resolve) => {
        const gap = Math.max(230, (opts[0]?.w ?? 200) + 40);
        const btns = opts.map((o, i) => d(button(this, W / 2 + (i - (opts.length - 1) / 2) * gap, y, o.label, () => {
          btns.forEach((x) => x.destroy());
          resolve(o.v);
        }, { w: o.w ?? 200, h: 110, color: o.color })));
      });
    const from = this.linePos;
    let v: number;
    const t0 = Date.now();
    if (task.kind === 'compare') {
      title.setText('Бустер! Какой больше?');
      void this.talk(this.ru('raccoon.race.boost'));
      const opts = this.rng() < 0.5 ? [task.a, task.b] : [task.b, task.a];
      v = await choose(opts.map((x) => ({ label: `+${x}`, v: x, color: 0xe76f51 })), 430);
      if (!ok()) return false;
      const best = Math.max(task.a, task.b);
      this.tele?.answer({ item: `boost-${task.a}-${task.b}`, correct: v === best, chosen: String(v), ms: Date.now() - t0, skill: 'compare' });
      this.boostTotal++;
      if (v === best) this.boostRight++;
      if (v !== best && !(await this.talk(this.ru('raccoon.race.boost.small')))) return false;
    } else if (task.kind === 'pairs') {
      title.setText('Какая пара бустеров даёт больше?');
      void this.talk(this.ru('raccoon.race.boost.pairs'));
      const sa = task.a[0] + task.a[1];
      const sb = task.b[0] + task.b[1];
      const opts = this.rng() < 0.5 ? [task.a, task.b] : [task.b, task.a];
      v = await choose(opts.map((x) => ({ label: `+${x[0]}  и  +${x[1]}`, v: x[0] + x[1], color: 0xe76f51, w: 300 })), 430);
      if (!ok()) return false;
      this.tele?.answer({ item: `pairs-${task.a.join('+')}-${task.b.join('+')}`, correct: v === Math.max(sa, sb), chosen: String(v), ms: Date.now() - t0, skill: 'add_compare' });
      this.boostTotal++;
      if (v === Math.max(sa, sb)) this.boostRight++;
      if (v !== Math.max(sa, sb) && !(await this.talk(this.ru('raccoon.race.boost.small')))) return false;
    } else if (task.kind === 'sum') {
      v = task.a + task.b;
    } else {
      v = -task.a;
    }
    // where do we land?
    const t1 = Date.now();
    if (task.kind === 'sum') {
      title.setText(`Два бустера: +${task.a} и +${task.b}. Мы на ${from}. Куда приедем?`);
      void this.talk(this.ru('raccoon.race.boost.sum'));
    } else if (task.kind === 'minus') {
      title.setText(`${this.plane ? 'Встречный ветер' : 'Лужа масла'}! Назад на ${task.a}. Мы на ${from}. Куда попадём?`);
      void this.talk(this.ru(this.plane ? 'raccoon.race.wind' : 'raccoon.race.oil'));
    } else {
      title.setText(`Мы на ${from}, едем +${v}. Куда приедем?`);
      void this.talk(this.ru('raccoon.race.where'));
    }
    const landing = landingOptions(from, v, this.rng);
    const guess = await choose(landing.map((x) => ({ label: String(x), v: x, color: 0x277da1 })), 450);
    if (!ok()) return false;
    const right = Math.max(0, Math.min(LINE_MAX, from + boostSteps(task, v)));
    this.tele?.answer({ item: `land-${from}${v < 0 ? '' : '+'}${v}`, correct: guess === right, chosen: String(guess), ms: Date.now() - t1, skill: task.kind === 'minus' ? 'subtract' : task.kind === 'compare' ? 'number_line' : 'add' });
    this.boostTotal++;
    if (guess === right) this.boostRight++;
    title.setText(task.kind === 'sum' ? `${from} + ${task.a} + ${task.b} = ${right}` : v < 0 ? `${from} − ${-v} = ${right}` : `${from} + ${v} = ${right}`);
    if (guess !== right && v > 0) {
      // a wrong count burns the booster out: the car stays where it was
      title.setText(`${title.text}\nНеверно, бустер сгорел!`);
      this.tele?.event('boost.fizzle', { from, right, guess });
      this.beep([300, 200, 120], 0.12, 'sawtooth', 0.06);
      this.cameras.main.shake(250, 0.005);
      for (let k = 0; k < 8; k++) {
        const puff = d(this.add.circle(W / 2 + (k - 3.5) * 40, 520, 26, 0x6c757d, 0.8));
        this.tweens.add({ targets: puff, y: 440 - this.rng() * 60, scale: 1.8, alpha: 0, duration: 900, delay: k * 40 });
      }
      if (!(await this.talk(this.ru('raccoon.race.boost.fizzle'), english(`n${right}`)))) return false;
      if (!(await this.wait(1500, run))) return false;
      layer.forEach((o) => o.destroy());
      return this.talk(this.ru('raccoon.race.boost.fizzle.next'));
    }
    if (task.kind === 'minus') this.cameras.main.shake(300, 0.006);
    // count on (or back), one step per number, in English
    const dir = right >= from ? 1 : -1;
    for (let n = from + dir; dir > 0 ? n <= right : n >= right; n += dir) {
      this.stepLine(n);
      this.beep([440 + n * 12], 0.08);
      if (n > 0) voice.say(english(`n${n}`));
      if (!(await this.wait(750, run))) return false;
    }
    layer.forEach((o) => o.destroy());
    return this.talk(guess === right ? this.ru('raccoon.race.where.yes') : this.ru('raccoon.race.where.no'));
  }

  private useNitro() {
    if (!this.driving || this.nitroLeft > 0 || this.progress.nitro <= 0 || this.spin > 0) return;
    this.progress = { ...this.progress, nitro: this.progress.nitro - 1 };
    this.save();
    this.nitroLeft = NITRO_S;
    this.nitroText?.setText(String(this.progress.nitro));
    if (this.progress.nitro <= 0) this.nitroBtn?.setAlpha(0.35);
    this.beep([220, 330, 440, 660], 0.06, 'sawtooth', 0.05);
    voice.say(english('race.nitro'));
    this.tele?.event('nitro');
  }

  /** On-screen controls: lane arrows on the left, pedals on the right; swipes work too. */
  private bindTouch() {
    const mk = (x: number, y: number, r: number, color: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      const g = this.add.graphics();
      g.fillStyle(color, 0.85).fillCircle(0, 0, r).lineStyle(5, 0xffffff, 0.9).strokeCircle(0, 0, r);
      draw(g);
      const c = this.keep(this.add.container(x, y, [g]).setSize(r * 2, r * 2).setDepth(3000).setInteractive());
      return c;
    };
    const arrow = (dir: number) => (g: Phaser.GameObjects.Graphics) => g.fillStyle(0xffffff).fillTriangle(dir * 26, 0, -dir * 16, -26, -dir * 16, 26);
    const left = mk(90, 620, 62, 0x14213d, arrow(-1));
    const right = mk(240, 620, 62, 0x14213d, arrow(1));
    left.on('pointerdown', () => this.steer(-1));
    right.on('pointerdown', () => this.steer(1));
    const pedal = (x: number, label: string, color: number, set: (on: boolean) => void) => {
      const c = mk(x, 620, 62, color, (g) => {
        g.fillStyle(0xffffff).fillTriangle(0, label === 'up' ? -30 : 30, -24, label === 'up' ? 4 : -4, 24, label === 'up' ? 4 : -4);
        g.fillStyle(0xffffff).fillRect(-8, label === 'up' ? 2 : -24, 16, 22);
      });
      c.on('pointerdown', () => set(true));
      c.on('pointerup', () => set(false));
      c.on('pointerout', () => set(false));
      return c;
    };
    if (this.plane) {
      // the plane flies at one speed: up and down change the height instead
      const upDown = (dir: number) => (g: Phaser.GameObjects.Graphics) => g.fillStyle(0xffffff).fillTriangle(0, -dir * 28, -26, dir * 16, 26, dir * 16);
      mk(1190, 540, 58, 0x277da1, upDown(1)).on('pointerdown', () => this.climb(1));
      mk(1190, 670, 58, 0x277da1, upDown(-1)).on('pointerdown', () => this.climb(-1));
      this.keep(this.add.text(1090, 540, 'выше', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#14213d', strokeThickness: 4 }).setOrigin(0.5).setDepth(3000));
      this.keep(this.add.text(1090, 670, 'ниже', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#14213d', strokeThickness: 4 }).setOrigin(0.5).setDepth(3000));
    } else {
      pedal(1190, 'up', 0x38b000, (on) => (this.gas = on));
      pedal(1040, 'down', 0xc1121f, (on) => (this.brake = on));
      this.keep(this.add.text(1190, 700, 'газ', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(3000));
      this.keep(this.add.text(1040, 700, 'тормоз', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(3000));
    }
    // swipe on the road
    const zone = this.keep(this.add.zone(W / 2, 450, 700, 400).setInteractive().setDepth(10));
    let start: { x: number; y: number } | undefined;
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => (start = { x: p.x, y: p.y }));
    zone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!start) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      start = undefined;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) this.steer(dx > 0 ? 1 : -1);
      else if (Math.abs(dy) > 40 && this.plane) this.climb(dy < 0 ? 1 : -1);
      else if (Math.abs(dy) > 40) this.speed = Phaser.Math.Clamp(this.speed + (dy < 0 ? 3 : -3), this.track.minSpeed, this.track.maxSpeed);
    });
  }

  private climb(d: number) {
    if (!this.driving || !this.plane || this.spin > 0) return;
    const next = Phaser.Math.Clamp(this.alt + d, 0, this.track.heights - 1);
    if (next === this.alt) return;
    this.alt = next;
    this.beep([d > 0 ? 520 : 360], 0.06, 'sine', 0.05);
  }

  private steer(d: number) {
    if (!this.driving || this.spin > 0) return;
    const next = Phaser.Math.Clamp(this.lane + d, 0, this.track.lanes - 1);
    if (next === this.lane) return;
    this.lane = next;
    this.beep([300], 0.05, 'sine', 0.05);
  }

  private addThing(o: { s: number; x: number; y?: number; w: number; kind: Thing['kind']; key?: string; obj?: Phaser.GameObjects.Container; baseW?: number; lane?: number; h?: number; word?: string }) {
    const obj = o.obj ?? this.add.image(0, 0, o.key!).setOrigin(0.5, 1);
    obj.setVisible(false);
    const baseW = o.baseW ?? (obj as Phaser.GameObjects.Image).width;
    const t: Thing = { s: o.s, x: o.x, y: o.y, w: o.w, obj, baseW, kind: o.kind, lane: o.lane, h: o.h, word: o.word };
    this.things.push(t);
    return t;
  }

  /** Houses along both sides, with lamps, trees and the odd billboard at the kerb. */
  private spawnScenery() {
    const far = this.pos + ZFAR;
    if (this.plane) {
      const day = this.track.time === 'day';
      // far below: islands and ships on the sea, or a floor of clouds
      while (this.nextHouse < far) {
        for (const side of [-1, 1]) {
          const x = side * (3 + this.rng() * 9);
          if (day) {
            const ship = this.rng() < 0.35;
            this.addThing({ s: this.nextHouse + this.rng() * 3, x, y: SEA_Y, w: ship ? 2.2 : 4, kind: 'scenery', key: ship ? 'race-ship' : 'race-island' });
          } else {
            this.addThing({ s: this.nextHouse + this.rng() * 3, x, y: SEA_Y, w: 6 + this.rng() * 4, kind: 'scenery', key: 'race-cloud' });
          }
        }
        this.nextHouse += day ? 6 : 4;
      }
      // white clouds in the air beside the lanes
      while (this.nextProp < far) {
        const side = this.rng() < 0.5 ? -1 : 1;
        this.addThing({ s: this.nextProp, x: side * (this.roadHalf + 1.2 + this.rng() * 3), y: -1.5 + this.rng() * 4, w: 1.6 + this.rng() * 1.6, kind: 'scenery', key: 'race-cloud' });
        this.nextProp += 2.2;
      }
      return;
    }
    while (this.nextHouse < far) {
      for (const side of [-1, 1]) {
        const i = Math.floor(this.rng() * 8);
        this.addThing({ s: this.nextHouse + (side > 0 ? 1.2 : 0), x: side * (this.roadHalf + WALK + 1.35 + this.rng() * 0.3), w: 2.3, kind: 'scenery', key: `race-house-${this.track.time}-${i}` });
      }
      this.nextHouse += 2.6;
    }
    while (this.nextProp < far) {
      const night = this.track.time !== 'day';
      for (const side of [-1, 1]) {
        const r = this.rng();
        const x = side * (this.roadHalf + RUMBLE + 0.45);
        if (r < 0.45) this.addThing({ s: this.nextProp, x, w: 0.45, kind: 'scenery', key: night ? 'race-lamp-on' : 'race-lamp-off' });
        else if (r < 0.8 && this.track.time !== 'night') this.addThing({ s: this.nextProp, x: x + side * 0.3, w: 0.9, kind: 'scenery', key: 'race-tree' });
        else if (r < 0.86) this.addThing({ s: this.nextProp, x: x + side * 0.4, w: 1.4, kind: 'scenery', key: 'race-billboard' });
        else this.addThing({ s: this.nextProp, x, w: 0.35, kind: 'scenery', key: 'race-traffic' });
      }
      this.nextProp += 3.4;
    }
  }

  /** A word board standing in one lane: a picture (or a number) and the English word. */
  private makeBoard(word: string, lane: number, air = false): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    const col = LANE_COLORS[lane % LANE_COLORS.length]!;
    if (air) {
      // a card in the sky hangs from a balloon
      g.lineStyle(4, 0xffffff).lineBetween(0, -330, 0, -372);
      g.fillStyle(col).fillEllipse(0, -406, 64, 74).lineStyle(4, 0x2b2d42).strokeEllipse(0, -406, 64, 74);
      g.fillStyle(0xffffff, 0.6).fillEllipse(-12, -420, 14, 22);
    } else {
      g.fillStyle(0x495057).fillRect(-70, -60, 16, 60).fillRect(54, -60, 16, 60);
      g.fillStyle(0x000000, 0.25).fillEllipse(0, 0, 220, 26);
    }
    g.fillStyle(col).fillRoundedRect(-120, -330, 240, 280, 26);
    g.fillStyle(0xfffaf0).fillRoundedRect(-106, -316, 212, 252, 18);
    g.lineStyle(6, 0x2b2d42).strokeRoundedRect(-120, -330, 240, 280, 26);
    c.add(g);
    const n = numberOf(word);
    if (word.startsWith('c-')) c.add(this.add.image(0, -214, `race-${word}`).setDisplaySize(150, 150));
    else if (n === undefined) c.add(this.add.image(0, -214, `snake-${word}`).setDisplaySize(150, 150));
    else c.add(this.add.text(0, -214, String(n), { fontFamily: FONT, fontSize: '120px', color: '#2b2d42', fontStyle: 'bold' }).setOrigin(0.5));
    const text = ENGLISH[word] ?? word;
    c.add(
      this.add
        .text(0, -100, text, { fontFamily: FONT, fontSize: text.length > 9 ? '28px' : text.length > 6 ? '36px' : '44px', color: '#2b2d42', fontStyle: 'bold', resolution: 2 })
        .setOrigin(0.5),
    );
    return c;
  }

  private async raceLoop(run: number) {
    const ok = () => run === this.run && this.sys.isActive();
    // countdown: three, two, one, go!
    const intro = [this.ru(`raccoon.race.start.${this.trackIdx}`)];
    if (isPractice(this.progress, this.trackIdx)) intro.push(this.ru('raccoon.race.practice'));
    if (!(await this.talk(...intro))) return;
    const big = this.keep(this.add.text(W / 2, 300, '', { fontFamily: FONT, fontSize: '180px', color: '#ffd166', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 16 }).setOrigin(0.5).setDepth(3100));
    for (const n of [3, 2, 1]) {
      big.setText(String(n)).setScale(1.4);
      this.tweens.add({ targets: big, scale: 1, duration: 300, ease: 'Back.easeOut' });
      this.beep([440], 0.15, 'square', 0.06);
      voice.say(english(`n${n}`));
      if (!(await this.wait(900, run))) return;
    }
    big.setText('GO!');
    this.beep([880], 0.3, 'square', 0.07);
    voice.say(english('race.go'));
    this.tweens.add({ targets: big, alpha: 0, scale: 2, duration: 700, onComplete: () => big.destroy() });
    this.speed = this.track.minSpeed;
    this.driving = true;

    for (let i = 0; i < this.rows.length; i++) {
      if (!ok()) return;
      const row = this.rows[i]!;
      this.dots[i]?.setStrokeStyle(5, 0xffd166);
      // cones in the gap before the row
      for (const c of row.cones) {
        const s = this.pos + 16 + this.rng() * 4;
        if (this.plane) this.addThing({ s, x: this.laneX(c.lane), y: this.altY(c.h) + 0.05, w: 0.75, kind: 'cone', key: 'race-storm', lane: c.lane, h: c.h });
        else this.addThing({ s, x: this.laneX(c.lane), w: 0.42, kind: 'cone', key: 'race-cone', lane: c.lane, h: 0 });
      }
      this.cue = english(row.target);
      if (!this.asked.includes(row.target)) this.asked.push(row.target);
      this.cueRepeated = false;
      if (!(await this.wait(400, run))) return;
      if (!(await this.talk(this.cue))) return;
      this.tele?.ask(row.target, { row: i });
      let res: RowResult;
      for (;;) {
        res = await new Promise<RowResult>((done) => {
          const s = this.pos + Z_SPAWN;
          for (const c of row.cards) {
            if (this.plane) this.addThing({ s, x: this.laneX(c.lane), y: this.altY(c.h), w: AIR_W, kind: 'board', obj: this.makeBoard(c.word, c.lane, true), baseW: 240, lane: c.lane, h: c.h, word: c.word });
            else this.addThing({ s, x: this.laneX(c.lane), w: 0.82, kind: 'board', obj: this.makeBoard(c.word, c.lane), baseW: 240, lane: c.lane, h: 0, word: c.word });
          }
          this.pendingRow = { s, row, done };
        });
        if (!ok()) return;
        // the plane flew past every card: the same word comes again, cards in new places
        if (res.ok || res.word) break;
        this.tele?.event('pass', { row: i });
        if (!(await this.talk(this.ru('raccoon.race.pass'), this.cue))) return;
        row.cards = reshuffle(row.cards, this.track, this.rng);
      }
      this.results[i] = res.ok;
      this.tele?.answer({ item: row.target, correct: res.ok, chosen: res.ok ? undefined : res.word, row: i, speed: Math.round(this.speed * 10) / 10 });
      this.dots[i]?.setFillStyle(res.ok ? 0x38b000 : 0xe63946, 1).setStrokeStyle(3, 0xffffff);
      if (res.ok) {
        this.correct++;
        this.hits.push(row.target);
        this.stepLine(this.linePos + 1);
        recordWord(row.target, true, 'race');
        if (!(await this.talk(english(row.target), english(pick(this.rng, PRAISE_LINES))))) return;
      } else {
        this.missed.push(row.target);
        recordWord(row.target, false, 'race');
        if (!(await this.review(row.target, res.word, run))) return;
      }
      if (this.coneHit && !this.coneTold) {
        this.coneTold = true;
        if (!(await this.talk(this.ru(this.plane ? 'raccoon.race.storm' : 'raccoon.race.cone')))) return;
      }
      if (this.sincePit >= CRASHES_TO_PIT) {
        if (!(await this.pitStop(run))) return;
      } else if (!res.ok && this.sincePit === CRASHES_TO_PIT - 1) {
        if (!(await this.talk(this.ru('raccoon.race.warn')))) return;
      }
      this.cue = undefined;
      if (BOOST_AFTER.includes(i) && i < this.rows.length - 1 && !(await this.booster(i, run))) return;
    }
    // finish line
    this.addThing({ s: this.pos + 30, x: 0, y: this.plane ? -0.4 : 0, w: this.roadHalf * 2 + 0.6, kind: 'arch', key: 'race-arch' });
    while (ok() && this.things.some((t) => t.kind === 'arch' && t.s - this.pos > Z_HIT)) await this.wait(100, run);
    if (!ok()) return;
    voice.say(english('race.finish'));
    this.beep([523, 659, 784, 1046], 0.14);
    this.driving = false;
    this.showResults();
  }

  /** After a crash into a wrong board: the car stands, both words are shown and said, then on we go. */
  private async review(target: string, wrong: string, run: number): Promise<boolean> {
    while (this.coast > 0.05 && run === this.run) if (!(await this.wait(50, run))) return false;
    const layer: Phaser.GameObjects.GameObject[] = [];
    const d = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(3200);
      layer.push(this.keep(o));
      return o;
    };
    d(this.add.rectangle(W / 2, 420, 820, 400, 0x14213d, 0.92).setStrokeStyle(5, 0xffd166));
    d(this.add.text(W / 2, 250, 'Разберём слова', { fontFamily: FONT, fontSize: '36px', color: '#ffd166', fontStyle: 'bold' }).setOrigin(0.5));
    const card = (x: number, word: string, good: boolean, label: string) => {
      const c = d(this.makeBoard(word, good ? 3 : 1).setPosition(x, 600).setScale(0.8));
      d(this.add.text(x, 302, label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5));
      const mark = this.add.graphics({ x: x + 110, y: 302 });
      mark.fillStyle(good ? 0x38b000 : 0xe63946).fillCircle(0, 0, 26);
      mark.lineStyle(8, 0xffffff);
      if (good) mark.beginPath().moveTo(-12, 0).lineTo(-3, 10).lineTo(13, -10).strokePath();
      else mark.lineBetween(-10, -10, 10, 10).lineBetween(10, -10, -10, 10);
      d(mark);
      return c;
    };
    const bad = card(W / 2 - 200, wrong, false, 'Ты въехал');
    const good = card(W / 2 + 200, target, true, 'А нужно');
    const line = this.ru(`raccoon.race.crash.${Math.floor(this.rng() * 3)}`);
    this.tweens.add({ targets: bad, scale: 0.84, yoyo: true, duration: 300 });
    if (!(await this.talk(line, english(wrong)))) return false;
    this.tweens.add({ targets: good, scale: 0.86, yoyo: true, repeat: 2, duration: 300 });
    if (!(await this.talk(this.ru('raccoon.race.need'), english(target)))) return false;
    if (!(await this.wait(500, run))) return false;
    if (!(await this.talk(english(target)))) return false;
    // on: the button, Space/Enter, or by itself after a while
    await new Promise<void>((resolve) => {
      let done = false;
      const go = () => {
        if (done) return;
        done = true;
        this.input.keyboard?.off('keydown', onKey);
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp') go();
      };
      this.input.keyboard?.on('keydown', onKey);
      const b = d(button(this, W / 2, 668, 'Поехали!', go, { w: 360, h: 84, color: 0xe63946 }));
      this.tweens.add({ targets: b, scale: 1.06, yoyo: true, repeat: -1, duration: 400 });
      this.time.delayedCall(6000, go);
    });
    layer.forEach((o) => o.destroy());
    if (run !== this.run) return false;
    this.spin = 0;
    this.speed = this.track.minSpeed;
    this.driving = true;
    return true;
  }

  private crashFx(kind: 'board' | 'cone') {
    this.crashes++;
    this.sincePit++;
    this.wrenches.forEach((w, i) => w.setAlpha(i < this.sincePit ? 1 : 0.3).setTint(i < this.sincePit ? 0xff6b6b : 0xffffff));
    this.crashSound();
    this.cameras.main.shake(350, kind === 'board' ? 0.014 : 0.008);
    this.cameras.main.flash(180, 255, 80, 80);
    if (kind === 'board') {
      // a wrong word: the car stops for a look at both words
      this.driving = false;
      this.coast = this.shown * 0.6;
      this.spin = 0.5;
      this.gas = this.brake = false;
    } else {
      this.spin = 0.9;
      this.speed = Math.max(this.track.minSpeed * 0.5, this.speed * 0.4);
    }
    const bang = this.keep(this.add.text(W / 2, 420, kind === 'board' ? 'БАМ!' : 'БУМ!', { fontFamily: FONT, fontSize: '96px', color: '#ffd166', fontStyle: 'bold', stroke: '#e63946', strokeThickness: 14 }).setOrigin(0.5).setDepth(3050));
    this.tweens.add({ targets: bang, scale: { from: 0.4, to: 1.2 }, alpha: { from: 1, to: 0 }, y: 360, duration: 900, onComplete: () => bang.destroy() });
    // a burst of little stars
    for (let k = 0; k < 10; k++) {
      const st = this.keep(this.add.image(W / 2, 560, 'race-star').setDisplaySize(30, 30).setDepth(3040));
      const a = (k / 10) * Math.PI * 2;
      this.tweens.add({ targets: st, x: W / 2 + Math.cos(a) * 220, y: 560 + Math.sin(a) * 140, alpha: 0, angle: 360, duration: 700, onComplete: () => st.destroy() });
    }
    if (navigator.vibrate) navigator.vibrate(200);
  }

  private collectFx(t: Thing) {
    this.beep([784, 1046, 1318], 0.09);
    t.fly = { vx: 0, vy: -1300, spin: 0, t: 0 };
    const p = this.project(Math.max(t.s - this.pos, ZNEAR), t.x, t.y ?? 0);
    const st = this.keep(this.add.image(p.x, p.y - 150, 'race-star').setDisplaySize(80, 80).setDepth(3040));
    this.tweens.add({ targets: st, x: 176 + (this.results.filter((r) => r !== undefined).length) * 44, y: 42, scale: 0.2, angle: 360, duration: 650, ease: 'Cubic.easeIn', onComplete: () => st.destroy() });
  }

  update(time: number, dms: number) {
    if (!this.road || !this.track) return;
    const dt = Math.min(dms, 50) / 1000;
    if (this.driving) {
      const k = this.keys;
      const up = this.gas || k?.UP?.isDown || k?.W?.isDown;
      const down = this.brake || k?.DOWN?.isDown || k?.S?.isDown;
      if (this.spin <= 0) {
        if (up && !this.plane) this.speed += 7 * dt;
        else if (down && !this.plane) this.speed -= 10 * dt;
        this.speed = Phaser.Math.Clamp(this.speed, this.track.minSpeed, this.track.maxSpeed);
      } else {
        this.spin -= dt;
        this.speed = Math.min(this.speed + 3 * dt, this.track.minSpeed);
      }
      this.brakeGlow?.setFillStyle(0xff3030, down && !this.plane ? 0.35 : 0);
    } else {
      this.coast = Math.max(0, this.coast - 22 * dt);
      if (this.spin > 0) this.spin -= dt;
    }
    // ease off by a quarter when the word boards come close, so there is time to choose
    const near = this.pendingRow && this.pendingRow.s - this.pos < SLOW_Z;
    this.slow += ((near ? SLOW : 1) - this.slow) * Math.min(1, dt * 4);
    // nitro: half as fast again for a few seconds, but never into the word cards
    if (this.nitroLeft > 0) this.nitroLeft = near || !this.driving ? 0 : Math.max(0, this.nitroLeft - dt);
    const boost = this.nitroLeft > 0 ? 1.6 : 1;
    this.shown = this.driving ? this.speed * this.slow * boost : this.coast;
    this.pos += this.shown * dt;
    // the road bends gently from side to side
    this.curve = 0.006 * Math.sin(this.pos / 37) * Math.sin(this.pos / 91 + 1);
    if (this.skyline) this.skyline.tilePositionX += this.curve * this.shown * dt * 900;
    // the car slides to its lane
    const target = this.laneX(this.lane);
    const dx = target - this.carX;
    this.carX += Math.sign(dx) * Math.min(Math.abs(dx), 4.5 * dt);
    this.camX = lerp(this.camX, this.carX * 0.8, Math.min(1, dt * 5));
    if (this.plane) {
      const goal = this.altY(this.alt);
      const dy = goal - this.planeY;
      this.planeY += Math.sign(dy) * Math.min(Math.abs(dy), 3.2 * dt);
      this.camY = lerp(this.camY, this.planeY + PLANE_CAM, Math.min(1, dt * 3));
    }

    this.spawnScenery();
    this.drawRoad();
    this.placeThings(dt);
    this.checkHits();
    this.drawCar(time, dx);
    this.drawSpeed(dt);

    // say the word once more when its boards are halfway here
    if (this.pendingRow && !this.cueRepeated && !this.talking && this.pendingRow.s - this.pos < 22) {
      this.cueRepeated = true;
      this.repeatCue();
    }
  }

  private drawRoad() {
    const g = this.road!;
    const pal = this.pal;
    g.clear();
    if (this.plane) return this.drawSea(g);
    g.fillStyle(mix(pal.grass[0], pal.fog, 0.6)).fillRect(0, HOR, W, H - HOR);
    const n0 = Math.floor((this.pos + ZNEAR) / SEG);
    const n1 = Math.floor((this.pos + ZFAR) / SEG);
    const half = this.roadHalf;
    for (let n = n1; n >= n0; n--) {
      const zNear = Math.max(n * SEG - this.pos, ZNEAR);
      const zFar = (n + 1) * SEG - this.pos;
      if (zFar <= zNear) continue;
      const a = this.project(zNear, 0);
      const b = this.project(zFar, 0);
      const fog = Math.min(1, Math.max(0, (zFar - 18) / (ZFAR - 18)));
      const alt = n % 2;
      const c = (col: number) => mix(col, pal.fog, fog * 0.85);
      const quad = (x1: number, x2: number, col: number) => {
        g.fillStyle(c(col));
        g.fillPoints(
          [
            { x: a.x + x1 * a.k, y: a.y },
            { x: a.x + x2 * a.k, y: a.y },
            { x: b.x + x2 * b.k, y: b.y },
            { x: b.x + x1 * b.k, y: b.y },
          ],
          true,
        );
      };
      g.fillStyle(c(pal.grass[alt]!)).fillRect(0, b.y, W, a.y - b.y + 1);
      quad(-half - RUMBLE - WALK, -half - RUMBLE, pal.walk[alt]!);
      quad(half + RUMBLE, half + RUMBLE + WALK, pal.walk[alt]!);
      quad(-half - RUMBLE, -half, alt ? 0xffffff : 0xe63946);
      quad(half, half + RUMBLE, alt ? 0xffffff : 0xe63946);
      quad(-half, half, pal.road[alt]!);
      if (alt) {
        for (let l = 1; l < this.track.lanes; l++) {
          const x = -half + l * LANE_W;
          quad(x - 0.03, x + 0.03, pal.line);
        }
      }
    }
    // headlights at night and at sunset
    if (this.track.time !== 'day') {
      const p0 = this.project(Z_HIT, this.carX);
      const p1 = this.project(9, this.carX);
      g.fillStyle(0xfff3b0, this.track.time === 'night' ? 0.16 : 0.08);
      g.fillPoints(
        [
          { x: p0.x - 0.45 * p0.k, y: p0.y },
          { x: p0.x + 0.45 * p0.k, y: p0.y },
          { x: p1.x + 0.9 * p1.k, y: p1.y },
          { x: p1.x - 0.9 * p1.k, y: p1.y },
        ],
        true,
      );
    }
  }

  /** Under the plane: the sea with wave stripes (or a floor of pink clouds) running towards us. */
  private drawSea(g: Phaser.GameObjects.Graphics) {
    const day = this.track.time === 'day';
    const cols = day ? [0x1d8fb4, 0x2aa3c7] : [0xffd6e4, 0xffe8ef];
    const fogc = day ? 0xbde0fe : this.pal.fog;
    g.fillStyle(mix(cols[0]!, fogc, 0.7)).fillRect(0, HOR, W, H - HOR);
    const n0 = Math.floor((this.pos + ZNEAR) / SEG);
    const n1 = Math.floor((this.pos + ZFAR) / SEG);
    for (let n = n1; n >= n0; n--) {
      const zNear = Math.max(n * SEG - this.pos, ZNEAR);
      const zFar = (n + 1) * SEG - this.pos;
      if (zFar <= zNear) continue;
      const a = this.project(zNear, 0, SEA_Y);
      const b = this.project(zFar, 0, SEA_Y);
      if (b.y > H) continue;
      const fog = Math.min(1, Math.max(0, (zFar - 10) / (ZFAR - 10)));
      g.fillStyle(mix(cols[n % 2]!, fogc, fog * 0.8)).fillRect(0, b.y, W, Math.min(H, a.y) - b.y + 1);
    }
    // faint lane guides in the air, so the child sees where the three ways go
    const half = this.roadHalf;
    for (let l = 0; l <= this.track.lanes; l++) {
      const x = -half + l * LANE_W;
      for (let z = 3; z < 30; z += 2.5) {
        const zz = z - ((this.pos % 2.5) + 2.5) % 2.5;
        if (zz < 2) continue;
        const q = this.project(zz, x, -0.15);
        g.fillStyle(0xffffff, 0.35 * (1 - zz / 30)).fillCircle(q.x, q.y, Math.max(1.5, q.k * 0.05));
      }
    }
  }

  private placeThings(dt: number) {
    const keepIt: Thing[] = [];
    for (const t of this.things) {
      if (t.fly) {
        t.fly.t += dt;
        t.obj.x += t.fly.vx * dt;
        t.obj.y += t.fly.vy * dt;
        t.fly.vy += 1600 * dt;
        t.obj.angle += t.fly.spin * dt;
        t.obj.setAlpha(Math.max(0, 1 - t.fly.t));
        if (t.fly.t > 1) {
          t.obj.destroy();
          continue;
        }
        keepIt.push(t);
        continue;
      }
      const z = t.s - this.pos;
      if (z < ZNEAR) {
        t.obj.destroy();
        continue;
      }
      keepIt.push(t);
      if (z > ZFAR || t.gone) {
        if (!t.gone) t.obj.setVisible(false);
        continue;
      }
      const p = this.project(z, t.x, t.y ?? 0);
      const scale = (t.w * p.k) / t.baseW;
      t.obj.setVisible(true).setPosition(p.x, p.y).setScale(scale).setDepth(1000 - z * 10);
      const fog = Math.min(1, Math.max(0, (ZFAR - z) / 10));
      if (t.fade !== undefined) t.fade = Math.max(0, t.fade - dt * 5);
      t.obj.setAlpha(fog * (t.fade ?? 1));
    }
    this.things = keepIt;
  }

  private nearestLane() {
    let best = 0;
    for (let l = 1; l < this.track.lanes; l++) if (Math.abs(this.laneX(l) - this.carX) < Math.abs(this.laneX(best) - this.carX)) best = l;
    return best;
  }

  /** The height step the plane is nearest to (always 0 for the car). */
  private nearestAlt() {
    return this.plane ? Math.round(this.planeY / ALT_STEP) : 0;
  }

  private checkHits() {
    if (!this.driving) return;
    const lane = this.nearestLane();
    const h = this.nearestAlt();
    for (const t of this.things) {
      if (t.kind !== 'cone' || t.checked || t.fly) continue;
      if (t.s - this.pos <= Z_HIT) {
        t.checked = true;
        if (t.lane === lane && (t.h ?? 0) === h) {
          this.coneHit = true;
          this.bumps++;
          t.fly = { vx: (this.rng() - 0.5) * 900, vy: -700, spin: 720, t: 0 };
          this.crashFx('cone');
          this.tele?.event('cone');
        }
      }
    }
    const pr = this.pendingRow;
    if (!pr || pr.s - this.pos > Z_HIT) return;
    this.pendingRow = undefined;
    const word = pr.row.cards.find((c) => c.lane === lane && c.h === h)?.word;
    const boards = this.things.filter((t) => t.kind === 'board' && t.s === pr.s);
    const hit = boards.find((t) => t.lane === lane && (t.h ?? 0) === h);
    boards.forEach((t) => t !== hit && (t.fade = 1));
    if (word === undefined) {
      // only in the air: an empty spot, nothing was hit
      pr.done({ ok: false, word: '' });
    } else if (word === pr.row.target) {
      if (hit) this.collectFx(hit);
      pr.done({ ok: true, word });
    } else {
      if (hit) hit.fly = { vx: (this.rng() < 0.5 ? -1 : 1) * 700, vy: -900, spin: 540, t: 0 };
      this.crashFx('board');
      pr.done({ ok: false, word });
    }
  }

  private drawCar(time: number, dx: number) {
    const car = this.car;
    if (!car) return;
    if (this.plane) {
      // the plane bobs in the air and banks into a turn
      const p = this.project(Z_HIT, this.carX, this.planeY + 0.45);
      car.x = p.x;
      car.y = p.y + Math.sin(time / 260) * 5;
      car.angle = this.spin > 0 ? Math.sin(this.spin * 14) * 16 : Phaser.Math.Clamp(dx * 22, -18, 18);
    } else {
      const p = this.project(Z_HIT, this.carX);
      const shake = this.shown > 0.1 ? Math.sin(time / 30) * (0.6 + this.shown / 20) : 0;
      car.x = p.x;
      car.y = CAR_Y + shake;
      car.angle = this.spin > 0 ? Math.sin(this.spin * 14) * 12 : Phaser.Math.Clamp(dx * 14, -8, 8);
    }
    const p = this.project(Z_HIT, this.carX);
    this.brakeGlow?.setPosition(p.x, CAR_Y - 95);
    if (this.spin > 0) car.setTint(Math.floor(time / 80) % 2 ? 0xff9999 : 0xffffff);
    else car.clearTint();
  }

  private drawSpeed(dt: number) {
    const fx = this.fx!;
    fx.clear();
    const t = this.track;
    const share = Math.min(1.4, this.shown / t.maxSpeed) * (this.plane ? 0.8 : 1);
    // speed streaks fly out from the far end of the road when going fast
    if (this.driving && share > 0.55 && this.streaks.length < 40 && this.rng() < share) this.streaks.push({ a: this.rng() * Math.PI * 2, r: 120, v: 900 + this.rng() * 600 });
    const cx = W / 2 + this.bend(ZFAR) * (FOCAL / ZFAR) - this.camX * (FOCAL / ZFAR);
    this.streaks = this.streaks.filter((s) => {
      s.r += s.v * dt * (0.5 + share);
      const x1 = cx + Math.cos(s.a) * s.r;
      const y1 = HOR + Math.sin(s.a) * s.r * 0.6;
      const x2 = cx + Math.cos(s.a) * (s.r + 60 * share);
      const y2 = HOR + Math.sin(s.a) * (s.r + 60 * share) * 0.6;
      fx.lineStyle(this.nitroLeft > 0 ? 5 : 3, this.nitroLeft > 0 ? 0x7dd3fc : 0xffffff, Math.min(0.6, 0.35 * share)).lineBetween(x1, y1, x2, y2);
      return s.r < 900;
    });
    // speedometer
    const n = this.needle;
    if (n) {
      n.clear();
      const a = Math.PI * 0.75 + Math.min(1, this.shown / 26) * Math.PI * 1.5;
      n.lineStyle(6, 0xff4d4d).lineBetween(0, 0, Math.cos(a) * 56, Math.sin(a) * 56);
      n.fillStyle(0xffffff).fillCircle(0, 0, 8);
    }
    this.kmh?.setText(String(Math.round(this.shown * 10)));
  }

  // ---------- pit stop: squats, push-ups and a maze while the car is repaired ----------

  private async pitStop(run: number): Promise<boolean> {
    this.driving = false;
    const was = this.speed;
    this.speed = 0;
    this.coast = 0;
    this.nitroLeft = 0;
    const raccoon = this.raccoon;
    const subtitle = this.subtitle;
    const t0 = this.time.now;
    this.tele?.event('pit_stop.start', { crashes: this.crashes });
    const ok = await runPitStop(this.garageHost(), {
      run,
      plane: this.plane,
      track: this.trackIdx,
      carKey: this.plane ? `race-plane-${this.progress.plane}` : `race-car-${this.progress.car}`,
    });
    this.raccoon = raccoon;
    this.subtitle = subtitle;
    if (!ok || run !== this.run) return false;
    this.tele?.event('pit_stop.end', { ms: this.time.now - t0 });
    this.sincePit = 0;
    this.wrenches.forEach((w) => w.setAlpha(0.3).clearTint());
    this.speed = Math.max(this.track.minSpeed, was * 0.6);
    this.driving = true;
    return true;
  }

  // ---------- results ----------

  private showResults() {
    const before = TRACKS.map((_, i) => unlocked(this.progress, i));
    const outcome = { correct: this.correct, hits: this.hits, missed: this.missed, asked: this.asked, bumps: this.bumps, rows: this.rows.length, boostMisses: this.boostTotal - this.boostRight };
    const was = this.progress.level;
    const { progress, prize, coins, practice } = recordRace(this.progress, this.trackIdx, outcome);
    const newCar = prize?.item;
    const air = prize?.kind === 'plane';
    this.progress = progress;
    // the smart level: only a race on the child's own track or a harder one moves it
    let level: ReturnType<typeof nextLevelSmart> | undefined;
    if (!practice) {
      const st = levelStats(outcome, this.boostRight, this.boostTotal);
      level = nextLevelSmart('race', this.trackIdx + 1, statsFromRun(this.tele, st.right, st.total), LEVEL_RULES);
      // a harder track only lifts the level; a hard race there doesn't push it below the own track
      if (this.trackIdx === was || level.change > 0) this.progress = withLevel(this.progress, level.level);
    }
    const levelUp = this.progress.level > was;
    const levelDown = this.progress.level < was;
    this.save();
    const opened = TRACKS.some((_, i) => !before[i] && unlocked(this.progress, i));
    const stars = starsFor(this.correct);
    const flawless = isFlawless(outcome);
    this.tele?.end({ completed: true, stars, score: this.correct, crashes: this.crashes, bumps: this.bumps, unlocked: opened, coins, flawless, prize: newCar?.id, practice, level: this.progress.level, ...(level ? levelLog(level) : {}) });
    const d = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      (this.keep(o) as unknown as Phaser.GameObjects.Components.Depth).setDepth(3300);
      return o;
    };
    d(this.add.rectangle(W / 2, H / 2, W, H, 0x14213d, 0.85).setInteractive());
    d(this.add.text(W / 2, 70, 'Финиш!', { fontFamily: FONT, fontSize: '76px', color: '#ffd166', fontStyle: 'bold', stroke: '#e63946', strokeThickness: 10 }).setOrigin(0.5));
    const sx = newCar ? 330 : W / 2;
    for (let k = 0; k < 3; k++) {
      const st = d(this.add.image(sx - 150 + k * 150, 200, k < stars ? 'race-star' : 'race-star-off').setDisplaySize(130, 130).setScale(0));
      this.tweens.add({ targets: st, scale: 130 / 120, delay: 300 + k * 350, duration: 400, ease: 'Back.easeOut', onStart: () => k < stars && this.beep([660 + k * 220], 0.12) });
    }
    d(this.add.text(sx, 310, `${this.childName}, правильных слов: ${this.correct} из ${this.rows.length}`, { fontFamily: FONT, fontSize: newCar ? '32px' : '40px', color: '#ffffff' }).setOrigin(0.5));
    d(this.add.text(sx, 356, 'Три звезды — 10 слов, две — 7, одна — 5', { fontFamily: FONT, fontSize: '22px', color: '#adb5bd' }).setOrigin(0.5));
    // coins earned
    d(this.add.image(sx - 90, 412, 'race-coin').setDisplaySize(50, 50));
    const coinText = d(this.add.text(sx - 56, 412, `+0`, { fontFamily: FONT, fontSize: '40px', color: '#ffd166', fontStyle: 'bold' }).setOrigin(0, 0.5));
    let shownCoins = 0;
    this.time.addEvent({
      delay: 120, repeat: Math.max(0, coins - 1), startAt: 0,
      callback: () => {
        shownCoins = Math.min(coins, shownCoins + 1);
        coinText.setText(`+${shownCoins}`);
        this.beep([880 + shownCoins * 20], 0.04, 'square', 0.03);
      },
    });
    let y = 462;
    if (flawless && !practice) {
      d(this.add.text(sx, y, `Без единой ошибки! +${FLAWLESS_BONUS} монет`, { fontFamily: FONT, fontSize: '28px', color: '#7dd3fc' }).setOrigin(0.5));
      y += 44;
    }
    if (practice) {
      d(this.add.text(sx, y, `Тренировка: монеты пополам.${flawless ? '\nНовые машины ждут на трассе «' + TRACKS[this.progress.level]!.name + '»!' : ''}`, { fontFamily: FONT, fontSize: '24px', color: '#adb5bd', align: 'center' }).setOrigin(0.5, 0));
      y += flawless ? 70 : 40;
    }
    if (levelUp) {
      d(this.add.text(sx, y, `Твоя трасса теперь «${TRACKS[this.progress.level]!.name}»!`, { fontFamily: FONT, fontSize: '28px', color: '#ffd166' }).setOrigin(0.5));
      y += 40;
    } else if (levelDown) {
      d(this.add.text(sx, y, `Потренируемся на трассе «${TRACKS[this.progress.level]!.name}»`, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5));
      y += 40;
    }
    if (opened && !levelUp) d(this.add.text(sx, y, 'Открыта новая трасса!', { fontFamily: FONT, fontSize: '30px', color: '#ffd166' }).setOrigin(0.5));
    if (newCar) {
      // the new car drives onto a podium
      d(this.add.text(950, 160, air ? 'Новый самолёт!' : 'Новая машина!', { fontFamily: FONT, fontSize: '44px', color: '#ffd166', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 8 }).setOrigin(0.5));
      d(this.add.ellipse(950, 400, 380, 70, 0xffd166, 0.9).setStrokeStyle(5, 0xffffff));
      const img = d(this.add.image(W + 300, 400, `${air ? 'race-plane' : 'race-car'}-${newCar.id}`).setOrigin(0.5, 0.92).setScale(0.8));
      this.tweens.add({ targets: img, x: 950, duration: 1100, delay: 600, ease: 'Back.easeOut' });
      d(this.add.text(950, 462, newCar.name, { fontFamily: FONT, fontSize: '36px', color: '#ffffff', stroke: '#14213d', strokeThickness: 6 }).setOrigin(0.5));
      d(button(this, 950, 530, 'Взять в гонку', () => {
        this.progress = air ? { ...this.progress, plane: newCar.id } : { ...this.progress, car: newCar.id };
        this.save();
        this.beep([660, 880], 0.08);
        void this.talk(english(air ? planeLine(newCar.id) : carLine(newCar.id)));
      }, { w: 300, h: 70, color: 0x38b000 }));
    }
    d(button(this, W / 2 - 330, 640, 'Ещё раз', () => this.startRace(this.trackIdx), { w: 280, h: 96, color: 0xe63946 }));
    d(button(this, W / 2, 640, 'Трассы', () => this.showMenu(), { w: 280, h: 96, color: 0x277da1 }));
    d(button(this, W / 2 + 330, 640, 'Домой', () => this.scene.start('Menu'), { w: 280, h: 96, color: 0x6c757d }));
    const lines: Utterance[] = [this.ru(`raccoon.race.finish.${stars}`)];
    if (newCar) lines.push(this.ru(air ? 'raccoon.race.newplane' : 'raccoon.race.newcar'), english(air ? planeLine(newCar.id) : carLine(newCar.id)));
    if (practice && flawless) lines.push(this.ru('raccoon.race.practice.car'));
    if (levelUp) lines.push(this.ru(TRACKS[this.progress.level]!.vehicle === 'plane' && TRACKS[was]!.vehicle === 'car' ? 'raccoon.race.unlock.plane' : 'raccoon.race.levelup'));
    else if (opened) lines.push(this.ru(this.trackIdx === 2 ? 'raccoon.race.unlock.plane' : 'raccoon.race.unlock'));
    void this.wait(1400).then((alive) => alive && this.talk(...lines));
  }
}

/** The plane flew past: the same cards again, in new spots. */
function reshuffle(cards: Card[], track: Track, rng: Rng): Card[] {
  const spots: { lane: number; h: number }[] = [];
  for (let h = 0; h < track.heights; h++) for (let l = 0; l < track.lanes; l++) spots.push({ lane: l, h });
  const place = shuffle(rng, spots);
  return shuffle(rng, cards).map((c, i) => ({ word: c.word, ...place[i]! }));
}
