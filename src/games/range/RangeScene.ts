import Phaser from 'phaser';
import { showProgress } from '../common/progressUi';
import { analytics, startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, ENGLISH, join, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import { levelLog, levelNote, nextLevelSmart, statsFromRun } from '../../core/smartLevel';
import { recordWord } from '../../core/wordLog';
import { button, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { preloadWordPictures } from '../snake/SnakeScene';
import { BOTTLE_SVG, lockedSvg, weaponSvg } from './art';
import {
  achievementsFrom, cellName, faceId, flightMs, GAME_ID, hitTest, itemOf, leadX, MAX_LEVEL, planRound, RANGE_WORDS, readSave,
  RELOAD_AMMO, SAVE_KEY, SPARE_AMMO, spec, starsFor, TASKS_PER_ROUND, unlocks, weapon, WEAPONS,
  type Face, type LevelSpec, type RangeSave, type Task, type Unlock, type Weapon,
} from './logic';

const toUri = (s: string) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(s)))}`;

const GUN = { x: 640, y: 625 };
const LANE_X0 = 40;
const LANE_X1 = 1240;
/** Shots aimed above this line or below the deck line are UI taps, not shots. */
const SHOT_TOP = 110;
const SHOT_BOTTOM = 560;
const PAINT: Record<string, number> = { red: 0xe63946, blue: 0x277da1, green: 0x43aa8b, yellow: 0xffd166 };

interface Target {
  face: Face;
  view: Phaser.GameObjects.Container;
  x: number;
  y: number;
  vx: number;
  r: number;
  bob: number;
  ghost?: Phaser.GameObjects.Arc;
}

/** «Тир канонира Пломбира»: hit the target the walrus names; toy weapons opened by achievements. */
export class RangeScene extends Phaser.Scene {
  private rng!: Rng;
  private save!: RangeSave;
  private level = 1;
  private spec!: LevelSpec;
  private run?: Run;
  private talkToken = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private hud: Phaser.GameObjects.GameObject[] = [];
  private targets: Target[] = [];
  private unlockList: Unlock[] = [];
  private gun?: Phaser.GameObjects.Image;
  private ammo = 0;
  private ammoText?: Phaser.GameObjects.Text;
  private reloaded = false;
  private right = 0;
  private total = 0;
  private lastShot = 0;
  private holding = false;
  /** Set while the current task waits for a shot; cleared once it is solved. */
  private onLanding?: (x: number, y: number) => void;
  private busy = false;
  /** The task on screen (read by the play-through check in dev). */
  private task?: Task;

  constructor() {
    super('Range');
  }

  preload() {
    preloadWordPictures(this, RANGE_WORDS);
    for (const w of WEAPONS) {
      if (!this.textures.exists(`range-w-${w.id}`)) this.load.svg(`range-w-${w.id}`, toUri(weaponSvg(w.id)), { width: 200, height: 120 });
      if (!this.textures.exists(`range-l-${w.id}`)) this.load.svg(`range-l-${w.id}`, toUri(lockedSvg(w.id)), { width: 200, height: 120 });
    }
    if (!this.textures.exists('range-bottle')) this.load.svg('range-bottle', toUri(BOTTLE_SVG), { width: 80, height: 140 });
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    try {
      this.save = readSave(localStorage.getItem(SAVE_KEY));
    } catch {
      this.save = readSave(null);
    }
    this.level = this.save.level;
    this.spec = spec(this.level);
    this.layer = [];
    this.hud = [];
    this.targets = [];
    this.right = 0;
    this.total = 0;
    this.reloaded = false;
    this.busy = false;
    this.onLanding = undefined;
    this.holding = false;
    this.drawDeck();
    button(this, 1190, 40, 'Домой', () => goHome(this), { w: 160, h: 64, color: 0x6c757d }).setDepth(30);
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false });
      this.run = undefined;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.trigger(p, true));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.aim(p));
    this.input.on('pointerup', () => (this.holding = false));
    void this.openArsenal(true);
  }

  update(_t: number, delta: number) {
    const dt = delta / 1000;
    const w = weapon(this.save.weapon);
    for (const t of this.targets) {
      if (t.vx) t.x = leadX(t.x, t.vx, delta, LANE_X0, LANE_X1);
      t.bob += dt * 2.2;
      t.view.setPosition(t.x, t.y + Math.sin(t.bob) * (this.spec.ships ? 3 : 7));
      if (t.ghost) {
        const ms = flightMs(w, Math.hypot(t.x - GUN.x, t.y - GUN.y));
        t.ghost.setPosition(leadX(t.x, t.vx, ms, LANE_X0, LANE_X1), t.y);
      }
    }
    // The confetti gun keeps firing while the finger is down.
    const p = this.input.activePointer;
    if (this.holding && w.auto && p.isDown) this.trigger(p, false);
  }

  // ---------- scenery ----------

  private drawDeck() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x8ecae6, 0x8ecae6, 0xcaf0f8, 0xcaf0f8).fillRect(0, 0, W, 300);
    g.fillStyle(0xffffff, 0.9).fillEllipse(220, 90, 200, 50).fillEllipse(980, 120, 240, 60).fillEllipse(640, 60, 160, 40);
    g.fillStyle(0x1b4965).fillRect(0, 300, W, 280);
    g.fillStyle(0x277da1);
    for (let y = 320; y < 560; y += 40) for (let x = (y / 40) % 2 ? 0 : 60; x < W; x += 120) g.fillEllipse(x, y, 70, 8);
    // Deck: planks, rail.
    g.fillStyle(0xa5683a).fillRect(0, 560, W, 160);
    g.lineStyle(3, 0x7a4a24);
    for (let y = 590; y < H; y += 34) g.lineBetween(0, y, W, y);
    g.fillStyle(0x7a4a24).fillRect(0, 552, W, 16);
    this.add.image(100, 600, 'char-walrus').setDisplaySize(180, 180).setDepth(5);
  }

  private clear(list: Phaser.GameObjects.GameObject[] = this.layer) {
    list.forEach((o) => o.destroy());
    list.length = 0;
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T, list = this.layer): T {
    list.push(o);
    return o;
  }

  private async talk(...lines: Utterance[]): Promise<boolean> {
    const token = ++this.talkToken;
    for (const u of lines) {
      if (token !== this.talkToken) return false;
      voice.say(u);
      await voice.idle(9000);
      if (!this.sys.isActive()) return false;
    }
    return token === this.talkToken;
  }

  private wait(ms: number) {
    return new Promise<boolean>((r) => this.time.delayedCall(ms, () => r(this.sys.isActive())));
  }

  private persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* private mode */
    }
  }

  // ---------- arsenal ----------

  private async openArsenal(first: boolean) {
    this.clear();
    this.clear(this.hud);
    this.gun?.destroy();
    this.gun = undefined;
    let events: Awaited<ReturnType<typeof analytics.all>> = [];
    try {
      events = await analytics.all();
    } catch {
      /* no storage: only the water pistol */
    }
    if (!this.sys.isActive()) return;
    this.unlockList = unlocks(achievementsFrom(events), this.save.seen);
    const fresh = this.unlockList.filter((u) => u.open && u.id !== 'water' && !this.save.seen.includes(u.id));
    this.save.seen = this.unlockList.filter((u) => u.open).map((u) => u.id);
    if (!this.unlockList.find((u) => u.id === this.save.weapon)?.open) this.save.weapon = 'water';
    if (fresh.length) this.save.weapon = fresh[fresh.length - 1]!.id;
    this.persist();

    const dim = this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(10).setInteractive());
    void dim;
    this.keep(this.add.rectangle(W / 2, 360, 1180, 640, 0xfffaf0).setStrokeStyle(8, 0x7a4a24).setDepth(10));
    this.keep(this.add.text(W / 2, 80, `Арсенал · тир, уровень ${this.level}`, { fontFamily: FONT, fontSize: '40px', color: '#7a4a24' }).setOrigin(0.5).setDepth(11));
    const cards: Phaser.GameObjects.Container[] = [];
    const paint = () =>
      cards.forEach((c, i) => {
        const frame = c.getAt(0) as Phaser.GameObjects.Rectangle;
        frame.setStrokeStyle(this.unlockList[i]!.id === this.save.weapon ? 10 : 4, this.unlockList[i]!.id === this.save.weapon ? 0x2a9d8f : 0xadb5bd);
      });
    this.unlockList.forEach((u, i) => {
      const w = weapon(u.id);
      const x = 205 + (i % 4) * 290;
      const y = 225 + Math.floor(i / 4) * 230;
      const items: Phaser.GameObjects.GameObject[] = [
        this.add.rectangle(0, 0, 270, 210, u.open ? 0xffffff : 0xe9ecef),
        this.add.image(0, -45, u.open ? `range-w-${u.id}` : `range-l-${u.id}`).setDisplaySize(170, 102),
        this.add.text(0, 22, w.name, { fontFamily: FONT, fontSize: '21px', color: '#2b2d42', align: 'center', wordWrap: { width: 250 } }).setOrigin(0.5, 0),
      ];
      if (u.open) {
        items.push(this.add.text(0, 76, w.how, { fontFamily: FONT, fontSize: '16px', color: '#495057', align: 'center', wordWrap: { width: 250 } }).setOrigin(0.5));
      } else {
        items.push(this.add.text(0, 66, u.rule, { fontFamily: FONT, fontSize: '15px', color: '#7a4a24', align: 'center', wordWrap: { width: 250 } }).setOrigin(0.5));
        const bar = 200;
        items.push(this.add.rectangle(-bar / 2, 94, bar, 10, 0xdee2e6).setOrigin(0, 0.5));
        items.push(this.add.rectangle(-bar / 2, 94, Math.max(4, (bar * u.have) / u.need), 10, 0x2a9d8f).setOrigin(0, 0.5));
      }
      const c = this.keep(this.add.container(x, y, items).setDepth(11).setSize(270, 210));
      if (u.open) {
        c.setInteractive({ useHandCursor: true });
        c.on('pointerup', () => {
          this.save.weapon = u.id;
          this.persist();
          paint();
        });
      }
      if (fresh.some((f) => f.id === u.id)) {
        this.tweens.add({ targets: c, scale: { from: 1.15, to: 1 }, duration: 500, ease: 'Back.easeOut', repeat: 2 });
        items.push(this.add.text(110, -95, 'Новое!', { fontFamily: FONT, fontSize: '20px', color: '#fff', backgroundColor: '#e63946', padding: { x: 8, y: 2 } }).setOrigin(1, 0));
      }
      cards.push(c);
    });
    paint();
    this.keep(button(this, W / 2, 640, 'В бой!', () => void this.startRound(), { w: 320, h: 84, color: 0x2a9d8f }).setDepth(12));
    const lines: Utterance[] = [];
    if (first) lines.push(phrase('walrus.range.hello'));
    for (const f of fresh) lines.push(phrase(`walrus.range.got.${f.id}` as PhraseId));
    if (!fresh.length) lines.push(phrase('walrus.range.pick'));
    void this.talk(...lines);
  }

  // ---------- one round ----------

  private async startRound() {
    this.clear();
    voice.stop();
    this.talkToken++;
    this.right = 0;
    this.total = 0;
    this.reloaded = false;
    this.ammo = TASKS_PER_ROUND + SPARE_AMMO;
    this.drawHud();
    this.run = startRun(GAME_ID, { level: this.level, weapon: this.save.weapon });
    const tasks = planRound(this.level, this.rng);
    let explainedLead = false;
    let explainedGrid = false;
    let explainedAttr = false;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]!;
      const intro: Utterance[] = [];
      if (t.kind === 'grid' && !explainedGrid) {
        explainedGrid = true;
        intro.push(phrase('walrus.range.grid'));
      } else if (t.kind === 'attr' && !explainedAttr) {
        explainedAttr = true;
        intro.push(phrase('walrus.range.attr'));
      } else if (t.kind !== 'grid' && this.spec.ships && !explainedLead) {
        explainedLead = true;
        intro.push(phrase(this.spec.aimHelp ? 'walrus.range.lead.help' : 'walrus.range.lead'));
      }
      if (!(await this.playTask(t, i, intro))) return;
    }
    this.finish();
  }

  private drawHud() {
    this.clear(this.hud);
    this.gun = this.keep(this.add.image(GUN.x, GUN.y, `range-w-${this.save.weapon}`).setDisplaySize(180, 108).setOrigin(0.25, 0.5).setDepth(6), this.hud);
    this.gun.setRotation(-Math.PI / 2);
    this.ammoText = this.keep(this.add.text(200, 650, '', { fontFamily: FONT, fontSize: '30px', color: '#fff', stroke: '#3d2b1f', strokeThickness: 6 }).setOrigin(0, 0.5).setDepth(6), this.hud);
    this.keep(this.add.text(40, 40, `Тир · уровень ${this.level}`, { fontFamily: FONT, fontSize: '28px', color: '#fff', stroke: '#1b4965', strokeThickness: 6 }).setOrigin(0, 0.5).setDepth(6), this.hud);
    // Quick weapon switch: the opened ones, small, on the deck.
    const open = this.unlockList.filter((u) => u.open);
    open.forEach((u, i) => {
      const x = 840 + (i % 4) * 92;
      const y = 600 + Math.floor(i / 4) * 64;
      const img = this.keep(this.add.image(x, y, `range-w-${u.id}`).setDisplaySize(80, 48).setDepth(6).setInteractive({ useHandCursor: true }), this.hud);
      img.setAlpha(u.id === this.save.weapon ? 1 : 0.55);
      img.on('pointerup', () => {
        this.save.weapon = u.id;
        this.persist();
        this.run?.event('weapon', { id: u.id });
        this.gun?.setTexture(`range-w-${u.id}`).setDisplaySize(180, 108);
        this.hud.forEach((o) => o instanceof Phaser.GameObjects.Image && o !== this.gun && o.texture.key.startsWith('range-w-') && o.setAlpha(o.texture.key === `range-w-${u.id}` ? 1 : 0.55));
      });
    });
    this.updateAmmo();
  }

  private updateAmmo() {
    this.ammoText?.setText(`Заряды: ${Math.max(0, Math.floor(this.ammo))}`);
  }

  private promptOf(t: Task): { show: string; say: Utterance[] } {
    switch (t.kind) {
      case 'word':
        return { show: `Hit the ${ENGLISH[t.word]}!`, say: [join(english('range.hit'), english(t.word))] };
      case 'sum': {
        const id = t.op === '+' ? 'walrus.range.plus' : 'walrus.range.minus';
        return { show: `${t.a} ${t.op === '+' ? '+' : '−'} ${t.b} = ?`, say: [phrase(id, { a: t.a, b: t.b })] };
      }
      case 'attr': {
        if (t.not) return { show: `Not ${ENGLISH[t.not]}!`, say: [join(english('range.not'), english(t.not))] };
        const words: string[] = [t.size, t.color, t.shape].filter((x) => x !== undefined);
        return { show: `Hit the ${words.map((w) => ENGLISH[w]).join(' ')}!`, say: [join(english('range.hit'), ...words.map((w) => english(w)))] };
      }
      case 'grid':
        return { show: cellName(t.col, t.row), say: [english(`cell.${cellName(t.col, t.row)}`)] };
    }
  }

  private async playTask(t: Task, index: number, intro: Utterance[]): Promise<boolean> {
    this.clear();
    this.targets = [];
    this.busy = false;
    this.task = t;
    const p = this.promptOf(t);
    const bubble = this.keep(this.add.text(W / 2, 60, p.show, {
      fontFamily: FONT, fontSize: '40px', color: '#1b4965', backgroundColor: '#ffffff', padding: { x: 24, y: 8 },
    }).setOrigin(0.5).setDepth(8).setInteractive({ useHandCursor: true }));
    bubble.on('pointerup', () => void this.talk(...p.say));
    this.keep(this.add.text(40, 80, `Цель ${index + 1} из ${TASKS_PER_ROUND}`, { fontFamily: FONT, fontSize: '22px', color: '#1b4965' }).setOrigin(0, 0.5).setDepth(8));
    const item = itemOf(t);
    if (t.kind === 'grid') this.drawGrid(t);
    else this.spawnTargets(t.faces);
    if (!(await this.talk(...intro, ...p.say))) return false;
    this.run?.ask(item, { kind: t.kind });
    let wrong = 0;
    const t0 = Date.now();
    const solved = await new Promise<boolean>((resolve) => {
      const done = (ok: boolean) => {
        this.onLanding = undefined;
        resolve(ok);
      };
      this.onLanding = (x, y) => {
        if (this.busy) return;
        let hit = -1;
        let chosen = '';
        let correct = false;
        if (t.kind === 'grid') {
          const cell = this.cellAt(t, x, y);
          if (!cell) return this.splash(x, y);
          hit = 0;
          chosen = cellName(cell.col, cell.row);
          correct = cell.col === t.col && cell.row === t.row;
        } else {
          hit = hitTest(x, y, weapon(this.save.weapon).radius, this.targets);
          if (hit < 0) return this.splash(x, y);
          chosen = faceId(this.targets[hit]!.face);
          correct = hit === t.answer;
        }
        this.run?.answer({ item, correct, firstTry: correct && wrong === 0, chosen: correct ? undefined : chosen, ms: Date.now() - t0, level: this.level, skill: t.kind, weapon: this.save.weapon });
        if (correct) {
          this.busy = true;
          void this.onRight(t, hit, wrong === 0).then((alive) => done(alive));
        } else {
          wrong++;
          void this.onWrong(t, hit, chosen, wrong);
        }
      };
    });
    if (!solved) return false;
    this.total++;
    if (wrong === 0) this.right++;
    if (t.kind === 'word') recordWord(t.word, wrong === 0, GAME_ID);
    return true;
  }

  // ---------- targets ----------

  private faceView(f: Face, size: number): Phaser.GameObjects.GameObject {
    if (f.kind === 'word') return this.add.image(0, 0, `snake-${f.id}`).setDisplaySize(size, size);
    if (f.kind === 'number') return this.add.text(0, 0, String(f.n), { fontFamily: FONT, fontSize: `${Math.round(size * 0.7)}px`, color: '#1b4965', fontStyle: 'bold' }).setOrigin(0.5);
    const g = this.add.graphics();
    const s = (size / 2) * (f.size === 'big' ? 0.95 : 0.55);
    g.fillStyle(PAINT[f.color]!).lineStyle(5, 0x2b2d42);
    if (f.shape === 'circle') g.fillCircle(0, 0, s).strokeCircle(0, 0, s);
    else if (f.shape === 'square') g.fillRect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7).strokeRect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7);
    else if (f.shape === 'triangle') {
      const pts = [new Phaser.Math.Vector2(0, -s), new Phaser.Math.Vector2(s, s * 0.8), new Phaser.Math.Vector2(-s, s * 0.8)];
      g.fillPoints(pts, true).strokePoints(pts, true);
    } else {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? s * 0.45 : s;
        pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
      }
      g.fillPoints(pts, true).strokePoints(pts, true);
    }
    return g;
  }

  private carrier(f: Face, ship: boolean): Phaser.GameObjects.Container {
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (ship) {
      const g = this.add.graphics();
      g.fillStyle(0x7a4a24).lineStyle(5, 0x2b2d42);
      const hull = [new Phaser.Math.Vector2(-80, 40), new Phaser.Math.Vector2(80, 40), new Phaser.Math.Vector2(60, 72), new Phaser.Math.Vector2(-60, 72)];
      g.fillPoints(hull, true).strokePoints(hull, true);
      g.fillStyle(0x5c3317).fillRect(-4, -70, 8, 112);
      g.fillStyle(0xfffaf0, 0.92).fillRoundedRect(-58, -66, 116, 100, 10).strokeRoundedRect(-58, -66, 116, 100, 10);
      g.fillStyle(0xe63946).fillTriangle(4, -86, 4, -70, 30, -78);
      parts.push(g, this.place(this.faceView(f, 84), 0, -16));
    } else if (f.kind === 'number') {
      parts.push(this.add.image(0, 0, 'range-bottle').setDisplaySize(96, 168));
      parts.push(this.add.circle(0, 24, 34, 0xffffff).setStrokeStyle(4, 0x2b2d42));
      parts.push(this.place(this.faceView(f, 58), 0, 24));
    } else {
      const g = this.add.graphics();
      g.lineStyle(3, 0x495057).lineBetween(0, 60, 6, 120);
      parts.push(g);
      parts.push(this.add.circle(0, 0, 64, 0xff8fab).setStrokeStyle(5, 0x2b2d42));
      parts.push(this.add.circle(0, 0, 52, 0xffffff).setStrokeStyle(4, 0xe63946));
      parts.push(this.place(this.faceView(f, 80), 0, 0));
    }
    return this.add.container(0, 0, parts).setDepth(4);
  }

  private place<T extends Phaser.GameObjects.GameObject>(o: T, x: number, y: number): T {
    (o as unknown as Phaser.GameObjects.Components.Transform).setPosition(x, y);
    return o;
  }

  private spawnTargets(faces: Face[]) {
    const s = this.spec;
    const n = faces.length;
    faces.forEach((f, i) => {
      let x: number;
      let y: number;
      let vx = 0;
      if (s.ships) {
        // Two lanes going opposite ways.
        const lane = i % 2;
        const inLane = Math.ceil((n - lane) / 2);
        const k = Math.floor(i / 2);
        x = LANE_X0 + ((k + 0.5 + lane * 0.5) * (LANE_X1 - LANE_X0)) / Math.max(inLane, 2);
        y = lane === 0 ? 250 : 430;
        vx = (lane === 0 ? 1 : -1) * s.speed * (0.85 + this.rng() * 0.3);
      } else {
        x = 220 + (i * 840) / Math.max(1, n - 1);
        y = f.kind === 'number' ? 400 : 300 + (i % 2) * 60;
        vx = s.speed ? (i % 2 ? -1 : 1) * s.speed : 0;
      }
      const view = this.keep(this.carrier(f, s.ships));
      view.setPosition(x, y);
      const t: Target = { face: f, view, x, y, vx, r: s.ships ? 70 : 62, bob: this.rng() * 6 };
      if (s.aimHelp && vx) {
        t.ghost = this.keep(this.add.circle(x, y, 26, 0xffffff, 0.18).setStrokeStyle(4, 0xffffff, 0.8).setDepth(3));
      }
      this.targets.push(t);
      view.setScale(0.2);
      this.tweens.add({ targets: view, scale: 1, duration: 300, delay: i * 70, ease: 'Back.easeOut' });
    });
  }

  // ---------- sea battle ----------

  private gridBox(t: Extract<Task, { kind: 'grid' }>) {
    const cell = t.cols === 4 ? 92 : 76;
    const w = cell * t.cols;
    const h = cell * t.rows;
    return { x0: W / 2 - w / 2, y0: 140, cell, w, h };
  }

  private drawGrid(t: Extract<Task, { kind: 'grid' }>) {
    const b = this.gridBox(t);
    const g = this.keep(this.add.graphics().setDepth(4));
    g.fillStyle(0x277da1, 0.85).fillRect(b.x0, b.y0, b.w, b.h);
    g.lineStyle(3, 0xffffff, 0.9);
    for (let i = 0; i <= t.cols; i++) g.lineBetween(b.x0 + i * b.cell, b.y0, b.x0 + i * b.cell, b.y0 + b.h);
    for (let j = 0; j <= t.rows; j++) g.lineBetween(b.x0, b.y0 + j * b.cell, b.x0 + b.w, b.y0 + j * b.cell);
    const st = { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#1b4965', strokeThickness: 6 };
    for (let i = 0; i < t.cols; i++) this.keep(this.add.text(b.x0 + (i + 0.5) * b.cell, b.y0 - 24, cellName(i, 0)[0]!, st).setOrigin(0.5).setDepth(5));
    for (let j = 0; j < t.rows; j++) this.keep(this.add.text(b.x0 - 28, b.y0 + (j + 0.5) * b.cell, String(j + 1), st).setOrigin(0.5).setDepth(5));
    // Fog over the grid: a ghost ship hides somewhere under it.
    for (let k = 0; k < 6; k++) {
      const f = this.keep(this.add.ellipse(b.x0 + this.rng() * b.w, b.y0 + this.rng() * b.h, 160, 40, 0xffffff, 0.18).setDepth(5));
      this.tweens.add({ targets: f, x: `+=${40 + this.rng() * 40}`, yoyo: true, repeat: -1, duration: 2200 + this.rng() * 1200 });
    }
  }

  private cellAt(t: Extract<Task, { kind: 'grid' }>, x: number, y: number) {
    const b = this.gridBox(t);
    const col = Math.floor((x - b.x0) / b.cell);
    const row = Math.floor((y - b.y0) / b.cell);
    if (col < 0 || row < 0 || col >= t.cols || row >= t.rows) return undefined;
    return { col, row, cx: b.x0 + (col + 0.5) * b.cell, cy: b.y0 + (row + 0.5) * b.cell };
  }

  // ---------- shooting ----------

  private aim(p: Phaser.Input.Pointer) {
    if (!this.gun) return;
    const a = Phaser.Math.Clamp(Math.atan2(p.y - GUN.y, p.x - GUN.x), -Math.PI + 0.15, -0.15);
    this.gun.setRotation(a).setFlipY(a < -Math.PI / 2);
  }

  private trigger(p: Phaser.Input.Pointer, press: boolean) {
    if (!this.onLanding || !this.gun || !this.task) return;
    if (p.y < SHOT_TOP || p.y > SHOT_BOTTOM) return;
    const w = weapon(this.save.weapon);
    if (press) this.holding = true;
    const now = this.time.now;
    if (now - this.lastShot < w.cooldown) return;
    this.lastShot = now;
    this.aim(p);
    if (this.ammo < w.cost) {
      this.ammo += RELOAD_AMMO;
      this.reloaded = true;
      this.run?.event('reload', {});
      void this.talk(phrase('walrus.range.reload'));
    }
    this.ammo -= w.cost;
    this.updateAmmo();
    this.gun.setScale(this.gun.scaleX * 0.92, this.gun.scaleY * 0.92);
    this.time.delayedCall(80, () => this.gun?.setDisplaySize(180, 108));
    const spread = w.shots > 1 ? [-26, 26] : [0];
    spread.forEach((dx, i) => this.fly(w, p.x + dx, p.y, i === 0));
  }

  private fly(w: Weapon, x: number, y: number, counts: boolean) {
    const dist = Math.hypot(x - GUN.x, y - GUN.y);
    const ms = flightMs(w, dist);
    const land = () => {
      this.impact(w, x, y);
      if (counts) this.onLanding?.(x, y);
      else if (this.onLanding && !this.busy) {
        // The second suction cup counts too when the first one hit nothing.
        const hit = hitTest(x, y, w.radius, this.targets);
        if (hit >= 0) this.onLanding(x, y);
      }
    };
    if (w.id === 'blaster') {
      const beam = this.add.line(0, 0, GUN.x, GUN.y - 30, x, y, 0x80ffdb).setOrigin(0).setLineWidth(8).setDepth(7);
      this.tweens.add({ targets: beam, alpha: 0, duration: 220, onComplete: () => beam.destroy() });
      this.time.delayedCall(ms, land);
      return;
    }
    const size = w.id === 'bubble' ? 26 : w.id === 'confetti' ? 7 : w.flight.arc ? 16 : 10;
    const color = w.id === 'confetti' ? [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2][Math.floor(this.rng() * 4)]! : w.id === 'cannon' ? 0x212529 : w.color;
    const ball = this.add.circle(GUN.x, GUN.y - 30, size, color, w.id === 'bubble' ? 0.55 : 1).setStrokeStyle(w.id === 'bubble' ? 3 : 0, 0xffffff).setDepth(7);
    const arcH = !w.flight.arc ? 0 : w.id === 'mortar' ? 380 : 220;
    const sx = GUN.x;
    const sy = GUN.y - 30;
    this.tweens.addCounter({
      from: 0, to: 1, duration: ms,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        ball.setPosition(sx + (x - sx) * k, sy + (y - sy) * k - arcH * 4 * k * (1 - k));
        if (w.flight.arc) ball.setScale(1 + 0.4 * Math.sin(Math.PI * k));
      },
      onComplete: () => {
        ball.destroy();
        land();
      },
    });
  }

  private impact(w: Weapon, x: number, y: number) {
    const ring = this.add.circle(x, y, w.radius, w.color, 0.25).setStrokeStyle(4, w.color, 0.9).setDepth(7);
    this.tweens.add({ targets: ring, scale: { from: 0.4, to: 1.1 }, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    if (w.id === 'mortar' || w.id === 'golden') this.burst(x, y, w.id === 'golden' ? 0xffd166 : 0xc77dff, 14);
  }

  private splash(x: number, y: number) {
    const drop = this.add.ellipse(x, y, 50, 18, 0xffffff, 0.7).setDepth(3);
    this.tweens.add({ targets: drop, scaleX: 1.8, alpha: 0, duration: 400, onComplete: () => drop.destroy() });
  }

  private burst(x: number, y: number, color: number, n = 18) {
    const colors = [color, 0xef476f, 0xffd166, 0x06d6a0, 0x118ab2];
    for (let i = 0; i < n; i++) {
      const bit = this.add.rectangle(x, y, 12, 8, colors[i % colors.length]!).setDepth(9);
      const a = (i / n) * Math.PI * 2;
      const d = 70 + this.rng() * 70;
      this.tweens.add({
        targets: bit, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d + 40, angle: 360 * this.rng(), alpha: 0, duration: 700,
        onComplete: () => bit.destroy(),
      });
    }
  }

  // ---------- answers ----------

  private async onRight(t: Task, hit: number, first: boolean): Promise<boolean> {
    const lines: Utterance[] = [];
    if (t.kind === 'grid') {
      const c = this.cellAt(t, this.gridBox(t).x0 + (t.col + 0.5) * this.gridBox(t).cell, this.gridBox(t).y0 + (t.row + 0.5) * this.gridBox(t).cell)!;
      const ghost = this.keep(this.carrier({ kind: 'number', n: 0 }, true));
      ghost.removeAt(1, true);
      ghost.setPosition(c.cx, c.cy + 10).setScale(0.55).setAlpha(0).setDepth(6);
      this.tweens.add({ targets: ghost, alpha: 0.8, duration: 250, yoyo: true, hold: 300 });
      this.burst(c.cx, c.cy, 0xc77dff, 22);
      lines.push(english(`cell.${cellName(t.col, t.row)}`));
    } else {
      const tg = this.targets[hit]!;
      this.burst(tg.x, tg.y, 0xffd166);
      this.tweens.add({ targets: tg.view, scale: 0, angle: 200, duration: 380, ease: 'Back.easeIn' });
      tg.ghost?.destroy();
      if (t.kind === 'word') lines.push(english(t.word));
      if (t.kind === 'sum') lines.push(english(`n${t.op === '+' ? t.a + t.b : t.a - t.b}`));
    }
    if (first) lines.push(english('range.great'));
    const ok = await this.talk(...lines);
    return ok && (await this.wait(250));
  }

  private async onWrong(t: Task, hit: number, chosen: string, wrong: number) {
    this.cameras.main.shake(120, 0.003);
    const say: Utterance[] = [];
    if (t.kind === 'grid') {
      const [col, row] = [chosen.charCodeAt(0) - 65, Number(chosen.slice(1)) - 1];
      const b = this.gridBox(t);
      const mark = this.keep(this.add.text(b.x0 + (col + 0.5) * b.cell, b.y0 + (row + 0.5) * b.cell, chosen, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setDepth(6));
      void mark;
      say.push(english(`cell.${chosen}`));
    } else {
      const tg = this.targets[hit]!;
      this.tweens.add({ targets: tg.view, angle: { from: -12, to: 12 }, yoyo: true, repeat: 2, duration: 80, onComplete: () => tg.view.setAngle(0) });
      if (tg.face.kind === 'word') say.push(english(tg.face.id));
      else if (tg.face.kind === 'number') say.push(english(`n${tg.face.n}`));
    }
    say.push(phrase('walrus.range.wrong'));
    say.push(...this.promptOf(t).say);
    // After two misses the right target lights up, so the child is never stuck.
    if (wrong >= 2) this.hint(t);
    await this.talk(...say);
  }

  private hint(t: Task) {
    if (t.kind === 'grid') {
      const b = this.gridBox(t);
      const r = this.keep(this.add.rectangle(b.x0 + (t.col + 0.5) * b.cell, b.y0 + (t.row + 0.5) * b.cell, b.cell - 8, b.cell - 8, 0xffd166, 0.35).setStrokeStyle(6, 0xffd166).setDepth(5));
      this.tweens.add({ targets: r, alpha: 0.3, yoyo: true, repeat: -1, duration: 400 });
    } else {
      const tg = this.targets[t.answer];
      if (!tg) return;
      const glow = this.add.circle(0, 0, 76, 0xffd166, 0).setStrokeStyle(8, 0xffd166);
      tg.view.addAt(glow, 0);
      this.tweens.add({ targets: glow, alpha: 0.3, yoyo: true, repeat: -1, duration: 400 });
    }
    this.run?.event('hint', { step: 1 });
  }

  // ---------- end ----------

  private finish() {
    this.clear();
    this.targets = [];
    this.task = undefined;
    const stars = starsFor(this.right, this.total, this.reloaded);
    const d = nextLevelSmart(GAME_ID, this.level, statsFromRun(this.run, this.right, this.total), { maxLevel: MAX_LEVEL, up: 0.85, down: 0.5 });
    this.run?.end({ completed: true, stars, score: this.right, total: this.total, level: this.level, weapon: this.save.weapon, reloaded: this.reloaded, ...levelLog(d) });
    this.run = undefined;
    const from = this.level;
    this.save.level = d.level;
    this.persist();
    this.clear(this.hud);
    this.gun = undefined;
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setInteractive().setDepth(20));
    this.keep(this.add.rectangle(W / 2, H / 2, 820, 480, 0xfffaf0).setStrokeStyle(8, 0x7a4a24).setDepth(20));
    this.keep(this.add.text(W / 2, 170, stars === 3 ? 'Снайпер!' : 'Стрельбы окончены!', { fontFamily: FONT, fontSize: '50px', color: '#7a4a24' }).setOrigin(0.5).setDepth(21));
    for (let i = 0; i < 3; i++) this.keep(this.add.star(W / 2 - 110 + i * 110, 260, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f).setDepth(21));
    this.keep(this.add.text(W / 2, 330, `Метко с первого раза: ${this.right} из ${this.total}`, { fontFamily: FONT, fontSize: '28px', color: '#2b2d42' }).setOrigin(0.5).setDepth(21));
    this.keep(this.add.text(W / 2, 372, levelNote(from, d), { fontFamily: FONT, fontSize: '28px', color: d.change > 0 ? '#2a9d8f' : '#7a4a24' }).setOrigin(0.5).setDepth(21));
    const next = this.unlockList.find((u) => !u.open);
    if (next) this.keep(this.add.text(W / 2, 414, `Следующее: ${weapon(next.id).name} — ${next.rule} (${next.have} из ${next.need})`, { fontFamily: FONT, fontSize: '20px', color: '#495057', align: 'center', wordWrap: { width: 760 } }).setOrigin(0.5).setDepth(21));
    this.keep(button(this, W / 2 - 250, 520, 'Ещё раз', () => void this.restartRound(), { w: 230, h: 84, color: 0x2a9d8f }).setDepth(22));
    this.keep(button(this, W / 2, 520, 'Оружие', () => void this.openArsenal(false), { w: 230, h: 84, color: 0xe9a23b }).setDepth(22));
    this.keep(button(this, W / 2 + 250, 520, 'Домой', () => goHome(this), { w: 230, h: 84, color: 0x6c757d }).setDepth(22));
    // In the layer: «Ещё раз» and «Оружие» clear it without restarting the scene.
    this.keep(showProgress(this, { game: 'range', level: from, stars, next: d.level }).bar);
    void this.talk(phrase(stars === 3 ? 'walrus.range.end' : 'walrus.range.end.more'));
  }

  private async restartRound() {
    this.level = this.save.level;
    this.spec = spec(this.level);
    // A ★★★ round may have opened the golden cannon: check before the next round.
    const before = this.unlockList.filter((u) => u.open).length;
    try {
      this.unlockList = unlocks(achievementsFrom(await analytics.all()), this.save.seen);
    } catch {
      /* keep the old list */
    }
    if (!this.sys.isActive()) return;
    if (this.unlockList.filter((u) => u.open).length > before) return this.openArsenal(false);
    return this.startRound();
  }
}
