from __future__ import annotations

import argparse
import math
import os
import subprocess
import tempfile
import wave
from pathlib import Path

from lib.audio.ffmpeg import BackgroundMix, MixConfig, SoundEffectOverlay, apply_mix, concat_audio
from lib.config import FfmpegConfig


def _write_sine_wav(path: Path, *, hz: float, seconds: float, sample_rate: int = 16_000) -> None:
    frame_count = int(sample_rate * seconds)
    amplitude = 0.2
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        for n in range(frame_count):
            value = amplitude * math.sin(2 * math.pi * hz * (n / sample_rate))
            i16 = max(-1.0, min(1.0, value))
            wf.writeframesraw(int(i16 * 32767).to_bytes(2, byteorder="little", signed=True))


def _check_ffmpeg(ffmpeg_bin: str) -> None:
    try:
        subprocess.run(
            [ffmpeg_bin, "-version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
    except FileNotFoundError as exc:
        raise SystemExit(
            f"ffmpeg not found: {ffmpeg_bin}\n"
            "Install ffmpeg and/or set FFMPEG_BIN, e.g. `FFMPEG_BIN=/opt/homebrew/bin/ffmpeg`."
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"ffmpeg failed to run: {exc}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test: ffmpeg concat + mixing pipeline.")
    parser.add_argument("--ffmpeg", default=os.environ.get("FFMPEG_BIN", "ffmpeg"))
    args = parser.parse_args()

    _check_ffmpeg(args.ffmpeg)
    cfg = FfmpegConfig(ffmpeg_bin=args.ffmpeg)

    with tempfile.TemporaryDirectory(prefix="esf_smoke_") as tmpdir:
        tmp = Path(tmpdir)
        a = tmp / "a.wav"
        b = tmp / "b.wav"
        bg = tmp / "bg.wav"
        sfx = tmp / "sfx.wav"

        _write_sine_wav(a, hz=440, seconds=0.4)
        _write_sine_wav(b, hz=660, seconds=0.4)
        _write_sine_wav(bg, hz=110, seconds=0.8)
        _write_sine_wav(sfx, hz=880, seconds=0.15)

        concatenated = tmp / "concatenated.wav"
        concat_audio(cfg, [a, b], concatenated)

        mixed = tmp / "mixed.wav"
        apply_mix(
            cfg,
            concatenated,
            MixConfig(
                background=BackgroundMix(path=bg, volume=0.15),
                sound_effects=[
                    SoundEffectOverlay(path=sfx, start_time_ms=200, volume=0.8, label="beep")
                ],
            ),
            mixed,
        )

        print("OK")
        print(f"- concatenated: {concatenated}")
        print(f"- mixed:        {mixed}")


if __name__ == "__main__":
    main()
