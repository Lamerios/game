import Phaser from 'phaser';
import { track } from '../../core/analytics';
import { voice } from '../../core/audio';
import { recordWord } from '../../core/wordLog';
import { english, ENGLISH, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import type { GameState } from '../../game-state';
import { button, FONT, H, W } from '../../scenes/ui';
import { mulberry32, pick, type Rng } from '../common/rng';
import { numberOf, PICTURES } from '../snake/logic';
import {
  ARCH, BILLBOARD, CAR_H, CAR_W, carSvg, CLOUD, CONE, houseSvg, lampSvg, MOON, PALETTES, skylineSvg, STAR, STAR_OFF, SUN, TRAFFIC_LIGHT, TREE,
  WRENCH, type Palette,
} from './art';
import {
  BOOST_AFTER, boosterPair, carLine, CARS, CRASHES_TO_PIT, landingOptions, LINE_MAX, freshProgress, parseProgress, PIT_MS, planRace, PRAISE_LINES, recordRace, ROWS_PER_RACE, SQUATS, starsFor,
  TRACKS, unlocked, type CarId, type Progress, type Row, type Track,
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
const LANE_COLORS = [0x3a86ff, 0xf77f00, 0x8338ec, 0x06d6a0];

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
  lane?: number;
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

/** Pit-stop length; `?pit=5` in the address makes it 5 seconds (for grown-ups testing). */
function pitMs(): number {
  const q = Number(new URLSearchParams(location.search).get('pit'));
  return Number.isFinite(q) && q > 0 ? q * 1000 : PIT_MS;
}

/**
 * «Гонка слов»: pick a race car, then drive through the city seen from behind
 * the car. The voice says an English word; word boards stand across the lanes;
 * drive into the right one (left/right to change lanes, up/down for speed).
 * A wrong board or a cone is a crash; after three crashes the car goes to the
 * pit stop and the child does ten squats for two minutes while it is repaired.
 * 10 right words = 3 stars, 7 = 2, 5 = 1.
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
      'race-lamp-off': lampSvg(false), 'race-lamp-on': lampSvg(true),
    };
    for (const c of CARS) svgs[`race-car-${c.id}`] = carSvg(c);
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

  private showMenu() {
    this.clear();
    const bg = this.keep(this.add.graphics());
    bg.fillGradientStyle(0x14213d, 0x14213d, 0x3a0ca3, 0x3a0ca3, 1).fillRect(0, 0, W, H);
    // a chequered strip and spotlights: the garage
    for (let i = 0; i < 40; i++) bg.fillStyle(i % 2 ? 0xffffff : 0x222222, 0.9).fillRect(i * 32, 368, 32, 16).fillStyle(i % 2 ? 0x222222 : 0xffffff, 0.9).fillRect(i * 32, 384, 32, 16);
    this.keep(
      this.add.text(W / 2, 46, 'Гонка слов', { fontFamily: FONT, fontSize: '58px', color: '#ffd166', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 10 }).setOrigin(0.5),
    );
    this.keep(button(this, 1170, 46, 'Домой', () => this.scene.start('Harbor'), { w: 170, h: 64, color: 0x6c757d }));
    this.raccoon = this.keep(this.add.image(80, 70, 'char-raccoon').setDisplaySize(130, 130));
    this.subtitle = this.keep(
      this.add
        .text(W / 2, 680, '', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', backgroundColor: '#14213dcc', padding: { x: 14, y: 8 }, align: 'center', wordWrap: { width: 1100 } })
        .setOrigin(0.5)
        .setDepth(50)
        .setVisible(false),
    );

    this.keep(this.add.text(W / 2, 108, 'Выбери машину', { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5));
    const rings: Phaser.GameObjects.Ellipse[] = [];
    const cars: Phaser.GameObjects.Image[] = [];
    let bounce: Phaser.Tweens.Tween | undefined;
    const select = (id: CarId, say: boolean) => {
      this.progress.car = id;
      writeStore(STORE_KEY, this.progress);
      CARS.forEach((c, i) => {
        rings[i]!.setFillStyle(c.id === id ? 0xffd166 : 0xffffff, c.id === id ? 0.9 : 0.15);
        cars[i]!.setScale(c.id === id ? 0.68 : 0.58).setY(330);
      });
      bounce?.remove();
      const i = CARS.findIndex((c) => c.id === id);
      bounce = this.tweens.add({ targets: cars[i], y: cars[i]!.y - 12, yoyo: true, repeat: -1, duration: 380, ease: 'Sine.easeInOut' });
      if (say) {
        this.beep([660, 880], 0.08);
        void this.talk(english(carLine(id)));
      }
    };
    CARS.forEach((c, i) => {
      const x = 190 + i * 300;
      rings.push(this.keep(this.add.ellipse(x, 330, 250, 56, 0xffffff, 0.15).setStrokeStyle(4, 0x14213d)));
      const img = this.keep(this.add.image(x, 330, `race-car-${c.id}`).setOrigin(0.5, 0.95).setScale(0.58));
      cars.push(img);
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => select(c.id, true));
      this.keep(this.add.text(x, 356, c.name, { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#14213d', strokeThickness: 6 }).setOrigin(0.5, 0));
    });
    select(this.progress.car, false);

    this.keep(this.add.text(W / 2, 436, 'Выбери трассу', { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5));
    TRACKS.forEach((t, i) => {
      const x = 240 + i * 400;
      const y = 560;
      const open = unlocked(this.progress, i);
      const pal = PALETTES[t.time];
      const card = this.keep(this.add.container(x, y));
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(-170, -92, 348, 196, 18);
      g.fillGradientStyle(pal.skyTop, pal.skyTop, pal.skyBottom, pal.skyBottom, 1).fillRect(-170, -100, 340, 110);
      g.fillStyle(pal.grass[0]).fillRect(-170, 10, 340, 86);
      g.fillStyle(pal.road[0]).fillTriangle(-110, 96, 110, 96, 0, 10);
      g.fillStyle(0xffffff).fillRect(-3, 30, 6, 14).fillRect(-4, 60, 8, 22);
      g.lineStyle(6, open ? 0xffd166 : 0x6c757d).strokeRoundedRect(-170, -100, 340, 196, 18);
      card.add(g);
      card.add(this.add.text(0, -76, t.name, { fontFamily: FONT, fontSize: '28px', color: '#ffffff', fontStyle: 'bold', stroke: '#14213d', strokeThickness: 6 }).setOrigin(0.5));
      const stars = this.progress.stars[i] ?? 0;
      for (let k = 0; k < 3; k++) card.add(this.add.image(-60 + k * 60, 52, k < stars ? 'race-star' : 'race-star-off').setDisplaySize(52, 52));
      card.add(this.add.text(0, -36, `${t.lanes} полосы`, { fontFamily: FONT, fontSize: '22px', color: '#14213d', backgroundColor: '#ffd166', padding: { x: 6, y: 2 } }).setOrigin(0.5));
      if (!open) {
        card.add(this.add.rectangle(0, -2, 340, 196, 0x000000, 0.5));
        const lock = this.add.graphics();
        lock.lineStyle(10, 0xffd166).beginPath().arc(0, -14, 22, Math.PI, 0).strokePath();
        lock.fillStyle(0xffd166).fillRoundedRect(-32, -14, 64, 50, 8);
        card.add(lock);
      }
      card.setSize(340, 196).setInteractive({ useHandCursor: true });
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

  private project(z: number, x: number) {
    const k = FOCAL / z;
    return { x: W / 2 + (x + this.bend(z) - this.camX) * k, y: HOR + CAM_H * k, k };
  }

  private startRace(idx: number) {
    this.clear();
    this.run++;
    this.trackIdx = idx;
    this.track = TRACKS[idx]!;
    this.pal = PALETTES[this.track.time];
    this.rows = planRace(this.track, this.rng, this.progress.misses);
    this.pos = 0;
    this.speed = 0;
    this.lane = Math.floor((this.track.lanes - 1) / 2);
    this.carX = this.laneX(this.lane);
    this.camX = this.carX * 0.8;
    this.curve = 0;
    this.nextHouse = -2;
    this.nextProp = 0;
    this.correct = 0;
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
    this.skyline = this.keep(this.add.tileSprite(0, HOR + 4, W, 160, `race-skyline-${this.track.time}`).setOrigin(0, 1).setDepth(-27));

    this.road = this.keep(this.add.graphics().setDepth(-20));
    this.fx = this.keep(this.add.graphics().setDepth(1900));

    // the car
    this.car = this.keep(this.add.image(W / 2, CAR_Y, `race-car-${this.progress.car}`).setOrigin(0.5, 1).setDisplaySize(CAR_PX, (CAR_PX * CAR_H) / CAR_W).setDepth(2000));
    this.brakeGlow = this.keep(this.add.ellipse(W / 2, CAR_Y - 90, 320, 60, 0xff3030, 0).setDepth(2001));

    this.drawHud();
    this.bindTouch();
    for (let i = 0; i < 40; i++) this.spawnScenery();
    this.addThing({ s: 3, x: 0, w: this.roadHalf * 2 + 0.6, kind: 'arch', key: 'race-arch' });
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
    this.keep(button(this, 1180, 42, 'Домой', () => this.scene.start('Harbor'), { w: 170, h: 64, color: 0x6c757d }).setDepth(3001));
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
    this.linePos = Math.min(LINE_MAX, n);
    this.lineText?.setText(String(this.linePos));
    if (this.lineCar) this.tweens.add({ targets: this.lineCar, x: this.lineX(this.linePos), duration: 260, ease: 'Quad.easeOut' });
  }

  /** Booster: pick the bigger one, guess where it lands, then count the steps aloud in English. */
  private async booster(after: number, run: number): Promise<boolean> {
    const ok = () => run === this.run && this.sys.isActive();
    const [a, b] = boosterPair(after);
    const layer: Phaser.GameObjects.GameObject[] = [];
    const d = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(3200);
      layer.push(o);
      return o;
    };
    d(this.add.rectangle(W / 2, 420, 760, 300, 0x14213d, 0.9).setStrokeStyle(5, 0xffd166));
    const title = d(this.add.text(W / 2, 315, 'Бустер! Какой больше?', { fontFamily: FONT, fontSize: '36px', color: '#ffd166' }).setOrigin(0.5));
    const choose = <T,>(opts: { label: string; v: T; color: number }[], y: number) =>
      new Promise<T>((resolve) => {
        const btns = opts.map((o, i) => d(button(this, W / 2 + (i - (opts.length - 1) / 2) * 230, y, o.label, () => {
          btns.forEach((x) => x.destroy());
          resolve(o.v);
        }, { w: 200, h: 110, color: o.color })));
      });
    const t0 = Date.now();
    void this.talk(this.ru('raccoon.race.boost'));
    const opts = this.rng() < 0.5 ? [a, b] : [b, a];
    const v = await choose(opts.map((x) => ({ label: `+${x}`, v: x, color: 0xe76f51 })), 420);
    if (!ok()) return false;
    track('race', 'answer', { item: `boost-${a}-${b}`, correct: v === Math.max(a, b), chosen: String(v), ms: Date.now() - t0, skill: 'compare' });
    if (v !== Math.max(a, b) && !(await this.talk(this.ru('raccoon.race.boost.small')))) return false;
    const t1 = Date.now();
    title.setText(`Мы на ${this.linePos}, едем +${v}. Куда приедем?`);
    void this.talk(this.ru('raccoon.race.where'));
    const landing = landingOptions(this.linePos, v, this.rng);
    const guess = await choose(landing.map((x) => ({ label: String(x), v: x, color: 0x277da1 })), 420);
    if (!ok()) return false;
    const right = Math.min(LINE_MAX, this.linePos + v);
    track('race', 'answer', { item: `land-${this.linePos}+${v}`, correct: guess === right, chosen: String(guess), ms: Date.now() - t1, skill: 'number_line' });
    title.setText(`${this.linePos} + ${v} = ${right}`);
    // Count on, one step per number, in English.
    for (let n = this.linePos + 1; n <= right; n++) {
      this.stepLine(n);
      this.beep([440 + n * 12], 0.08);
      voice.say(english(`n${n}`));
      if (!(await this.wait(750, run))) return false;
    }
    layer.forEach((o) => o.destroy());
    return this.talk(guess === right ? this.ru('raccoon.race.where.yes') : this.ru('raccoon.race.where.no'));
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
    pedal(1190, 'up', 0x38b000, (on) => (this.gas = on));
    pedal(1040, 'down', 0xc1121f, (on) => (this.brake = on));
    this.keep(this.add.text(1190, 700, 'газ', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(3000));
    this.keep(this.add.text(1040, 700, 'тормоз', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5).setDepth(3000));
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
      else if (Math.abs(dy) > 40) this.speed = Phaser.Math.Clamp(this.speed + (dy < 0 ? 3 : -3), this.track.minSpeed, this.track.maxSpeed);
    });
  }

  private steer(d: number) {
    if (!this.driving || this.spin > 0) return;
    const next = Phaser.Math.Clamp(this.lane + d, 0, this.track.lanes - 1);
    if (next === this.lane) return;
    this.lane = next;
    this.beep([300], 0.05, 'sine', 0.05);
  }

  private addThing(o: { s: number; x: number; w: number; kind: Thing['kind']; key?: string; obj?: Phaser.GameObjects.Container; baseW?: number; lane?: number; word?: string }) {
    const obj = o.obj ?? this.add.image(0, 0, o.key!).setOrigin(0.5, 1);
    obj.setVisible(false);
    const baseW = o.baseW ?? (obj as Phaser.GameObjects.Image).width;
    const t: Thing = { s: o.s, x: o.x, w: o.w, obj, baseW, kind: o.kind, lane: o.lane, word: o.word };
    this.things.push(t);
    return t;
  }

  /** Houses along both sides, with lamps, trees and the odd billboard at the kerb. */
  private spawnScenery() {
    const far = this.pos + ZFAR;
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
  private makeBoard(word: string, lane: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    const col = LANE_COLORS[lane % LANE_COLORS.length]!;
    g.fillStyle(0x495057).fillRect(-70, -60, 16, 60).fillRect(54, -60, 16, 60);
    g.fillStyle(0x000000, 0.25).fillEllipse(0, 0, 220, 26);
    g.fillStyle(col).fillRoundedRect(-120, -330, 240, 280, 26);
    g.fillStyle(0xfffaf0).fillRoundedRect(-106, -316, 212, 252, 18);
    g.lineStyle(6, 0x2b2d42).strokeRoundedRect(-120, -330, 240, 280, 26);
    c.add(g);
    const n = numberOf(word);
    if (n === undefined) c.add(this.add.image(0, -214, `snake-${word}`).setDisplaySize(150, 150));
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
    if (!(await this.talk(this.ru(`raccoon.race.start.${this.trackIdx}`)))) return;
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
      for (const l of row.cones) this.addThing({ s: this.pos + 16 + this.rng() * 4, x: this.laneX(l), w: 0.42, kind: 'cone', key: 'race-cone', lane: l });
      this.cue = english(row.target);
      this.cueRepeated = false;
      if (!(await this.wait(400, run))) return;
      if (!(await this.talk(this.cue))) return;
      const res = await new Promise<RowResult>((done) => {
        const s = this.pos + Z_SPAWN;
        row.lanes.forEach((w, l) => this.addThing({ s, x: this.laneX(l), w: 0.82, kind: 'board', obj: this.makeBoard(w, l), baseW: 240, lane: l, word: w }));
        this.pendingRow = { s, row, done };
      });
      if (!ok()) return;
      this.results[i] = res.ok;
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
        const line = this.ru(`raccoon.race.crash.${Math.floor(this.rng() * 3)}`);
        if (!(await this.talk(line, english(res.word), this.ru('raccoon.race.need'), english(row.target)))) return;
      }
      if (this.coneHit && !this.coneTold) {
        this.coneTold = true;
        if (!(await this.talk(this.ru('raccoon.race.cone')))) return;
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
    this.addThing({ s: this.pos + 30, x: 0, w: this.roadHalf * 2 + 0.6, kind: 'arch', key: 'race-arch' });
    while (ok() && this.things.some((t) => t.kind === 'arch' && t.s - this.pos > Z_HIT)) await this.wait(100, run);
    if (!ok()) return;
    voice.say(english('race.finish'));
    this.beep([523, 659, 784, 1046], 0.14);
    this.driving = false;
    this.showResults();
  }

  private crashFx(kind: 'board' | 'cone') {
    this.crashes++;
    this.sincePit++;
    this.wrenches.forEach((w, i) => w.setAlpha(i < this.sincePit ? 1 : 0.3).setTint(i < this.sincePit ? 0xff6b6b : 0xffffff));
    this.crashSound();
    this.cameras.main.shake(350, kind === 'board' ? 0.014 : 0.008);
    this.cameras.main.flash(180, 255, 80, 80);
    this.spin = 0.9;
    this.speed = Math.max(this.track.minSpeed * 0.5, this.speed * 0.4);
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
    const p = this.project(Math.max(t.s - this.pos, ZNEAR), t.x);
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
        if (up) this.speed += 7 * dt;
        else if (down) this.speed -= 10 * dt;
        this.speed = Phaser.Math.Clamp(this.speed, this.track.minSpeed, this.track.maxSpeed);
      } else {
        this.spin -= dt;
        this.speed = Math.min(this.speed + 3 * dt, this.track.minSpeed);
      }
      this.brakeGlow?.setFillStyle(0xff3030, down ? 0.35 : 0);
      this.pos += this.speed * dt;
    }
    // the road bends gently from side to side
    this.curve = 0.006 * Math.sin(this.pos / 37) * Math.sin(this.pos / 91 + 1);
    if (this.skyline) this.skyline.tilePositionX += this.curve * this.speed * dt * 900;
    // the car slides to its lane
    const target = this.laneX(this.lane);
    const dx = target - this.carX;
    this.carX += Math.sign(dx) * Math.min(Math.abs(dx), 4.5 * dt);
    this.camX = lerp(this.camX, this.carX * 0.8, Math.min(1, dt * 5));

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
      const p = this.project(z, t.x);
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

  private checkHits() {
    if (!this.driving) return;
    const lane = this.nearestLane();
    for (const t of this.things) {
      if (t.kind !== 'cone' || t.checked || t.fly) continue;
      if (t.s - this.pos <= Z_HIT) {
        t.checked = true;
        if (t.lane === lane) {
          this.coneHit = true;
          t.fly = { vx: (this.rng() - 0.5) * 900, vy: -700, spin: 720, t: 0 };
          this.crashFx('cone');
        }
      }
    }
    const pr = this.pendingRow;
    if (!pr || pr.s - this.pos > Z_HIT) return;
    this.pendingRow = undefined;
    const word = pr.row.lanes[lane]!;
    const boards = this.things.filter((t) => t.kind === 'board' && t.s === pr.s);
    const hit = boards.find((t) => t.lane === lane);
    boards.forEach((t) => t !== hit && (t.fade = 1));
    if (word === pr.row.target) {
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
    const p = this.project(Z_HIT, this.carX);
    const shake = this.driving ? Math.sin(time / 30) * (0.6 + this.speed / 20) : 0;
    car.x = p.x;
    car.y = CAR_Y + shake;
    car.angle = this.spin > 0 ? Math.sin(this.spin * 14) * 12 : Phaser.Math.Clamp(dx * 14, -8, 8);
    this.brakeGlow?.setPosition(p.x, CAR_Y - 95);
    if (this.spin > 0) car.setTint(Math.floor(time / 80) % 2 ? 0xff9999 : 0xffffff);
    else car.clearTint();
  }

  private drawSpeed(dt: number) {
    const fx = this.fx!;
    fx.clear();
    const t = this.track;
    const share = this.speed / t.maxSpeed;
    // speed streaks fly out from the far end of the road when going fast
    if (this.driving && share > 0.55 && this.streaks.length < 40 && this.rng() < share) this.streaks.push({ a: this.rng() * Math.PI * 2, r: 120, v: 900 + this.rng() * 600 });
    const cx = W / 2 + this.bend(ZFAR) * (FOCAL / ZFAR) - this.camX * (FOCAL / ZFAR);
    this.streaks = this.streaks.filter((s) => {
      s.r += s.v * dt * (0.5 + share);
      const x1 = cx + Math.cos(s.a) * s.r;
      const y1 = HOR + Math.sin(s.a) * s.r * 0.6;
      const x2 = cx + Math.cos(s.a) * (s.r + 60 * share);
      const y2 = HOR + Math.sin(s.a) * (s.r + 60 * share) * 0.6;
      fx.lineStyle(3, 0xffffff, 0.35 * share).lineBetween(x1, y1, x2, y2);
      return s.r < 900;
    });
    // speedometer
    const n = this.needle;
    if (n) {
      n.clear();
      const a = Math.PI * 0.75 + Math.min(1, this.speed / 22) * Math.PI * 1.5;
      n.lineStyle(6, 0xff4d4d).lineBetween(0, 0, Math.cos(a) * 56, Math.sin(a) * 56);
      n.fillStyle(0xffffff).fillCircle(0, 0, 8);
    }
    this.kmh?.setText(String(Math.round(this.speed * 10)));
  }

  // ---------- pit stop: ten squats while the car is repaired ----------

  private async pitStop(run: number): Promise<boolean> {
    this.driving = false;
    const was = this.speed;
    this.speed = 0;
    const items: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      items.push(this.keep(o));
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(3200);
      return o;
    };
    add(this.add.rectangle(W / 2, H / 2, W, H, 0x14213d, 0.88).setInteractive());
    add(this.add.text(W / 2, 60, 'Пит-стоп!', { fontFamily: FONT, fontSize: '64px', color: '#ffd166', fontStyle: 'bold' }).setOrigin(0.5));
    const car = add(this.add.image(330, 420, `race-car-${this.progress.car}`).setScale(0.75));
    const rac = add(this.add.image(150, 470, 'char-raccoon').setDisplaySize(180, 180));
    const wr = add(this.add.image(240, 420, 'race-wrench').setDisplaySize(90, 90));
    this.tweens.add({ targets: wr, angle: { from: -30, to: 30 }, yoyo: true, repeat: -1, duration: 260 });
    this.tweens.add({ targets: car, y: 412, yoyo: true, repeat: -1, duration: 200 });
    this.tweens.add({ targets: rac, y: 460, yoyo: true, repeat: -1, duration: 300 });
    // timer bar
    const total = pitMs();
    add(this.add.rectangle(W / 2, 140, 800, 34, 0xffffff, 0.2).setStrokeStyle(4, 0xffffff));
    const bar = add(this.add.rectangle(W / 2 - 400, 140, 0, 34, 0x38b000).setOrigin(0, 0.5));
    const clock = add(this.add.text(W / 2, 196, '2:00', { fontFamily: FONT, fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
    // squats
    let squats = 0;
    let last = 0;
    let ready = false;
    const circles = Array.from({ length: SQUATS }, (_, i) => add(this.add.circle(640 + (i % 5) * 104, 300 + Math.floor(i / 5) * 104, 40, 0xffffff, 0.15).setStrokeStyle(4, 0xffffff)));
    const nums = circles.map((c, i) => add(this.add.text(c.x, c.y, String(i + 1), { fontFamily: FONT, fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0.4)));
    const squat = () => {
      if (!ready || squats >= SQUATS || this.time.now - last < 1200) return;
      last = this.time.now;
      squats++;
      circles[squats - 1]!.setFillStyle(0x38b000, 1);
      nums[squats - 1]!.setAlpha(1);
      this.tweens.add({ targets: [circles[squats - 1], nums[squats - 1]], scale: { from: 1.4, to: 1 }, duration: 300, ease: 'Back.easeOut' });
      this.beep([440 + squats * 40], 0.1);
      voice.say(english(`n${squats}`));
      if (squats === SQUATS) void this.wait(900, run).then((alive) => alive && this.talk(this.ru('raccoon.race.pit.ten')));
    };
    const btn = add(button(this, 900, 560, 'Присел!', squat, { w: 420, h: 110, color: 0x38b000 }));
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') squat();
    };
    this.input.keyboard?.on('keydown', onKey);

    if (!(await this.talk(this.ru('raccoon.race.pit.0'), this.ru('raccoon.race.pit.1')))) return false;
    ready = true;
    const start = this.time.now;
    while (this.time.now - start < total) {
      if (!(await this.wait(200, run))) return false;
      const left = Math.max(0, total - (this.time.now - start));
      const sec = Math.ceil(left / 1000);
      clock.setText(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
      bar.width = 800 * (1 - left / total);
    }
    this.input.keyboard?.off('keydown', onKey);
    btn.destroy();
    clock.setText('Готово!');
    this.beep([523, 784, 1046], 0.12);
    await this.talk(this.ru('raccoon.race.pit.done'));
    if (run !== this.run) return false;
    await new Promise<void>((r) => {
      const go = add(button(this, 900, 560, 'Поехали!', () => r(), { w: 420, h: 110, color: 0xe63946 }));
      this.tweens.add({ targets: go, scale: 1.08, yoyo: true, repeat: -1, duration: 400 });
    });
    items.forEach((o) => o.destroy());
    this.sincePit = 0;
    this.wrenches.forEach((w) => w.setAlpha(0.3).clearTint());
    this.speed = Math.max(this.track.minSpeed, was * 0.6);
    this.driving = true;
    return run === this.run;
  }

  // ---------- results ----------

  private showResults() {
    const before = TRACKS.map((_, i) => unlocked(this.progress, i));
    this.progress = recordRace(this.progress, this.trackIdx, this.correct, this.hits, this.missed);
    writeStore(STORE_KEY, this.progress);
    const opened = TRACKS.some((_, i) => !before[i] && unlocked(this.progress, i));
    const stars = starsFor(this.correct);
    const d = (o: Phaser.GameObjects.GameObject) => (this.keep(o) as unknown as Phaser.GameObjects.Components.Depth).setDepth(3300);
    d(this.add.rectangle(W / 2, H / 2, W, H, 0x14213d, 0.8).setInteractive());
    d(this.add.text(W / 2, 90, 'Финиш!', { fontFamily: FONT, fontSize: '80px', color: '#ffd166', fontStyle: 'bold', stroke: '#e63946', strokeThickness: 10 }).setOrigin(0.5));
    for (let k = 0; k < 3; k++) {
      const st = this.add.image(W / 2 - 170 + k * 170, 260, k < stars ? 'race-star' : 'race-star-off').setDisplaySize(150, 150).setScale(0);
      d(st);
      this.tweens.add({ targets: st, scale: 150 / 120, delay: 300 + k * 350, duration: 400, ease: 'Back.easeOut', onStart: () => k < stars && this.beep([660 + k * 220], 0.12) });
    }
    d(this.add.text(W / 2, 390, `${this.childName}, правильных слов: ${this.correct} из ${this.rows.length}`, { fontFamily: FONT, fontSize: '40px', color: '#ffffff' }).setOrigin(0.5));
    d(this.add.text(W / 2, 440, 'Три звезды — 10 слов, две — 7, одна — 5', { fontFamily: FONT, fontSize: '24px', color: '#adb5bd' }).setOrigin(0.5));
    if (opened) d(this.add.text(W / 2, 490, 'Открыта новая трасса!', { fontFamily: FONT, fontSize: '34px', color: '#ffd166' }).setOrigin(0.5));
    d(button(this, W / 2 - 330, 610, 'Ещё раз', () => this.startRace(this.trackIdx), { w: 280, h: 96, color: 0xe63946 }));
    d(button(this, W / 2, 610, 'Трассы', () => this.showMenu(), { w: 280, h: 96, color: 0x277da1 }));
    d(button(this, W / 2 + 330, 610, 'Домой', () => this.scene.start('Harbor'), { w: 280, h: 96, color: 0x6c757d }));
    const lines = [this.ru(`raccoon.race.finish.${stars}`)];
    if (opened) lines.push(this.ru('raccoon.race.unlock'));
    void this.wait(1400).then((alive) => alive && this.talk(...lines));
  }
}
