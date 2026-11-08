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
    return text[:1].upper() + text[1:] + "."


def main() -> None:
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    voice = job["voice"]
    speed = float(job.get("speed", 1.0))
    pipe = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
    for i, clip in enumerate(job["clips"], 1):
        parts = [r.audio.numpy() for r in pipe(spoken(clip["text"]), voice=voice, speed=speed) if r.audio is not None]
        if not parts:
            raise SystemExit(f"no audio for {clip['text']!r}")
        pcm = np.concatenate(parts).astype(np.float32)
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
