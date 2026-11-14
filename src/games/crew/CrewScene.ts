import Phaser from 'phaser';
import { startRun, track, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import { recordWord } from '../../core/wordLog';
import { button, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, pick, type Rng } from '../common/rng';
import { MAX_LEVEL, other, pickStory, planEmotions, scoreTom, shuffledFrames, type Chest, type Emotion, type EmotionTrial, type Story } from './logic';

const KEY = 'crew-progress';
/** Who each situation is about, so the picture matches the story. */
const SIT_HERO: Record<string, string> = { gift: 'raccoon', cake: 'walrus', balloon: 'rumb', rain: 'kettle', icecream: 'walrus', tower: 'raccoon', noise: 'rumb', octopus: 'kettle' };
const FACE_COLORS = [0xffd166, 0x8ecae6, 0xf4a261, 0xb5e48c];

/** A round cartoon face showing one feeling. Drawn around (0,0), radius r. */
export function drawFace(g: Phaser.GameObjects.Graphics, emo: Emotion, r: number, color: number) {
  const ol = 0x2b2d42;
  g.fillStyle(emo === 'angry' ? 0xf28482 : color).fillCircle(0, 0, r).lineStyle(5, ol).strokeCircle(0, 0, r);
  const ex = r * 0.36;
  const ey = -r * 0.18;
  const eye = emo === 'scared' || emo === 'surprised' ? r * 0.15 : r * 0.1;
  for (const s of [-1, 1]) {
    if (emo === 'scared' || emo === 'surprised') g.fillStyle(0xffffff).fillCircle(s * ex, ey, eye).lineStyle(3, ol).strokeCircle(s * ex, ey, eye);
    g.fillStyle(ol).fillCircle(s * ex, ey, r * 0.07);
    // Brows.
    g.lineStyle(5, ol);
    const by = ey - r * 0.25;
    if (emo === 'angry') g.lineBetween(s * ex - s * r * 0.18, by + r * 0.08, s * ex + s * r * 0.14, by - r * 0.08);
    else if (emo === 'sad' || emo === 'scared') g.lineBetween(s * ex - s * r * 0.16, by - r * 0.06, s * ex + s * r * 0.14, by + r * 0.04);
    else if (emo === 'surprised') g.lineBetween(s * ex - r * 0.14, by - r * 0.1, s * ex + r * 0.14, by - r * 0.1);
  }
  g.lineStyle(6, ol);
  const my = r * 0.38;
  if (emo === 'happy') {
    g.beginPath().arc(0, r * 0.12, r * 0.42, 0.25 * Math.PI, 0.75 * Math.PI).strokePath();
  } else if (emo === 'sad') {
    g.beginPath().arc(0, my + r * 0.28, r * 0.3, 1.2 * Math.PI, 1.8 * Math.PI).strokePath();
    g.fillStyle(0x4cc9f0).fillCircle(ex + r * 0.06, ey + r * 0.22, r * 0.06);
  } else if (emo === 'angry') {
    g.lineBetween(-r * 0.25, my, r * 0.25, my - r * 0.04);
  } else if (emo === 'scared') {
    // A shaky zigzag mouth and a drop of sweat.
    g.lineStyle(5, ol).beginPath().moveTo(-r * 0.3, my);
    for (let k = 1; k <= 6; k++) g.lineTo(-r * 0.3 + k * r * 0.1, my + (k % 2 ? -r * 0.07 : r * 0.07));
    g.strokePath();
    g.fillStyle(0x4cc9f0).fillCircle(r * 0.72, -r * 0.3, r * 0.08).fillTriangle(r * 0.64, -r * 0.33, r * 0.8, -r * 0.33, r * 0.72, -r * 0.5);
  } else {
    g.fillStyle(ol).fillEllipse(0, my + r * 0.04, r * 0.3, r * 0.4);
  }
}

/** «Истории команды»: feelings in English, a story in order to retell, and what Rumb thinks. */
export class CrewScene extends Phaser.Scene {
  private rng!: Rng;
  private level = 1;
  private run?: Run;
  private talkToken = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private right = 0;
  private total = 0;
  private lastStory?: string;
  /** For play-through tests. */
  protected answerNow?: string;

  constructor() {
    super('Crew');
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    let saved: { level?: number; story?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    } catch {
      /* fresh */
    }
    this.level = saved.level && saved.level >= 1 && saved.level <= MAX_LEVEL ? saved.level : 1;
    this.lastStory = saved.story;
    this.layer = [];
    this.right = 0;
    this.total = 0;
    this.add.rectangle(W / 2, H / 2, W, H, 0xfff1d0);
    const g = this.add.graphics();
    for (let x = 0; x < W; x += 80) g.fillStyle(x % 160 ? 0xf4d58d : 0xf2cc8f).fillRect(x, 560, 80, 160);
    this.add.text(40, 40, `Истории команды · уровень ${this.level}`, { fontFamily: FONT, fontSize: '30px', color: '#3d2b1f' }).setOrigin(0, 0.5);
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.run = startRun('crew', { level: this.level });
    this.events.once('shutdown', () => {
      this.talkToken++;
      voice.stop();
      this.run?.end({ completed: false });
    });
    this.time.delayedCall(0, () => void this.play());
  }

  private leave() {
    this.run?.end({ completed: false });
    goHome(this);
  }

  private clear() {
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.push(o);
    return o;
  }

  private async talk(...lines: Utterance[]): Promise<boolean> {
    const token = ++this.talkToken;
    for (const u of lines) {
      if (token !== this.talkToken) return false;
      voice.say(u);
      await voice.idle(10000);
      if (!this.sys.isActive()) return false;
    }
    return token === this.talkToken;
  }

  private tap<T>(fill: (resolve: (v: T) => void) => void): Promise<T | null> {
    return new Promise<T | null>((resolve) => {
      this.events.once('shutdown', () => resolve(null));
      fill(resolve);
    });
  }

  private async play() {
    if (!(await this.talk(phrase('rumb.crew.hello')))) return;
    for (const t of planEmotions(this.level, this.rng)) if (!(await this.emotion(t))) return;
    if (!(await this.story(pickStory(this.rng, this.lastStory)))) return;
    if (!(await this.tom())) return;
    this.finish();
  }

  // ---------- feelings ----------

  private async emotion(t: EmotionTrial): Promise<boolean> {
    this.clear();
    this.answerNow = t.emo;
    const intro: Utterance[] = t.kind === 'word' ? [english(`emo.who.${t.emo}`)] : [phrase(`rumb.crew.sit.${t.sit}` as PhraseId), phrase('rumb.crew.feel')];
    if (t.kind === 'situation') this.keep(this.add.image(W / 2, 170, `char-${SIT_HERO[t.sit] ?? 'rumb'}`).setDisplaySize(150, 150));
    else this.keep(this.add.text(W / 2, 170, '?', { fontFamily: FONT, fontSize: '110px', color: '#3d2b1f' }).setOrigin(0.5));
    const colors = [...FACE_COLORS];
    const zones: Phaser.GameObjects.Zone[] = [];
    t.options.forEach((emo, i) => {
      const x = W / 2 + (i - 1) * 300;
      const g = this.keep(this.add.graphics({ x, y: 420 }));
      drawFace(g, emo, 100, colors.splice(Math.floor(this.rng() * colors.length), 1)[0]!);
      zones.push(this.keep(this.add.zone(x, 420, 220, 220).setData('emo', emo)));
    });
    if (!(await this.talk(...intro))) return false;
    const t0 = Date.now();
    let first = true;
    for (;;) {
      zones.forEach((z) => z.setInteractive({ useHandCursor: true }));
      const got = await this.tap<Emotion>((r) => zones.forEach((z) => z.once('pointerup', () => r(z.getData('emo') as Emotion))));
      zones.forEach((z) => {
        z.removeAllListeners();
        z.disableInteractive();
      });
      if (got === null || !this.sys.isActive()) return false;
      const ok = got === t.emo;
      this.run?.answer({ item: t.kind === 'word' ? `who-${t.emo}` : `sit-${t.sit}`, correct: ok, chosen: got, ms: Date.now() - t0, attempt: first ? 1 : 2, skill: t.kind === 'word' ? 'emotion_word' : 'emotion_situation' });
      if (first) {
        recordWord(`emo.${t.emo}`, ok, 'crew');
        this.total++;
        if (ok) this.right++;
      }
      if (ok) {
        const z = zones.find((zz) => zz.getData('emo') === got)!;
        this.keep(this.add.circle(z.x, z.y, 118).setStrokeStyle(8, 0x2a9d8f));
        return this.talk(english(`emo.${t.emo}`), phrase('rumb.crew.yes'));
      }
      first = false;
      // Name the face that was picked, then ask again.
      if (!(await this.talk(english(`emo.it.${got}`), t.kind === 'word' ? english(`emo.who.${t.emo}`) : phrase('rumb.crew.again')))) return false;
    }
  }

  // ---------- a story in pictures ----------

  private frame(story: Story, i: number, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    c.add(this.add.rectangle(0, 0, 300, 240, 0xffffff).setStrokeStyle(6, 0x3d2b1f));
    c.add(g);
    if (story === 'seed') {
      g.fillStyle(0x8ecae6).fillRect(-144, -114, 288, 150).fillStyle(0x9c6644).fillRect(-144, 36, 288, 78);
      g.fillStyle(0x7f5539).fillEllipse(0, 40, 90, 30);
      if (i === 0) g.fillStyle(0x3d2b1f).fillEllipse(0, 60, 16, 10).fillStyle(0x4cc9f0).fillCircle(-40, -40, 8).fillCircle(-10, -70, 8).fillCircle(30, -50, 8);
      if (i === 1) g.lineStyle(6, 0x52b788).lineBetween(0, 36, 0, 0).fillStyle(0x52b788).fillEllipse(-14, -4, 28, 14).fillEllipse(14, -8, 28, 14);
      if (i === 2) {
        g.lineStyle(14, 0x9c6644).lineBetween(0, 36, 6, -60);
        g.fillStyle(0x2d6a4f);
        for (const a of [-2.6, -2.0, -1.2, -0.5]) g.fillEllipse(6 + Math.cos(a) * 46, -62 + Math.sin(a) * 18 + 10, 90, 22);
        g.fillStyle(0x9c6644).fillCircle(-4, -48, 9).fillCircle(14, -50, 9);
      }
    } else if (story === 'tea') {
      g.fillStyle(0xfdf0d5).fillRect(-144, -114, 288, 228);
      const k = this.add.image(0, -20, 'char-kettle').setDisplaySize(140, 140);
      c.add(k);
      if (i === 0) g.fillStyle(0x4cc9f0).fillTriangle(90, -60, 80, -38, 100, -38).fillCircle(90, -36, 10);
      if (i >= 1) g.fillStyle(0xf77f00).fillTriangle(-40, 110, 0, 50, 40, 110).fillStyle(0xfcbf49).fillTriangle(-20, 110, 0, 75, 20, 110);
      if (i === 2) {
        g.lineStyle(5, 0xadb5bd);
        for (const sx of [-30, 0, 30]) g.beginPath().arc(sx + 50, -90, 12, Math.PI, 0).strokePath();
        g.fillStyle(0xe63946).fillRect(90, 50, 40, 40).lineStyle(4, 0x2b2d42).strokeRect(90, 50, 40, 40);
      }
    } else if (story === 'cargo') {
      g.fillStyle(0x8ecae6).fillRect(-144, -114, 288, 228).fillStyle(0x219ebc).fillRect(-144, 40, 288, 74);
      if (i < 2) g.fillStyle(0xa5683a).fillRect(-144, 20, 90, 30);
      const ship = this.add.image(i === 2 ? 40 : 40, 0, 'yacht-side').setDisplaySize(140, 130);
      c.add(ship);
      if (i === 0) for (const [dx, dy] of [[-125, -8], [-95, -8], [-110, -38]]) c.add(this.add.image(dx!, dy!, 'crate').setDisplaySize(30, 30));
      if (i === 1) for (const [dx, dy] of [[20, 20], [50, 20]]) c.add(this.add.image(dx!, dy!, 'crate').setDisplaySize(30, 30));
      if (i === 2) {
        ship.setPosition(80, -6);
        g.lineStyle(4, 0xffffff).lineBetween(-80, 60, -20, 60).lineBetween(-60, 80, 0, 80);
      }
    } else {
      // storm: sun → rain → rainbow
      g.fillStyle(i === 1 ? 0x6c757d : 0x8ecae6).fillRect(-144, -114, 288, 160).fillStyle(0x219ebc).fillRect(-144, 46, 288, 68);
      if (i === 0) g.fillStyle(0xffd166).fillCircle(80, -60, 30);
      if (i === 1) {
        g.fillStyle(0x495057).fillEllipse(-40, -70, 140, 50).fillEllipse(50, -80, 120, 50);
        g.lineStyle(4, 0x4cc9f0);
        for (let k = 0; k < 7; k++) g.lineBetween(-100 + k * 30, -40, -110 + k * 30, -10);
      }
      if (i === 2) {
        [0xe63946, 0xf77f00, 0xffd166, 0x52b788, 0x277da1].forEach((col, k) => g.lineStyle(9, col).beginPath().arc(0, 46, 120 - k * 9, Math.PI, 0).strokePath());
      }
      c.add(this.add.image(-60, 40, 'yacht-side').setDisplaySize(90, 84));
    }
    return c;
  }

  private async story(story: Story): Promise<boolean> {
    this.clear();
    this.answerNow = story;
    const order = shuffledFrames(this.rng);
    const views = order.map((f, k) => {
      const v = this.keep(this.frame(story, f, W / 2 + (k - 1) * 340, 330));
      v.setData('frame', f);
      return v;
    });
    if (!(await this.talk(phrase('rumb.crew.story')))) return false;
    const t0 = Date.now();
    let mistakes = 0;
    let next = 0;
    await this.tap<void>((resolve) => {
      for (const v of views) {
        v.setSize(300, 240).setInteractive({ useHandCursor: true });
        v.on('pointerup', () => {
          if (v.getData('done')) return;
          const f = v.getData('frame') as number;
          if (f === next) {
            v.setData('done', true);
            v.add(this.add.circle(-130, -100, 30, 0x2a9d8f).setStrokeStyle(4, 0xffffff));
            v.add(this.add.text(-130, -100, String(next + 1), { fontFamily: FONT, fontSize: '36px', color: '#fff' }).setOrigin(0.5));
            next++;
            if (next === 3) resolve();
          } else {
            mistakes++;
            this.cameras.main.shake(120, 0.003);
            this.tweens.add({ targets: v, angle: 4, yoyo: true, repeat: 2, duration: 80 });
            void this.talk(phrase(next === 0 ? 'rumb.crew.first' : 'rumb.crew.after'));
          }
        });
      }
    });
    if (!this.sys.isActive()) return false;
    views.forEach((v) => v.disableInteractive());
    this.total++;
    if (mistakes === 0) this.right++;
    this.run?.answer({ item: `story-${story}`, correct: mistakes === 0, mistakes, ms: Date.now() - t0, skill: 'sequence' });
    // Line them up in order, then ask for a retelling to a grown-up.
    for (const v of views) this.tweens.add({ targets: v, x: W / 2 + ((v.getData('frame') as number) - 1) * 340, duration: 400 });
    if (!(await this.talk(phrase('rumb.crew.retell')))) return false;
    const told = await this.tap<boolean>((resolve) => {
      this.keep(button(this, W / 2 - 200, 610, 'Рассказал!', () => resolve(true), { w: 340, h: 90, color: 0x2a9d8f }));
      this.keep(button(this, W / 2 + 200, 610, 'Потом', () => resolve(false), { w: 260, h: 90, color: 0x6c757d }));
    });
    if (told === null || !this.sys.isActive()) return false;
    this.run?.event('retell', { story, told });
    track('crew', 'retell', { story, told });
    try {
      localStorage.setItem(KEY, JSON.stringify({ level: this.level, story }));
    } catch {
      /* private mode */
    }
    if (told) return this.talk(phrase('rumb.crew.told'));
    return true;
  }

  // ---------- what does Rumb think? ----------

  private async tom(): Promise<boolean> {
    this.clear();
    const hid: Chest = pick(this.rng, ['red', 'blue'] as Chest[]);
    this.answerNow = hid;
    const at: Record<Chest, number> = { red: 420, blue: 860 };
    const chest = (c: Chest) => {
      const k = this.keep(this.add.container(at[c], 420));
      k.add(this.add.rectangle(0, 0, 220, 150, c === 'red' ? 0xe63946 : 0x277da1).setStrokeStyle(6, 0x2b2d42));
      k.add(this.add.rectangle(0, -60, 236, 40, c === 'red' ? 0xc1121f : 0x1d3557).setStrokeStyle(6, 0x2b2d42));
      k.add(this.add.rectangle(0, -36, 30, 30, 0xffd166).setStrokeStyle(4, 0x2b2d42));
      return k;
    };
    const chests = { red: chest('red'), blue: chest('blue') };
    const coin = this.keep(this.add.image(640, 230, 'coin').setDisplaySize(70, 70));
    const rumb = this.keep(this.add.image(640, 160, 'char-rumb').setDisplaySize(150, 150));
    const move = (o: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject, x: number, y: number, ms = 700) =>
      new Promise((r) => this.tweens.add({ targets: o, x, y, duration: ms, ease: 'Sine.easeInOut', onComplete: r }));
    if (!(await this.talk(phrase('rumb.crew.tom.intro')))) return false;
    await move(coin, at[hid], 400);
    coin.setVisible(false);
    if (!(await this.talk(phrase(`kettle.crew.tom1.${hid}`)))) return false;
    await move(rumb, -120, 120, 900);
    const magpie = this.keep(this.add.image(1400, 160, 'char-magpie').setDisplaySize(150, 150));
    await move(magpie, at[hid], 250);
    coin.setVisible(true);
    if (!(await this.talk(phrase(`magpie.crew.tom2.${hid}`)))) return false;
    await Promise.all([move(coin, at[other(hid)], 400), move(magpie, at[other(hid)], 250)]);
    coin.setVisible(false);
    await move(magpie, 1400, 120, 800);
    await move(rumb, 640, 160, 900);
    const ask = async (line: string) => {
      if (!(await this.talk(phrase(line as PhraseId)))) return null;
      const t0 = Date.now();
      const got = await this.tap<Chest>((resolve) => {
        for (const c of ['red', 'blue'] as Chest[]) {
          chests[c].setSize(240, 200).setInteractive({ useHandCursor: true });
          chests[c].once('pointerup', () => resolve(c));
        }
      });
      for (const c of ['red', 'blue'] as Chest[]) chests[c].removeAllListeners().disableInteractive();
      if (got) voice.say(english(`c-${got}`));
      return got ? { got, ms: Date.now() - t0 } : null;
    };
    const belief = await ask('kettle.crew.tom3');
    if (!belief || !this.sys.isActive()) return false;
    const reality = await ask('kettle.crew.tom.real');
    if (!reality || !this.sys.isActive()) return false;
    const s = scoreTom(hid, belief.got, reality.got);
    this.total++;
    if (s.belief && s.reality) this.right++;
    this.run?.answer({ item: 'false-belief', correct: s.belief, reality: s.reality, chosen: belief.got, ms: belief.ms, skill: 'theory_of_mind' });
    // Show the truth: the coin in the other chest.
    coin.setPosition(at[other(hid)], 330).setVisible(true);
    this.tweens.add({ targets: coin, y: 300, yoyo: true, repeat: 2, duration: 200 });
    return this.talk(phrase(s.belief ? `kettle.crew.tom.yes.${hid}` : `kettle.crew.tom.no.${hid}`));
  }

  private finish() {
    this.clear();
    const acc = this.total ? this.right / this.total : 0;
    const next = acc >= 0.85 ? Math.min(MAX_LEVEL, this.level + 1) : acc < 0.5 ? Math.max(1, this.level - 1) : this.level;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      localStorage.setItem(KEY, JSON.stringify({ ...saved, level: next }));
    } catch {
      /* private mode */
    }
    const stars = acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : 1;
    this.run?.end({ completed: true, stars, score: this.right, total: this.total, levelChange: next - this.level });
    this.run = undefined;
    this.keep(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive());
    this.keep(this.add.rectangle(W / 2, H / 2, 760, 420, 0xfffaf0).setStrokeStyle(8, 0x7a4a24));
    this.keep(this.add.text(W / 2, 200, 'Команда тобой гордится!', { fontFamily: FONT, fontSize: '44px', color: '#7a4a24' }).setOrigin(0.5));
    for (let i = 0; i < 3; i++) this.keep(this.add.star(W / 2 - 110 + i * 110, 300, 5, 22, 48, i < stars ? 0xffd166 : 0xdee2e6).setStrokeStyle(4, 0x3d2b1f));
    this.keep(button(this, W / 2 - 170, 440, 'Ещё раз', () => this.scene.restart(), { w: 300, h: 90, color: 0x2a9d8f }));
    this.keep(button(this, W / 2 + 170, 440, 'Домой', () => goHome(this), { w: 300, h: 90, color: 0x6c757d }));
    this.layer.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(20));
    void this.talk(phrase('rumb.crew.end'));
  }
}
