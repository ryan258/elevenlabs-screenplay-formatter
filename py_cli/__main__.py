from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Dict, List, Tuple

from lib.audio.ffmpeg import concat_audio
from lib.config import ElevenLabsConfig, FfmpegConfig
from lib.elevenlabs.client import ElevenLabsClient
from lib.models import VoiceSettings
from lib.parser import parse_script


OUTPUT_FORMAT_DETAILS: Dict[str, Tuple[str, str]] = {
    "mp3_44100_128": ("mp3", "audio/mpeg"),
    "mp3_44100_192": ("mp3", "audio/mpeg"),
    "pcm_24000": ("wav", "audio/wav"),
}


def _slugify(value: str) -> str:
    cleaned = []
    for ch in value:
        cleaned.append(ch if ch.isalnum() else "_")
    slug = "".join(cleaned).strip("_").lower()
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug or "script"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _get_required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m py_cli", add_help=True)
    parser.add_argument("--script", action="append", required=True, help="Path to screenplay file")
    parser.add_argument("--config", required=True, help="Path to project config JSON (v0.4 format)")
    parser.add_argument("--out", default="cli_output", help="Output directory")
    parser.add_argument("--delay", type=int, default=500, help="Delay between requests (ms)")
    parser.add_argument("--concat", action="store_true", help="Concatenate output audio with ffmpeg")
    return parser


def main() -> None:
    args = build_parser().parse_args()

    base_url = _get_required_env("ELEVENLABS_BASE_URL")
    api_key = _get_required_env("ELEVENLABS_API_KEY")
    timeout_s = float(os.environ.get("ELEVENLABS_TIMEOUT_S", "30").strip() or "30")
    ffmpeg_bin = os.environ.get("FFMPEG_BIN", "ffmpeg").strip()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    config = _load_json(Path(args.config))
    project_settings = config.get("projectSettings") or {}
    output_format = str(project_settings.get("outputFormat") or "mp3_44100_128")
    model_id = str(project_settings.get("model") or "")
    speak_parentheticals = bool(project_settings.get("speakParentheticals") or False)

    extension, accept = OUTPUT_FORMAT_DETAILS.get(output_format, OUTPUT_FORMAT_DETAILS["mp3_44100_128"])

    client = ElevenLabsClient(
        ElevenLabsConfig(api_key=api_key, base_url=base_url, timeout_s=timeout_s)
    )
    ffmpeg = FfmpegConfig(ffmpeg_bin=ffmpeg_bin)

    for script_path in args.script:
        script_file = Path(script_path)
        script_text = script_file.read_text(encoding="utf-8")
        parsed = parse_script(script_text, preserve_stage_directions=False)
        slug = _slugify(script_file.stem)

        generated_files: List[Path] = []
        for index, chunk in enumerate(parsed.dialogue_chunks):
            character_cfg = (config.get("characterConfigs") or {}).get(chunk.character) or {}
            voice_id = str(character_cfg.get("voiceId") or "")
            voice_settings_raw = character_cfg.get("voiceSettings") or {}
            if not voice_id:
                raise SystemExit(f"Missing voice config for character: {chunk.character}")

            voice_settings = VoiceSettings(
                stability=float(voice_settings_raw.get("stability") or 0.5),
                similarity_boost=float(voice_settings_raw.get("similarity_boost") or 0.75),
                style=float(voice_settings_raw.get("style") or 0.1),
                speed=float(voice_settings_raw.get("speed") or 1.0),
            )

            text = chunk.original_text if (speak_parentheticals and chunk.original_text) else chunk.text

            filename = out_dir / (
                f"{slug}_{index:04d}_{_slugify(chunk.character)}.{extension}"
            )
            print(f"[{index + 1}/{len(parsed.dialogue_chunks)}] {chunk.character}")

            audio_bytes, _ = client.generate_audio(
                voice_id=voice_id,
                text=text,
                model_id=model_id,
                output_format=output_format,
                voice_settings=voice_settings,
                accept=accept,
                base_delay_ms=args.delay,
            )
            filename.write_bytes(audio_bytes)
            generated_files.append(filename)

        if args.concat or bool(project_settings.get("concatenate")):
            output_path = out_dir / "concatenated_audio.mp3"
            concat_audio(ffmpeg, generated_files, output_path)
            print(f"Concatenated audio saved to {output_path}")


if __name__ == "__main__":
    main()

