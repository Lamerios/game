"""Listens to the English clips with speech recognition and reports what it hears.

  python tools/check_en.py <audio dir> content/phrases.json [label]

Flags a clip when the words heard differ from the text, above all an extra
"a / an / the" in front. Uses faster-whisper (base.en). Never fails the build:
recognition can be wrong too, so this is a report to read.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
                "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
TENS = {"thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90, "one hundred": 100}


def norm(s: str) -> str:
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower().replace("-", " "))
    return re.sub(r"\s+", " ", s).strip()


def variants(text: str) -> set[str]:
    t = norm(text)
    out = {t, t.replace(" ", "")}
    if t in NUMBER_WORDS:
        out.add(str(NUMBER_WORDS.index(t)))
    if t in TENS:
        out.add(str(TENS[t]))
    if t == "one hundred":
        out |= {"a hundred", "hundred"}
    return out


def load(f: Path) -> np.ndarray:
    """16 kHz mono float32 via ffmpeg (faster-whisper's own decoder depends on a PyAV version)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def main() -> None:
    audio, phrases = Path(sys.argv[1]), json.load(open(sys.argv[2], encoding="utf-8"))
    label = sys.argv[3] if len(sys.argv) > 3 else ""
    words: dict[str, str] = phrases["english"]["words"]
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    bad, article = [], []
    for wid, text in sorted(words.items()):
        f = audio / f"en.{wid}.mp3"
        if not f.exists():
            continue
        segs, _ = model.transcribe(load(f), language="en", beam_size=5, temperature=0, condition_on_previous_text=False, vad_filter=False)
        heard = norm(" ".join(s.text for s in segs))
        if heard in variants(text):
            continue
        bad.append((wid, text, heard))
        first = heard.split(" ")[0] if heard else ""
        if first in ("a", "an", "the", "uh", "ah") and heard.split(" ", 1)[-1] in variants(text):
            article.append(wid)
    print(f"== {label}: {len(words)} words, {len(bad)} heard differently, {len(article)} with an extra article/vowel in front")
    for wid, text, heard in bad:
        mark = "ARTICLE" if wid in article else "diff"
        print(f"  {mark:7} en.{wid}: want {text!r}, heard {heard!r}")


if __name__ == "__main__":
    main()
