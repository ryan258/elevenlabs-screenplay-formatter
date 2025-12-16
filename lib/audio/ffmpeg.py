from __future__ import annotations

import json
import subprocess
import tempfile
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path
from typing import List, Optional

from lib.config import FfmpegConfig


@dataclass(frozen=True)
class BackgroundMix:
    path: Path
    volume: float


@dataclass(frozen=True)
class SoundEffectOverlay:
    path: Path
    start_time_ms: int
    volume: float
    label: str = ""


@dataclass(frozen=True)
class MixConfig:
    background: Optional[BackgroundMix] = None
    sound_effects: List[SoundEffectOverlay] = field(default_factory=list)


def _safe_child_path(parent: Path, name: str) -> Path:
    if not name or "/" in name or "\\" in name or "\x00" in name:
        raise ValueError("Invalid file reference")
    if name in {".", ".."} or ".." in name:
        raise ValueError("Invalid file reference")
    candidate = (parent / name).resolve()
    parent_resolved = parent.resolve()
    try:
        candidate.relative_to(parent_resolved)
    except ValueError as exc:
        raise ValueError("Invalid file reference") from exc
    return candidate


def _run(args: List[str]) -> None:
    subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def _escape_ffmpeg_concat_filelist_path(path: Path) -> str:
    """
    Escape a path for use in an ffmpeg concat demuxer filelist line:
      file '<path>'

    ffmpeg treats backslash escapes inside quoted strings.
    """
    value = str(path.resolve())
    if any(ch in value for ch in ("\n", "\r", "\x00")):
        raise ValueError("Invalid path for ffmpeg concat filelist")
    return value.replace("\\", "\\\\").replace("'", "\\'")


def concat_audio(config: FfmpegConfig, files: List[Path], output_path: Path) -> None:
    if not files:
        raise ValueError("No files provided")
    if len(files) == 1:
        output_path.write_bytes(files[0].read_bytes())
        return

    with tempfile.TemporaryDirectory(prefix="esf_concat_") as tmpdir:
        filelist = Path(tmpdir) / "filelist.txt"
        lines = [f"file '{_escape_ffmpeg_concat_filelist_path(p)}'" for p in files]
        filelist.write_text("\n".join(lines), encoding="utf-8")
        _run(
            [
                config.ffmpeg_bin,
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(filelist),
                "-c",
                "copy",
                str(output_path),
            ]
        )


def mix_background(
    config: FfmpegConfig, base_audio: Path, background_audio: Path, volume: float, output_path: Path
) -> None:
    safe_volume = volume if isinstance(volume, (int, float)) else 0.35
    _run(
        [
            config.ffmpeg_bin,
            "-i",
            str(base_audio),
            "-i",
            str(background_audio),
            "-filter_complex",
            f"[1:a]volume=volume={safe_volume}[bgvol];[0:a][bgvol]amix=inputs=2:dropout_transition=0[mix]",
            "-map",
            "[mix]",
            "-shortest",
            str(output_path),
        ]
    )


def overlay_sound_effect(
    config: FfmpegConfig,
    base_audio: Path,
    effect_audio: Path,
    start_ms: int,
    volume: float,
    output_path: Path,
) -> None:
    safe_volume = volume if isinstance(volume, (int, float)) else 1.0
    delay = max(0, int(start_ms))
    delay_string = f"{delay}|{delay}"
    _run(
        [
            config.ffmpeg_bin,
            "-i",
            str(base_audio),
            "-i",
            str(effect_audio),
            "-filter_complex",
            f"[1:a]adelay={delay_string}[delayed];[delayed]volume=volume={safe_volume}[sfxvol];"
            f"[0:a][sfxvol]amix=inputs=2:dropout_transition=0[mix]",
            "-map",
            "[mix]",
            "-shortest",
            str(output_path),
        ]
    )


def apply_mix(config: FfmpegConfig, base_audio: Path, mix: MixConfig, output_path: Path) -> None:
    current = base_audio
    temp_paths: List[Path] = []
    try:
        if mix.background:
            bg_out = output_path.parent / f"{output_path.stem}_bg{output_path.suffix}"
            mix_background(config, current, mix.background.path, mix.background.volume, bg_out)
            temp_paths.append(bg_out)
            current = bg_out

        for idx, effect in enumerate(mix.sound_effects or []):
            sfx_out = output_path.parent / f"{output_path.stem}_sfx_{idx}{output_path.suffix}"
            overlay_sound_effect(config, current, effect.path, effect.start_time_ms, effect.volume, sfx_out)
            temp_paths.append(sfx_out)
            current = sfx_out

        if current != output_path:
            output_path.write_bytes(current.read_bytes())
    finally:
        for p in temp_paths:
            if p.exists() and p != output_path:
                try:
                    p.unlink()
                except OSError:
                    pass


def parse_mix_config_json(payload: str, *, upload_dir: Path) -> MixConfig:
    """
    Parses a mixConfig payload of the shape produced by the current web app:
      { background?: { ref: "fieldName", volume }, soundEffects: [{ ref, startTimeMs, volume, label }] }
    The referenced files are expected to exist under upload_dir / ref.
    """
    raw = json.loads(payload)
    if not isinstance(raw, dict):
        raise TypeError("mixConfig must be a JSON object")

    background: Optional[BackgroundMix] = None
    bg = raw.get("background")
    if isinstance(bg, dict):
        ref = bg.get("ref")
        vol = bg.get("volume")
        if isinstance(ref, str) and isinstance(vol, (int, float)):
            path = _safe_child_path(upload_dir, ref)
            if path.exists() and path.is_file():
                background = BackgroundMix(path=path, volume=float(vol))

    sound_effects: List[SoundEffectOverlay] = []
    sfx_raw = raw.get("soundEffects")
    if isinstance(sfx_raw, list):
        for entry in sfx_raw:
            if not isinstance(entry, dict):
                continue
            ref = entry.get("ref")
            start = entry.get("startTimeMs")
            vol = entry.get("volume")
            label = entry.get("label") or ""
            if isinstance(ref, str) and isinstance(start, (int, float)) and isinstance(vol, (int, float)):
                path = _safe_child_path(upload_dir, ref)
                if path.exists() and path.is_file():
                    sound_effects.append(
                        SoundEffectOverlay(
                            path=path,
                            start_time_ms=int(start),
                            volume=float(vol),
                            label=str(label),
                        )
                    )

    return MixConfig(background=background, sound_effects=sound_effects)
