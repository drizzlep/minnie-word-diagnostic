#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "assets" / "audio"


def audio_words():
    result = subprocess.run(
        ["node", "--input-type=module", "-e", "import {allAudioWords} from './src/data.js'; console.log(JSON.stringify(allAudioWords()))"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def generate_audio(words):
    AUDIO.mkdir(parents=True, exist_ok=True)
    for word in words:
        target = AUDIO / f"{word}.mp3"
        if target.exists():
            continue
        aiff = AUDIO / f".{word}.aiff"
        subprocess.run(["say", "-v", "Daniel", "-r", "145", "-o", aiff, word], check=True)
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", aiff, "-codec:a", "libmp3lame", "-q:a", "5", target],
            check=True,
        )
        aiff.unlink(missing_ok=True)
    (AUDIO / "index.json").write_text(
        json.dumps([f"{word}.mp3" for word in words], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def generate_icon(size):
    image = Image.new("RGB", (size, size), "#173f5f")
    draw = ImageDraw.Draw(image)
    margin = int(size * 0.12)
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=int(size * 0.2),
        fill="#ffd166",
    )
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf", int(size * 0.52))
    except OSError:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "M", font=font)
    x = (size - (bbox[2] - bbox[0])) / 2
    y = (size - (bbox[3] - bbox[1])) / 2 - bbox[1]
    draw.text((x, y), "M", font=font, fill="#173f5f")
    image.save(ROOT / "assets" / f"icon-{size}.png", optimize=True)


if __name__ == "__main__":
    words = audio_words()
    generate_audio(words)
    generate_icon(192)
    generate_icon(512)
    print(f"Generated {len(words)} British English audio files and PWA icons.")
