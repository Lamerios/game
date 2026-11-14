"""English clips for the Snake game with Kokoro (open neural TTS, Apache-2.0).

Called by tools/tts.ts with a JSON job file:
  {"voice": "af_heart", "speed": 0.85, "clips": [{"text": "apple", "out": ".../en.apple.mp3"}, ...]}

Needs Python 3.10–3.12, `pip install kokoro soundfile`, espeak-ng and ffmpeg.
The model and voices are downloaded from Hugging Face (hexgrad/Kokoro-82M) on first run.
"""
import json
import subprocess
import sys

import numpy as np
from kokoro import KPipeline


def spoken(text: str) -> str:
    # A capital and a full stop give a single word a natural, finished intonation.
    end = "" if text[-1:] in ".!?" else "."
    return text[:1].upper() + text[1:] + end


# Said on its own, a short word often comes out with an extra vowel in front
# ("uh-apple", heard as "an apple" / "a seven"): the model needs a moment to get
# going. So the text is said twice, "Apple. Apple.", and only the second, clean
# copy is kept, cut at its first token's start time.
LEAD_IN = 0.03  # seconds kept before the second copy starts
FADE = 0.012
# The very end of a longer utterance trails off in a breathy hiss, heard as an
# extra "s" ("bananas"). So the clip also ends shortly after the last word's
# end time, with a soft fade-out.
TAIL = 0.07
FADE_OUT = 0.05
# That hiss sits inside the last word's timing, so it is also trimmed by
# signal: frames at the end that are mostly above 4 kHz. Words that really
# end in a hissing sound or a released p/t/k (socks, fish, cat) are left alone.
FRICATIVES = set("szʃʒfvθðʧʤhptk")


def trim_hiss(pcm: np.ndarray, last_phoneme: str, sr: int = 24000) -> np.ndarray:
    if not last_phoneme or last_phoneme in FRICATIVES:
        return pcm
    fr = int(0.01 * sr)
    end = len(pcm)
    while end - fr > len(pcm) // 2:
        seg = pcm[end - fr:end]
        rms = float(np.sqrt((seg ** 2).mean()))
        sp = np.abs(np.fft.rfft(seg))
        hf = sp[np.fft.rfftfreq(fr, 1 / sr) > 4000].sum() / (sp.sum() + 1e-9)
        if rms < 1e-4 or hf > 0.6:
            end -= fr
        else:
            break
    return pcm[:end]


def render(pipe: KPipeline, text: str, voice: str, speed: float) -> np.ndarray:
    line = spoken(text)
    results = [r for r in pipe(f"{line} {line}", voice=voice, speed=speed) if r.audio is not None]
    if not results:
        raise SystemExit(f"no audio for {text!r}")
    if len(results) == 1 and results[0].tokens:
        r = results[0]
        tokens = r.tokens
        half = len(tokens) // 2
        start = tokens[half].start_ts if half < len(tokens) else None
        if start is not None:
            pcm = r.audio.numpy().astype(np.float32)
            i = max(0, int((start - LEAD_IN) * 24000))
            words = [t for t in tokens[half:] if any(c.isalnum() for c in t.text) and t.end_ts is not None]
            j = len(pcm)
            if words:
                j = min(len(pcm), int((words[-1].end_ts + TAIL) * 24000))
            last = ""
            if words and words[-1].phonemes:
                last = [c for c in words[-1].phonemes if c.isalpha() or c in FRICATIVES][-1:]
                last = last[0] if last else ""
            out = trim_hiss(pcm[i:j], last).copy()
            n = min(len(out), int(FADE * 24000))
            out[:n] *= np.linspace(0.0, 1.0, n, dtype=np.float32)
            m = min(len(out), int(FADE_OUT * 24000))
            out[len(out) - m:] *= np.linspace(1.0, 0.0, m, dtype=np.float32)
            return out
    # No timestamps: fall back to saying it once.
    print(f"  warning: no timestamps for {text!r}, said once", flush=True)
    single = [r.audio.numpy() for r in pipe(line, voice=voice, speed=speed) if r.audio is not None]
    return np.concatenate(single).astype(np.float32)


def main() -> None:
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    voice = job["voice"]
    speed = float(job.get("speed", 1.0))
    pipe = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
    for i, clip in enumerate(job["clips"], 1):
        pcm = render(pipe, clip["text"], voice, speed)
        # 24 kHz mono float → mp3, with leading and trailing silence trimmed and a little air added.
        trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=60,apad=pad_dur=0.12"
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-f", "f32le", "-ar", "24000", "-ac", "1", "-i", "-",
             "-af", trim, "-ac", "1", "-b:a", "64k", clip["out"]],
            input=pcm.tobytes(), check=True,
        )
        print(f"  kokoro {i}/{len(job['clips'])}: {clip['text']}", flush=True)


if __name__ == "__main__":
    main()
