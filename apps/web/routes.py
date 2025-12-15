from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Optional

from flask import Response, current_app, render_template, request

from apps.web.app import app
from lib.config import FfmpegConfig
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle
from lib.generation import generate_all_audio
from lib.manifest import build_manifest_entries
from lib.models import CharacterConfig, VoiceSettings
from lib.parser import parse_script
from lib.share_links import decode_share_payload
from lib.validation import validate_character_configs


@app.get("/")
def index() -> str:
    shared_project: Optional[str] = request.args.get("project")
    script_text = ""
    if shared_project:
        try:
            decoded = decode_share_payload(shared_project)
            payload = json.loads(decoded)
            script_text = str(payload.get("scriptText") or payload.get("script_text") or "")
        except Exception:
            script_text = ""
    return render_template("index.html", script_text=script_text)


@app.post("/parse")
def parse() -> str:
    script_text = request.form.get("script_text", "")
    preserve = request.form.get("preserve_stage_directions") == "on"
    parsed = parse_script(script_text, preserve_stage_directions=preserve)
    return render_template("parsed.html", parsed=parsed, script_text=script_text, preserve=preserve)


@app.post("/generate.zip")
def generate_zip() -> Response:
    cfg = current_app.config.get("APP_CONFIG")
    if cfg is None:
        try:
            from apps.api.config import load_config_from_env

            cfg = load_config_from_env()
            current_app.config["APP_CONFIG"] = cfg
            current_app.secret_key = cfg.flask_secret_key
        except Exception:
            return Response("App config is not initialized", status=500)
    if not cfg.elevenlabs.api_key:
        return Response("Missing ELEVENLABS_API_KEY", status=400)

    script_text = request.form.get("script_text", "")
    preserve = request.form.get("preserve_stage_directions") == "on"
    model = request.form.get("model", "")
    output_format = request.form.get("output_format", "mp3_44100_128")
    speak_parentheticals = request.form.get("speak_parentheticals") == "on"
    delay_ms = int(request.form.get("request_delay_ms", "500") or "500")
    concatenate = request.form.get("concatenate") == "on"

    parsed = parse_script(script_text, preserve_stage_directions=preserve)

    character_configs: dict[str, CharacterConfig] = {}
    for idx, character in enumerate(parsed.characters):
        voice_id = request.form.get(f"voice_id__{idx}", "").strip()
        stability = float(request.form.get(f"stability__{idx}", "0.5") or "0.5")
        similarity_boost = float(request.form.get(f"similarity_boost__{idx}", "0.75") or "0.75")
        style = float(request.form.get(f"style__{idx}", "0.1") or "0.1")
        speed = float(request.form.get(f"speed__{idx}", "1") or "1")
        character_configs[character] = CharacterConfig(
            voice_id=voice_id,
            voice_settings=VoiceSettings(
                stability=stability,
                similarity_boost=similarity_boost,
                style=style,
                speed=speed,
            ),
        )

    errors = validate_character_configs(parsed.dialogue_chunks, character_configs)
    if errors:
        return Response("\n".join(errors), status=400, content_type="text/plain")

    client = ElevenLabsClient(cfg.elevenlabs)
    generated = generate_all_audio(
        client=client,
        dialogue_chunks=parsed.dialogue_chunks,
        character_configs=character_configs,
        model_id=model,
        output_format=output_format,
        delay_ms=delay_ms,
        speak_parentheticals=speak_parentheticals,
        fetch_alignment=True,
    )

    entries = build_manifest_entries(
        parsed.dialogue_chunks,
        [g.filename for g in generated],
        start_times_ms=[g.start_time_ms for g in generated],
        end_times_ms=[g.end_time_ms for g in generated],
        alignments=[g.alignment for g in generated],
    )

    audio_files = [(g.filename, g.audio_bytes) for g in generated]

    if concatenate:
        ffmpeg = FfmpegConfig(ffmpeg_bin=cfg.ffmpeg.ffmpeg_bin)
        with tempfile.TemporaryDirectory(prefix="esf_generate_") as tmpdir:
            tmp = Path(tmpdir)
            paths = []
            for name, data in audio_files:
                p = tmp / name
                p.write_bytes(data)
                paths.append(p)
            out_path = tmp / "concatenated_audio.mp3"
            from lib.audio.ffmpeg import concat_audio as _concat

            _concat(ffmpeg, paths, out_path)
            audio_files.append(("concatenated_audio.mp3", out_path.read_bytes()))

    zip_bytes = build_zip_bundle(audio_files=audio_files, manifest_entries=entries)
    return Response(
        zip_bytes,
        status=200,
        content_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="bundle.zip"'},
    )


@app.get("/health")
def health() -> Response:
    return Response(json.dumps({"status": "ok"}), content_type="application/json")
