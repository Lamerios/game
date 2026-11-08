/// <reference types="node" />
/**
 * Generates voice-over mp3 via Yandex SpeechKit (SDD 6).
 *
 *   YANDEX_SPEECHKIT_API_KEY=… npm run tts            # generate new / changed clips
 *   npm run tts -- --dry-run                          # what would be generated, no key needed
 *   YANDEX_SPEECHKIT_API_KEY=… npm run tts -- --samples alena,filipp,ermil,jane
 *                                                     # one sample per voice → audio-samples/
 *
 * Clips come from content/phrases.json (+ every note text and puzzle word). Each clip is
 * public/audio/<id>.mp3; public/audio/manifest.json keeps a hash of its text and
 * voice settings, so unchanged clips are never re-synthesised (and never re-billed).
 *
 * Story lines ("rumb.…", "blot.…") use their speaker's voice from content/phrases.json
 * "speakers"; everything else uses the default below.
 *
 * English words ("en.…", Snake game) are not SpeechKit: its only English voice
 * sounded wrong. They come from Kokoro, an open neural TTS (Apache-2.0), run by
 * tools/kokoro_tts.py (Python 3.10–3.12: `pip install kokoro soundfile`, plus
 * espeak-ng and ffmpeg). KOKORO_PYTHON picks the interpreter (default python3).
 * `--needs` prints how many clips each engine has to make, for the workflow.
 * Voice settings: TTS_VOICE (default alena), TTS_EMOTION (default good, '' for none),
 * TTS_SPEED (default 0.9). The key is read from the environment only and never printed.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allClips, ENGLISH_VOICE, SPEAKERS, speakerOf } from '../src/core/phrases';
import { allNoteTexts } from '../src/games/note/generator';
import { allPuzzleTexts } from '../src/games/puzzle/generator';
import { SECRET_WORD } from '../src/story/script';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'audio');
const MANIFEST = join(OUT, 'manifest.json');
const ENDPOINT = 'https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize';
const CONCURRENCY = 4;

interface VoiceSettings {
  voice: string;
  emotion: string;
  speed: string;
  /** SpeechKit language; ru-RU when absent. */
  lang?: string;
}

interface Manifest {
  voice: VoiceSettings;
  clips: Record<string, string>;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const samplesArg = args.indexOf('--samples');
const needsOnly = args.includes('--needs');

const settings: VoiceSettings = {
  voice: process.env.TTS_VOICE || 'alena',
  emotion: process.env.TTS_EMOTION ?? 'good',
  speed: process.env.TTS_SPEED || '0.9',
};

// The language joins the hash only when it is not Russian, so existing clips keep their hashes.
const hashOf = (text: string, s: VoiceSettings) =>
  createHash('sha1')
    .update(JSON.stringify(s.lang && s.lang !== 'ru-RU' ? [text, s.voice, s.emotion, s.speed, s.lang] : [text, s.voice, s.emotion, s.speed]))
    .digest('hex')
    .slice(0, 12);

function apiKey(): string {
  const key = process.env.YANDEX_SPEECHKIT_API_KEY;
  if (!key) {
    console.error('YANDEX_SPEECHKIT_API_KEY is not set.');
    process.exit(1);
  }
  return key;
}

async function synthesize(text: string, s: VoiceSettings, key: string): Promise<Buffer> {
  const body = new URLSearchParams({ text, lang: s.lang || 'ru-RU', voice: s.voice, speed: s.speed, format: 'mp3' });
  if (s.emotion) body.set('emotion', s.emotion);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Api-Key ${key}` }, body });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const retry = res.status === 429 || res.status >= 500;
    const detail = (await res.text()).slice(0, 300);
    if (!retry || attempt >= 5) throw new Error(`SpeechKit ${res.status} for "${text}": ${detail}`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]!);
  }));
}

async function samples(voices: string[]) {
  const key = apiKey();
  const dir = join(ROOT, 'audio-samples');
  mkdirSync(dir, { recursive: true });
  const text = 'Ах+ой, +юнга! Проч+итай зап+иску из бут+ылки. Загруз+и в трюм р+овно с+емь. Ты нашёл сп+особ!';
  for (const v of voices) {
    const file = join(dir, `${v}.mp3`);
    writeFileSync(file, await synthesize(text, { ...settings, voice: v }, key));
    console.log(`sample: ${file}`);
  }
}

async function main() {
  if (samplesArg >= 0) return samples((args[samplesArg + 1] ?? 'alena,filipp,ermil,jane').split(','));

  const clips = allClips([...allNoteTexts(), ...allPuzzleTexts(), SECRET_WORD]);
  const old: Manifest = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
    : { voice: settings, clips: {} };
  const next: Record<string, string> = {};
  const todo: [string, string][] = [];
  const settingsFor = (id: string): VoiceSettings => {
    if (id.startsWith('en.')) return { ...ENGLISH_VOICE, voice: `${ENGLISH_VOICE.engine}:${ENGLISH_VOICE.voice}` };
    const sp = speakerOf(id);
    if (!sp) return settings;
    const { voice, emotion, speed } = SPEAKERS[sp]!;
    return { voice, emotion, speed };
  };
  for (const [id, text] of clips) {
    const h = hashOf(text, settingsFor(id));
    next[id] = h;
    if (old.clips[id] !== h || !existsSync(join(OUT, `${id}.mp3`))) todo.push([id, text]);
  }
  const isEn = ([id]: [string, string]) => id.startsWith('en.');
  const enTodo = todo.filter(isEn);
  const skTodo = todo.filter((t) => !isEn(t));
  if (needsOnly) {
    console.log(`speechkit=${skTodo.length}\nkokoro=${enTodo.length}`);
    return;
  }
  const chars = skTodo.reduce((s, [, t]) => s + t.length, 0);
  console.log(`${clips.size} clips, ${skTodo.length} for SpeechKit (${chars} chars, voice ${settings.voice}), ${enTodo.length} for Kokoro.`);
  if (dryRun) {
    todo.slice(0, 20).forEach(([id, t]) => console.log(`  ${id}: ${t}`));
    if (todo.length > 20) console.log(`  … and ${todo.length - 20} more`);
    return;
  }

  mkdirSync(OUT, { recursive: true });
  const key = skTodo.length ? apiKey() : '';
  // Keep the manifest in step with what is on disk, so an interrupted run resumes.
  const done: Record<string, string> = Object.fromEntries(
    Object.entries(old.clips).filter(([id]) => next[id] !== undefined && existsSync(join(OUT, `${id}.mp3`))),
  );
  const save = () => {
    const sorted = Object.fromEntries(Object.keys(done).sort().map((id) => [id, done[id]!]));
    writeFileSync(MANIFEST, `${JSON.stringify({ voice: settings, clips: sorted }, null, 1)}\n`);
  };
  let n = 0;
  if (enTodo.length) {
    const jobs = join(tmpdir(), `kokoro-${process.pid}.json`);
    const { voice, speed } = ENGLISH_VOICE;
    writeFileSync(jobs, JSON.stringify({ voice, speed: Number(speed), clips: enTodo.map(([id, text]) => ({ text, out: join(OUT, `${id}.mp3`) })) }));
    const py = process.env.KOKORO_PYTHON || 'python3';
    const r = spawnSync(py, [join(ROOT, 'tools', 'kokoro_tts.py'), jobs], { stdio: 'inherit' });
    unlinkSync(jobs);
    if (r.status !== 0) throw new Error(`Kokoro failed (${py} tools/kokoro_tts.py, exit ${r.status ?? r.error?.message}).`);
    for (const [id] of enTodo) done[id] = next[id]!;
    save();
  }
  await pool(skTodo, CONCURRENCY, async ([id, text]) => {
    writeFileSync(join(OUT, `${id}.mp3`), await synthesize(text, settingsFor(id), key));
    done[id] = next[id]!;
    if (++n % 25 === 0) {
      save();
      console.log(`  ${n}/${skTodo.length}`);
    }
  });
  save();

  // Drop clips no phrase uses any more.
  for (const f of readdirSync(OUT)) {
    if (f.endsWith('.mp3') && next[f.slice(0, -4)] === undefined) {
      unlinkSync(join(OUT, f));
      console.log(`removed ${f}`);
    }
  }
  console.log('done.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
