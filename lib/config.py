from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ElevenLabsConfig:
    api_key: str
    base_url: str
    timeout_s: float


@dataclass(frozen=True)
class FfmpegConfig:
    ffmpeg_bin: str

