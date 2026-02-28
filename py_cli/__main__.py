from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from lib.config import ElevenLabsConfig
from lib.elevenlabs.client import ElevenLabsClient, adjust_delay_based_on_rate_limit
from lib.models import VoiceSettings
from lib.parser import ParsedScript, parse_script


OUTPUT_FORMAT_DETAILS: Dict[str, Tuple[str, str]] = {
    "mp3_44100_128": ("mp3", "audio/mpeg"),
    "mp3_44100_192": ("mp3", "audio/mpeg"),
    "pcm_24000": ("wav", "audio/wav"),
}


@dataclass
class JobPlan:
    script_path: Path
    script_text: str
    parsed: ParsedScript
    config: Dict[str, Any]
    out_dir: Path
    delay_ms: int
    cooldown_ms: int


def _slugify(value: str) -> str:
    cleaned = []
    for ch in value:
        cleaned.append(ch if ch.isalnum() else "_")
    slug = "".join(cleaned).strip("_").lower()
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug or "script"


def _load_json(path: Path) -> Dict[str, Any]:
    obj = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(obj, dict):
        raise SystemExit(f"Invalid JSON object in config: {path}")
    return {str(k): v for k, v in obj.items()}


def _load_config_cached(path: Path, cache: Dict[Path, Dict[str, Any]]) -> Dict[str, Any]:
    resolved = path.resolve()
    if resolved not in cache:
        cache[resolved] = _load_json(resolved)
    return cache[resolved]


def _resolve_path(base_dir: Path, value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return (base_dir / path).resolve()


def _build_jobs_from_batch(
    *,
    batch_path: Path,
    defaults: Dict[str, Any],
    presets: Dict[str, Any],
    jobs_raw: List[Dict[str, Any]],
    fallback_config: Optional[str],
    fallback_out: str,
    fallback_delay: int,
    fallback_cooldown: int,
    config_cache: Dict[Path, Dict[str, Any]],
) -> List[JobPlan]:
    base_dir = batch_path.parent
    jobs: List[JobPlan] = []

    for raw in jobs_raw:
        if not isinstance(raw, dict):
            raise SystemExit("Each batch job must be an object.")

        script_value = raw.get("script")
        if not script_value:
            raise SystemExit("Batch job is missing required 'script' field.")
        script_path = _resolve_path(base_dir, str(script_value))

        preset_name = raw.get("preset") or defaults.get("preset")
        config_value = None
        if preset_name:
            config_value = presets.get(str(preset_name))
            if not config_value:
                raise SystemExit(f"Unknown preset in batch config: {preset_name}")
        if not config_value:
            config_value = raw.get("config") or defaults.get("config") or fallback_config
        if not config_value:
            raise SystemExit("Batch job is missing required 'config' field.")
        config_path = _resolve_path(base_dir, str(config_value))

        out_value = raw.get("out") or defaults.get("out") or fallback_out
        out_dir = _resolve_path(base_dir, str(out_value))

        delay_ms = int(raw.get("delay_ms") or defaults.get("delay_ms") or fallback_delay)
        cooldown_ms = int(
            raw.get("cooldown_ms") or defaults.get("cooldown_ms") or fallback_cooldown
        )

        script_text = script_path.read_text(encoding="utf-8")
        parsed = parse_script(script_text, preserve_stage_directions=False)
        config = _load_config_cached(config_path, config_cache)

        jobs.append(
            JobPlan(
                script_path=script_path,
                script_text=script_text,
                parsed=parsed,
                config=config,
                out_dir=out_dir,
                delay_ms=delay_ms,
                cooldown_ms=cooldown_ms,
            )
        )

    return jobs


def _build_jobs_from_args(
    *,
    script_paths: List[str],
    config_path: str,
    out_dir: str,
    delay_ms: int,
    cooldown_ms: int,
    config_cache: Dict[Path, Dict[str, Any]],
) -> List[JobPlan]:
    jobs: List[JobPlan] = []
    for script_value in script_paths:
        script_path = Path(script_value).resolve()
        script_text = script_path.read_text(encoding="utf-8")
        parsed = parse_script(script_text, preserve_stage_directions=False)
        config = _load_config_cached(Path(config_path), config_cache)
        jobs.append(
            JobPlan(
                script_path=script_path,
                script_text=script_text,
                parsed=parsed,
                config=config,
                out_dir=Path(out_dir).resolve(),
                delay_ms=delay_ms,
                cooldown_ms=cooldown_ms,
            )
        )
    return jobs


def _get_required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m py_cli", add_help=True)
    parser.add_argument("--script", action="append", help="Path to screenplay file (repeatable)")
    parser.add_argument("--config", help="Path to project config JSON (v0.4 format)")
    parser.add_argument("--batch", help="Path to batch config JSON")
    parser.add_argument("--out", default="cli_output", help="Output directory")
    parser.add_argument("--delay", type=int, default=500, help="Delay between requests (ms)")
    parser.add_argument("--cooldown", type=int, default=0, help="Cooldown between scripts (ms)")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if not args.batch and (not args.script or not args.config):
        raise SystemExit("Provide --script and --config, or use --batch.")

    base_url = _get_required_env("ELEVENLABS_BASE_URL")
    api_key = _get_required_env("ELEVENLABS_API_KEY")
    timeout_s = float(os.environ.get("ELEVENLABS_TIMEOUT_S", "30").strip() or "30")

    config_cache: Dict[Path, Dict[str, Any]] = {}
    if args.batch:
        batch_path = Path(args.batch).resolve()
        batch = _load_json(batch_path)
        defaults = batch.get("defaults") or {}
        presets = batch.get("presets") or {}
        jobs_raw = batch.get("jobs") or []
        if not isinstance(jobs_raw, list) or not jobs_raw:
            raise SystemExit("Batch config must include a non-empty 'jobs' array.")
        jobs = _build_jobs_from_batch(
            batch_path=batch_path,
            defaults=defaults,
            presets=presets,
            jobs_raw=jobs_raw,
            fallback_config=args.config,
            fallback_out=args.out,
            fallback_delay=args.delay,
            fallback_cooldown=args.cooldown,
            config_cache=config_cache,
        )
    else:
        jobs = _build_jobs_from_args(
            script_paths=args.script or [],
            config_path=args.config or "",
            out_dir=args.out,
            delay_ms=args.delay,
            cooldown_ms=args.cooldown,
            config_cache=config_cache,
        )

    if not jobs:
        raise SystemExit("No scripts to process.")

    overall_total = sum(len(job.parsed.dialogue_chunks) for job in jobs)
    overall_index = 0

    client = ElevenLabsClient(
        ElevenLabsConfig(api_key=api_key, base_url=base_url, timeout_s=timeout_s)
    )

    for job_index, job in enumerate(jobs, start=1):
        job.out_dir.mkdir(parents=True, exist_ok=True)

        project_settings = job.config.get("projectSettings") or {}
        output_format = str(project_settings.get("outputFormat") or "mp3_44100_128")
        if output_format not in OUTPUT_FORMAT_DETAILS:
            raise SystemExit(f"Unsupported output format: {output_format}")
        model_id = str(project_settings.get("model") or "")
        if not model_id:
            raise SystemExit(f"Missing model in config: {job.script_path}")
        speak_parentheticals = bool(project_settings.get("speakParentheticals") or False)

        extension, accept = OUTPUT_FORMAT_DETAILS[output_format]

        base_delay_ms = max(0, int(project_settings.get("requestDelayMs") or job.delay_ms))
        adaptive_delay_ms = base_delay_ms

        slug = _slugify(job.script_path.stem)
        total_chunks = len(job.parsed.dialogue_chunks)
        print(f"[file {job_index}/{len(jobs)}] {job.script_path.name} ({total_chunks} chunks)")

        character_configs = job.config.get("characterConfigs") or {}
        for index, chunk in enumerate(job.parsed.dialogue_chunks):
            overall_index += 1
            character_cfg = character_configs.get(chunk.character) or {}
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

            text = (
                chunk.original_text
                if (speak_parentheticals and chunk.original_text)
                else chunk.text
            )
            filename = job.out_dir / f"{slug}_{index:04d}_{_slugify(chunk.character)}.{extension}"
            print(
                f"[chunk {index + 1}/{total_chunks}] "
                f"[overall {overall_index}/{overall_total}] "
                f"{chunk.character}"
            )

            audio_bytes, remaining = client.generate_audio(
                voice_id=voice_id,
                text=text,
                model_id=model_id,
                output_format=output_format,
                voice_settings=voice_settings,
                accept=accept,
                base_delay_ms=base_delay_ms,
            )
            filename.write_bytes(audio_bytes)
            # Basic rate limit handling for sequential chunks
            adaptive_delay_ms = adjust_delay_based_on_rate_limit(
                remaining, adaptive_delay_ms, base_delay_ms
            )
            if adaptive_delay_ms > 0 and index < total_chunks - 1:
                time.sleep(adaptive_delay_ms / 1000)

        if job.cooldown_ms > 0 and job_index < len(jobs):
            time.sleep(job.cooldown_ms / 1000)


if __name__ == "__main__":
    main()
