import Phaser from 'phaser';
import { startRun, type Run } from '../../core/analytics';
import { voice } from '../../core/audio';
import { english, ENGLISH, phrase, type PhraseId, type Utterance } from '../../core/phrases';
import { addCoins, coins } from '../../core/treasure';
import { LEARNT_BOX, MAX_BOX, planWords, readWordLog, recordWord } from '../../core/wordLog';
import { button, FONT, H, W } from '../../scenes/ui';
import { goHome } from '../common/home';
import { mulberry32, type Rng } from '../common/rng';
import { WORDS } from '../snake/logic';
import { preloadWordPictures } from '../snake/SnakeScene';

const GAME = 'logbook';
const CARDS = 8;
/** Seconds to recall before the answer is spoken: the effort of retrieval is what makes it stick. */
const THINK_SEC = 4;

const PICTURE_IDS = WORDS.map((w) => w.id);

/**
 * «Судовой журнал»: the review screen of the shared vocabulary. Words met in any
 * game come back here when they are due (spaced repetition). The child sees a
 * picture, recalls the English word and says it aloud (testing effect +
 * production effect), then hears it and says honestly whether it matched.
 * Before starting: one coin now, or a chest of three after the whole page
 * (delay of gratification, the promise always kept).
 */
export class LogbookScene extends Phaser.Scene {
  private rng!: Rng;
  private run?: Run;
  private talkToken = 0;
  private layer: Phaser.GameObjects.GameObject[] = [];
  private chosen: 'now' | 'later' = 'now';
  private coinText!: Phaser.GameObjects.Text;

  constructor() {
    super('Logbook');
  }

  preload() {
    preloadWordPictures(this, PICTURE_IDS);
  }

  create() {
    this.rng = mulberry32(Date.now() & 0xffffffff);
    this.layer = [];
    this.drawBook();
    this.add.image(1180, 640, 'char-rumb').setDisplaySize(140, 140);
    button(this, 1190, 40, 'Домой', () => this.leave(), { w: 160, h: 64, color: 0x6c757d });
    this.add.image(60, 40, 'coin').setDisplaySize(48, 48);
    this.coinText = this.add.text(92, 40, String(coins()), { fontFamily: FONT, fontSize: '34px', color: '#ffd166', stroke: '#3d2b1f', strokeThickness: 6 }).setOrigin(0, 0.5);
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

  private drawBook() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x1b4965);
    const g = this.add.graphics();
    g.fillStyle(0x5c3317).fillRoundedRect(70, 70, 1040, 600, 26);
    g.fillStyle(0xfff3d6).fillRoundedRect(96, 90, 486, 560, 14).fillRoundedRect(598, 90, 486, 560, 14);
    g.lineStyle(4, 0x3d2b1f).strokeRoundedRect(70, 70, 1040, 600, 26);
    g.lineStyle(2, 0xe9c46a, 0.6);
    for (let y = 140; y < 640; y += 40) g.lineBetween(116, y, 562, y).lineBetween(618, y, 1064, y);
    g.lineStyle(6, 0x3d2b1f, 0.4).lineBetween(590, 90, 590, 650);
    this.add.text(339, 112, 'Судовой журнал', { fontFamily: FONT, fontSize: '36px', color: '#7a4a24', fontStyle: 'bold' }).setOrigin(0.5);
  }

  private clear() {
    this.layer.forEach((o) => o.destroy());
    this.layer = [];
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

  private ask(options: { label: string; value: string; color: number; x: number; y: number; w?: number }[]): Promise<string> {
    return new Promise((resolve) => {
      const btns = options.map((o) =>
        button(this, o.x, o.y, o.label, () => {
          btns.forEach((b) => b.destroy());
                resolve(o.value);
        }, { w: o.w ?? 300, h: 90, color: o.color }),
      );
      this.layer.push(...btns);
    });
  }

  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }

  private async play() {
    const log = readWordLog();
    const known = PICTURE_IDS.filter((id) => log[id]);
    // An empty log: start with the simplest words, shown first and recalled later.
    const words = planWords(PICTURE_IDS, CARDS, known.length < 4 ? 4 : 2, this.rng, Date.now(), log);
    this.run = startRun(GAME, { cards: words.length, met: known.length });
    if (!(await this.talk(phrase('rumb.logbook.hello')))) return;

    // Small reward now or a bigger one later.
    this.layer.push(this.add.image(339, 300, 'coin').setDisplaySize(110, 110), this.add.image(841, 300, 'crate').setDisplaySize(150, 150));
    this.layer.push(this.add.text(841, 390, '× 3', { fontFamily: FONT, fontSize: '40px', color: '#7a4a24' }).setOrigin(0.5));
    void this.talk(phrase('rumb.logbook.choice'));
    this.chosen = (await this.ask([
      { label: 'Монету сейчас', value: 'now', color: 0xe9a23b, x: 339, y: 480, w: 380 },
      { label: 'Подожду сундук', value: 'later', color: 0x2a9d8f, x: 841, y: 480, w: 380 },
    ])) as 'now' | 'later';
    this.run.event('delay_choice', { choice: this.chosen });
    this.clear();
    if (this.chosen === 'now') {
      this.coinText.setText(String(addCoins(1)));
      if (!(await this.talk(phrase('rumb.logbook.coin')))) return;
    }
    if (!(await this.talk(phrase('rumb.logbook.how')))) return;

    // New words are shown first and asked again at the end, after a gap.
    const fresh = words.filter((id) => !log[id]);
    const order = [...words.filter((id) => log[id]), ...fresh];
    for (const id of fresh) if (!(await this.study(id))) return;
    let right = 0;
    for (let i = 0; i < order.length; i++) {
      const r = await this.recall(order[i]!, i);
      if (r === undefined) return;
      if (r) right++;
    }
    await this.finish(order.length, right);
  }

  private card(id: string, showWord: boolean) {
    this.clear();
    const img = this.add.image(339, 360, `snake-${id}`).setDisplaySize(300, 300);
    this.layer.push(img);
    this.tweens.add({ targets: img, scale: { from: img.scale * 0.8, to: img.scale }, duration: 280, ease: 'Back.easeOut' });
    if (showWord) this.showWord(id);
  }

  private showWord(id: string) {
    const word = ENGLISH[id] ?? id;
    const t = this.add.text(841, 250, word, { fontFamily: FONT, fontSize: word.length > 9 ? '56px' : '76px', color: '#1b4965', fontStyle: 'bold' }).setOrigin(0.5);
    this.layer.push(t);
    this.tweens.add({ targets: t, scale: { from: 0.5, to: 1 }, duration: 260, ease: 'Back.easeOut' });
  }

  private async study(id: string): Promise<boolean> {
    this.card(id, true);
    if (!(await this.talk(phrase('rumb.logbook.new'), english(id)))) return false;
    await this.wait(1800);
    voice.say(english(id));
    await this.wait(1600);
    this.run?.event('study', { item: id });
    return this.sys.isActive();
  }

  /** Picture → think and say aloud → hear the word → honest "same?". */
  private async recall(id: string, i: number): Promise<boolean | undefined> {
    this.card(id, false);
    if (!(await this.talk(phrase(`rumb.logbook.next.${i % 3}` as PhraseId)))) return undefined;
    // A ship's wheel that turns while the child thinks.
    const wheel = this.add.graphics({ x: 841, y: 250 });
    wheel.lineStyle(10, 0x7a4a24).strokeCircle(0, 0, 60);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      wheel.lineBetween(0, 0, Math.cos(a) * 80, Math.sin(a) * 80);
    }
    wheel.fillStyle(0xffd166).fillCircle(0, 0, 18);
    this.layer.push(wheel);
    this.tweens.add({ targets: wheel, angle: 360, duration: THINK_SEC * 1000 });
    const t0 = Date.now();
    await this.wait(THINK_SEC * 1000);
    if (!this.sys.isActive()) return undefined;
    wheel.destroy();
    this.showWord(id);
    if (!(await this.talk(english(id), phrase('rumb.logbook.check')))) return undefined;
    const said = await this.ask([
      { label: 'Сказал так же!', value: 'yes', color: 0x2a9d8f, x: 841, y: 420, w: 400 },
      { label: 'Не вспомнил', value: 'no', color: 0x8d99ae, x: 841, y: 540, w: 400 },
    ]);
    const ok = said === 'yes';
    recordWord(id, ok, GAME);
    this.run?.answer({ item: id, correct: ok, ms: Date.now() - t0, skill: 'recall' });
    const line = ok ? phrase(`rumb.logbook.yes.${Math.floor(this.rng() * 3)}` as PhraseId) : phrase('rumb.logbook.no');
    if (!(await this.talk(line))) return undefined;
    return ok;
  }

  private async finish(total: number, right: number) {
    this.clear();
    if (this.chosen === 'later') {
      const chest = this.add.image(339, 330, 'crate').setDisplaySize(200, 200);
      this.layer.push(chest);
      this.tweens.add({ targets: chest, angle: { from: -6, to: 6 }, yoyo: true, repeat: 3, duration: 120 });
      this.coinText.setText(String(addCoins(3)));
      for (let k = 0; k < 3; k++) {
        const c = this.add.image(339, 330, 'coin').setDisplaySize(70, 70);
        this.layer.push(c);
        this.tweens.add({ targets: c, x: 60, y: 40, delay: 400 + k * 250, duration: 700, ease: 'Cubic.easeIn', onComplete: () => c.destroy() });
      }
      if (!(await this.talk(phrase('rumb.logbook.chest')))) return;
    }
    this.run?.end({ completed: true, score: right, total, choice: this.chosen });
    this.run = undefined;
    this.clear();
    this.drawAlbum();
    void this.talk(phrase('rumb.logbook.end'));
  }

  /** Every word met so far as a sticker; the frame shows how well it is known. */
  private drawAlbum() {
    const log = readWordLog();
    const ids = PICTURE_IDS.filter((id) => log[id]).sort((a, b) => log[b]!.box - log[a]!.box);
    const learnt = ids.filter((id) => log[id]!.box >= LEARNT_BOX).length;
    this.layer.push(
      this.add.text(339, 190, `Слов в журнале: ${ids.length}`, { fontFamily: FONT, fontSize: '36px', color: '#3d2b1f' }).setOrigin(0.5),
      this.add.text(339, 250, `Выучено: ${learnt}`, { fontFamily: FONT, fontSize: '36px', color: '#2a9d8f' }).setOrigin(0.5),
      this.add.text(339, 320, 'Рамка ярче — слово крепче', { fontFamily: FONT, fontSize: '24px', color: '#7a4a24' }).setOrigin(0.5),
    );
    ids.slice(0, 30).forEach((id, i) => {
      const x = 650 + (i % 6) * 72;
      const y = 150 + Math.floor(i / 6) * 84;
      const box = log[id]!.box;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xced4da), Phaser.Display.Color.ValueToColor(0xffb703), MAX_BOX, box,
      );
      const frame = this.add.rectangle(x, y, 64, 64, 0xffffff).setStrokeStyle(5, Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      const img = this.add.image(x, y, `snake-${id}`).setDisplaySize(54, 54).setInteractive({ useHandCursor: true });
      img.on('pointerup', () => voice.say(english(id)));
      this.layer.push(frame, img);
    });
    this.layer.push(
      button(this, 220, 590, 'Ещё раз', () => this.scene.restart(), { w: 220, h: 80, color: 0x2a9d8f }),
      button(this, 460, 590, 'Домой', () => goHome(this), { w: 220, h: 80, color: 0x6c757d }),
    );
  }
}
