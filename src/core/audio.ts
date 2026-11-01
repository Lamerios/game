import { free, phrase, PRAISE_COUNT, SPEAKERS, webText, type PhraseId, type Seg, type Utterance } from './phrases';

/** Pause between clips of one utterance, seconds. */
const GAP = 0.06;

interface Manifest {
  /** clip id → content hash, written by tools/tts.ts. */
  clips: Record<string, string>;
}

/**
 * Voice-over (SDD 6): pre-generated SpeechKit mp3 clips played in a row via
 * Web Audio. If any clip of an utterance is missing (not generated yet, offline
 * and not cached, number out of range), the whole utterance goes to the
 * browser's ru-RU voice instead, so the child always hears something.
 */
export class Voice {
  private enabled = true;
  private clips: Record<string, string> = {};
  private ctx?: AudioContext;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private playing: AudioBufferSourceNode[] = [];
  /** Bumped on every say/stop so a slow load can't talk over a newer line. */
  private token = 0;
  /** Settles when the current line has been spoken to the end, or was cut off. */
  private ended: Promise<void> = Promise.resolve();
  private endLine?: () => void;

  constructor(private readonly base = import.meta.env.BASE_URL) {}

  /** Loads the clip list. Safe to skip: without it everything is spoken by the browser. */
  async init(): Promise<void> {
    try {
      const res = await fetch(`${this.base}audio/manifest.json`, { cache: 'no-cache' });
      if (res.ok) this.clips = ((await res.json()) as Manifest).clips ?? {};
    } catch {
      this.clips = {};
    }
  }

  /** Call from a tap handler: browsers only allow sound after a user gesture. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    // iOS: play even with the silent switch on, like a video would.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
  }

  /** Whether every clip of this utterance has a generated mp3. */
  hasClips(u: Utterance): boolean {
    return this.voicedSegs(u).every((s) => s.voiced && this.clips[s.id] !== undefined);
  }

  say(u: Utterance | string): void {
    const utt = typeof u === 'string' ? free(u) : u;
    this.stop();
    if (!this.enabled) return;
    const token = this.token;
    this.ended = new Promise((resolve) => (this.endLine = resolve));
    const done = () => {
      if (token === this.token) this.endLine?.();
    };
    if (!this.ctx || !this.hasClips(utt)) {
      this.speakWeb(utt, done);
      return;
    }
    this.playClips(this.voicedSegs(utt), token, done).catch(() => {
      if (token === this.token) this.speakWeb(utt, done);
    });
  }

  /**
   * Resolves once the current line is over (spoken to the end or stopped), so a
   * scene can wait for it before moving on. Never waits longer than `maxMs`:
   * some browsers never report the end of a speechSynthesis line.
   */
  idle(maxMs = 10000): Promise<void> {
    return Promise.race([this.ended, new Promise<void>((r) => setTimeout(r, maxMs))]);
  }

  stop(): void {
    this.token++;
    for (const s of this.playing) {
      try {
        s.stop();
      } catch {
        /* already ended */
      }
    }
    this.playing = [];
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    this.endLine?.();
    this.endLine = undefined;
  }

  private voicedSegs(u: Utterance): Seg[] {
    return u.segs.filter((s) => s.say !== '' || !s.voiced);
  }

  private load(id: string): Promise<AudioBuffer> {
    const hash = this.clips[id]!;
    const key = `${id}@${hash}`;
    let p = this.buffers.get(key);
    if (!p) {
      p = fetch(`${this.base}audio/${id}.mp3?v=${hash}`)
        .then((r) => {
          if (!r.ok) throw new Error(`${id}: ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => this.ctx!.decodeAudioData(b));
      p.catch(() => this.buffers.delete(key));
      this.buffers.set(key, p);
    }
    return p;
  }

  private async playClips(segs: Seg[], token: number, done: () => void) {
    const ctx = this.ctx!;
    const bufs = await Promise.all(segs.map((s) => this.load(s.id)));
    if (token !== this.token) return;
    if (bufs.length === 0) return done();
    let t = ctx.currentTime + 0.02;
    this.playing = bufs.map((b) => {
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.start(t);
      t += b.duration + GAP;
      return src;
    });
    this.playing.at(-1)!.onended = done;
  }

  private speakWeb(u: Utterance, done: () => void) {
    if (typeof speechSynthesis === 'undefined') return done();
    speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(webText(u));
    msg.lang = 'ru-RU';
    msg.rate = 0.9;
    // Without generated clips, characters still sound different.
    const sp = u.speaker ? SPEAKERS[u.speaker] : undefined;
    if (sp) msg.pitch = sp.pitch;
    const ru = speechSynthesis.getVoices().find((v) => v.lang.startsWith('ru'));
    if (ru) msg.voice = ru;
    msg.onend = done;
    msg.onerror = done;
    speechSynthesis.speak(msg);
  }
}

export const voice = new Voice();

/** Praise the method, not the child (SDD 3.7). Rotated so phrases don't wear out. */
let praiseIdx = 0;
export function nextPraise(): Utterance {
  praiseIdx = (praiseIdx + 1) % PRAISE_COUNT;
  return phrase(`praise.${praiseIdx}` as PhraseId);
}
