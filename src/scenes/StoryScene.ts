import Phaser from 'phaser';
import { voice } from '../core/audio';
import { phrase, unstress, type PhraseId } from '../core/phrases';
import { CHARACTER_NAME, type CharacterId } from '../art/characters';
import { FONT, H, W } from './ui';

export interface StoryData {
  lines: PhraseId[];
  /** Scene to start after the last line. */
  next: string;
  nextData?: object;
  bg?: string;
  /** Strelka's look (parts rebuilt) for her lines. */
  strelka?: number;
}

/** Texture key of a speaker's portrait. */
export function portraitKey(speaker: string, strelka = 0): string | undefined {
  if (speaker === 'strelka') return `strelka-${strelka}`;
  if (speaker === 'beard') return undefined;
  return `char-${speaker}`;
}

/**
 * A voiced cut-scene: one character at a time with a big portrait and a speech
 * bubble; a tap shows the next line. The captain's letters are shown as paper
 * the child reads themself, with "Прочитай мне" for help.
 */
export class StoryScene extends Phaser.Scene {
  private story!: StoryData;
  private idx = 0;
  private layer?: Phaser.GameObjects.Container;
  private ready = false;

  constructor() {
    super('Story');
  }

  init(data: StoryData) {
    this.story = data;
    this.idx = 0;
    this.layer = undefined;
  }

  create() {
    this.add.image(W / 2, H / 2, this.story.bg ?? 'bg-beach').setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.15);
    const skip = this.add
      .text(W - 30, 30, 'Дальше ▶', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', backgroundColor: '#0b2233', padding: { x: 14, y: 8 } })
      .setOrigin(1, 0)
      .setDepth(5);
    this.tweens.add({ targets: skip, alpha: 0.6, yoyo: true, repeat: -1, duration: 700 });
    this.input.on('pointerup', () => {
      if (this.ready) this.advance();
    });
    this.show();
  }

  private advance() {
    this.idx++;
    if (this.idx >= this.story.lines.length) {
      voice.stop();
      this.scene.start(this.story.next, this.story.nextData);
      return;
    }
    this.show();
  }

  private show() {
    const id = this.story.lines[this.idx]!;
    const u = phrase(id);
    const speaker = u.speaker ?? 'rumb';
    this.layer?.destroy();
    this.ready = false;
    // Short guard so a double tap does not skip a line unheard.
    this.time.delayedCall(600, () => (this.ready = true));

    if (speaker === 'beard') {
      this.layer = this.letter(unstress(u.show));
      return;
    }
    voice.say(u);
    const items: Phaser.GameObjects.GameObject[] = [];
    const key = portraitKey(speaker, this.story.strelka);
    const left = this.idx % 2 === 0;
    const px = left ? 230 : W - 230;
    if (key) {
      const img = this.add.image(px, H - 220, key).setDisplaySize(380, 380);
      items.push(img);
      this.tweens.add({ targets: img, y: H - 232, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
      if (speaker === 'kettle') this.steam(px + 10, H - 400, items);
    }
    const bx = left ? 460 : 80;
    const text = this.add.text(bx + 30, 120, u.show, {
      fontFamily: FONT,
      fontSize: '38px',
      color: '#0b2233',
      wordWrap: { width: 680 },
      lineSpacing: 6,
    });
    const name = this.add.text(bx + 30, 70, CHARACTER_NAME[speaker as CharacterId] ?? '', {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#e76f51',
      padding: { x: 12, y: 4 },
    });
    const bg = this.add
      .rectangle(bx, 100, 740, Math.max(200, text.height + 60), 0xffffff)
      .setOrigin(0)
      .setStrokeStyle(6, 0x2b2d42);
    // Tail towards the speaker.
    const tail = this.add.triangle(left ? bx + 10 : bx + 730, 200, 0, 0, 0, 50, left ? -60 : 60, 60, 0xffffff).setStrokeStyle(0);
    items.unshift(bg, tail);
    items.push(text, name);
    this.layer = this.add.container(0, 0, items);
    this.layer.setAlpha(0);
    this.tweens.add({ targets: this.layer, alpha: 1, duration: 200 });
  }

  private steam(x: number, y: number, items: Phaser.GameObjects.GameObject[]) {
    for (let i = 0; i < 3; i++) {
      const puff = this.add.circle(x - 120 + i * 14, y + 130, 14, 0xffffff, 0.8);
      items.push(puff);
      this.tweens.add({ targets: puff, y: y + 40, alpha: 0, scale: 2, duration: 1600, delay: i * 400, repeat: -1 });
    }
  }

  /** The captain's letter: the child reads it; the voice only on request. */
  private letter(text: string) {
    const shown = text;
    const paper = this.add.rectangle(W / 2, H / 2 - 20, 900, 460, 0xfff1d0).setStrokeStyle(8, 0x8d5524);
    const t = this.add
      .text(W / 2, H / 2 - 40, shown.toUpperCase(), {
        fontFamily: FONT,
        fontSize: '44px',
        color: '#3d2b1f',
        align: 'center',
        wordWrap: { width: 800 },
        lineSpacing: 10,
      })
      .setOrigin(0.5);
    const help = this.add
      .text(W / 2, H / 2 + 250, 'Прочитай мне', { fontFamily: FONT, fontSize: '32px', color: '#0b2233', backgroundColor: '#ffffff', padding: { x: 14, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    help.on('pointerup', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      voice.say(phrase(this.story.lines[this.idx]!));
    });
    return this.add.container(0, 0, [paper, t, help]);
  }
}
