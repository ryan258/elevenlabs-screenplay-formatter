from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from flask import Response, current_app, redirect, render_template, request

from apps.api.config import AppConfig
from apps.web.app import app
from apps.api.jobs import JobStore
from apps.api.limits import MAX_DIALOGUE_CHUNKS, MAX_SCRIPT_CHARS
from apps.api.schemas import GenerateZipRequest
from apps.api.character_configs import build_character_configs
from lib.config import FfmpegConfig
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle
from lib.generation import generate_all_audio
from lib.manifest import build_manifest_entries, manifest_to_srt, manifest_to_vtt
from lib.models import CharacterConfig, VoiceSettings
from lib.parser import parse_script
from lib.reaper_export import build_reaper_project
from lib.share_links import decode_share_payload
from lib.validation import validate_character_configs
from lib.voice_extraction import extract_voice_ids_from_script


def _get_cfg() -> AppConfig:
    cfg = current_app.config.get("APP_CONFIG")
    if cfg is None:
        from apps.api.config import load_config_from_env

        cfg = load_config_from_env()
        current_app.config["APP_CONFIG"] = cfg
        current_app.secret_key = cfg.flask_secret_key
    if not isinstance(cfg, AppConfig):
        raise RuntimeError("APP_CONFIG is not initialized")
    return cfg


def _get_store(cfg: AppConfig) -> JobStore:
    store = current_app.config.get("JOB_STORE")
    if store is None:
        store = JobStore(Path(cfg.upload_dir).resolve())
        current_app.config["JOB_STORE"] = store
    if not isinstance(store, JobStore):
        raise RuntimeError("JOB_STORE is not initialized")
    return store


def _default_voice_rows(characters: List[str], voice_ids: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    voice_ids = voice_ids or {}
    return [
        {
            "voice_id": voice_ids.get(character, ""),
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.1,
            "speed": 1.0,
        }
        for character in characters
    ]


def _parse_int(value: str, *, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _parse_float(value: str, *, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _is_hx_request() -> bool:
    return request.headers.get("HX-Request") == "true"


def _error_response(errors: Sequence[str], *, status: int, hx_retarget: str = "#job-panel") -> Response:
    # HTMX does not always swap non-2xx responses into the target by default.
    # For HTMX requests, return a 200 with HTML so validation errors reliably render.
    effective_status = 200 if _is_hx_request() else status
    if not _is_hx_request():
        body = "; ".join([e for e in errors if e])
        return Response(render_template("simple_page.html", title="Error", body=body), status=status)

    resp = Response(render_template("error_box.html", errors=list(errors)), status=effective_status)
    if _is_hx_request():
        resp.headers["HX-Retarget"] = hx_retarget
        resp.headers["HX-Reswap"] = "innerHTML"
    return resp


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


@app.get("/generation")
def generation() -> Response:
    return redirect("/")


@app.get("/characters")
def characters() -> str:
    return render_template("simple_page.html", title="Characters", body="Coming soon.")


@app.get("/exports")
def exports() -> str:
    return render_template("simple_page.html", title="Exports", body="Start a job to enable exports.")


@app.post("/parse")
def parse() -> Response:
    script_text = request.form.get("script_text", "")
    if len(script_text) > MAX_SCRIPT_CHARS:
        return _error_response(["Script is too large"], status=413, hx_retarget="#parsed")
    preserve = request.form.get("preserve_stage_directions") == "on"
    parsed = parse_script(script_text, preserve_stage_directions=preserve)
    extracted_voice_ids = extract_voice_ids_from_script(script_text)
    template = "parsed_partial.html" if request.headers.get("HX-Request") == "true" else "parsed.html"
    html = render_template(
        template,
        parsed=parsed,
        script_text=script_text,
        preserve=preserve,
        errors=[],
        model="",
        output_format="mp3_44100_128",
        request_delay_ms=500,
        speak_parentheticals=False,
        concatenate=False,
        filename_prefix="",
        voice_rows=_default_voice_rows(parsed.characters, extracted_voice_ids),
    )
    return Response(html, status=200, content_type="text/html")


@app.post("/generation/start")
def generation_start() -> Response:
    cfg = _get_cfg()
    store = _get_store(cfg)

    script_text = request.form.get("script_text", "")
    preserve = request.form.get("preserve_stage_directions") == "on"
    model = request.form.get("model", "")
    output_format = request.form.get("output_format", "mp3_44100_128")
    speak_parentheticals = request.form.get("speak_parentheticals") == "on"
    concatenate = request.form.get("concatenate") == "on"
    filename_prefix = request.form.get("filename_prefix", "").strip()
    delay_ms = _parse_int(request.form.get("request_delay_ms", "500") or "500", default=500)

    if len(script_text) > MAX_SCRIPT_CHARS:
        return _error_response(["Script is too large"], status=413)
    if not cfg.elevenlabs.api_key:
        return _error_response(["Missing ELEVENLABS_API_KEY"], status=400)

    parsed = parse_script(script_text, preserve_stage_directions=preserve)
    if len(parsed.dialogue_chunks) > MAX_DIALOGUE_CHUNKS:
        return _error_response(["Too many dialogue chunks"], status=413)

    character_configs_payload: Dict[str, Dict[str, Any]] = {}
    voice_rows: List[Dict[str, Any]] = []
    for idx, character in enumerate(parsed.characters):
        voice_id = request.form.get(f"voice_id__{idx}", "").strip()
        stability = _parse_float(request.form.get(f"stability__{idx}", "0.5") or "0.5", default=0.5)
        similarity_boost = _parse_float(
            request.form.get(f"similarity_boost__{idx}", "0.75") or "0.75",
            default=0.75,
        )
        style = _parse_float(request.form.get(f"style__{idx}", "0.1") or "0.1", default=0.1)
        speed = _parse_float(request.form.get(f"speed__{idx}", "1") or "1", default=1.0)
        voice_rows.append(
            {
                "voice_id": voice_id,
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "speed": speed,
            }
        )
        character_configs_payload[character] = {
            "voiceId": voice_id,
            "voiceSettings": {
                "stability": stability,
                "similarity_boost": similarity_boost,
                "style": style,
                "speed": speed,
            },
        }

    payload: Dict[str, Any] = {
        "scriptText": script_text,
        "projectSettings": {
            "model": model,
            "outputFormat": output_format,
            "concatenate": concatenate,
            "speakParentheticals": speak_parentheticals,
            "preserveStageDirections": preserve,
            "requestDelayMs": delay_ms,
        },
        "characterConfigs": character_configs_payload,
        "filename_prefix": filename_prefix or None,
    }

    try:
        body = GenerateZipRequest.model_validate(payload)
    except Exception as exc:
        if _is_hx_request():
            return _error_response([str(exc)], status=400)
        return Response(
            render_template(
                "parsed.html",
                parsed=parsed,
                script_text=script_text,
                preserve=preserve,
                errors=[str(exc)],
                model=model,
                output_format=output_format,
                request_delay_ms=delay_ms,
                speak_parentheticals=speak_parentheticals,
                concatenate=concatenate,
                filename_prefix=filename_prefix,
                voice_rows=voice_rows,
            ),
            status=400,
        )

    character_configs = build_character_configs(body)
    errors = validate_character_configs(parsed.dialogue_chunks, character_configs)
    if not body.project_settings.model:
        errors = ["Missing projectSettings.model", *errors]
    if not body.project_settings.output_format:
        errors = ["Missing projectSettings.outputFormat", *errors]
    if errors:
        if _is_hx_request():
            return _error_response(errors, status=400)
        return Response(
            render_template(
                "parsed.html",
                parsed=parsed,
                script_text=script_text,
                preserve=preserve,
                errors=errors,
                model=model,
                output_format=output_format,
                request_delay_ms=delay_ms,
                speak_parentheticals=speak_parentheticals,
                concatenate=concatenate,
                filename_prefix=filename_prefix,
                voice_rows=voice_rows,
            ),
            status=400,
        )

    job = store.create()
    store.start_generation(
        cfg=cfg,
        job=job,
        script_text=script_text,
        preserve_stage_directions=preserve,
        model=body.project_settings.model,
        output_format=body.project_settings.output_format,
        request_delay_ms=body.project_settings.request_delay_ms or 500,
        speak_parentheticals=body.project_settings.speak_parentheticals,
        concatenate=body.project_settings.concatenate,
        filename_prefix=body.filename_prefix or "",
        character_configs=character_configs,
    )

    snap = job.snapshot()
    context = {
        "job_id": snap.job_id,
        "status": snap.status,
        "current": snap.current,
        "total": max(snap.total, len(parsed.dialogue_chunks)),
        "message": snap.message or "Queued",
    }

    template = "job_panel.html" if request.headers.get("HX-Request") == "true" else "job_started.html"
    return Response(
        render_template(template, **context),
        status=200,
        content_type="text/html",
    )


@app.post("/generate.zip")
def generate_zip() -> Response:
    cfg = _get_cfg()
    if not cfg.elevenlabs.api_key:
        return Response(render_template("simple_page.html", title="Error", body="Missing ELEVENLABS_API_KEY"), status=400)

    script_text = request.form.get("script_text", "")
    if len(script_text) > MAX_SCRIPT_CHARS:
        return Response(render_template("simple_page.html", title="Error", body="Script is too large"), status=413)
    preserve = request.form.get("preserve_stage_directions") == "on"
    model = request.form.get("model", "")
    output_format = request.form.get("output_format", "mp3_44100_128")
    speak_parentheticals = request.form.get("speak_parentheticals") == "on"
    delay_ms = _parse_int(request.form.get("request_delay_ms", "500") or "500", default=500)
    concatenate = request.form.get("concatenate") == "on"

    parsed = parse_script(script_text, preserve_stage_directions=preserve)
    if len(parsed.dialogue_chunks) > MAX_DIALOGUE_CHUNKS:
        return Response(render_template("simple_page.html", title="Error", body="Too many dialogue chunks"), status=413)

    character_configs: dict[str, CharacterConfig] = {}
    for idx, character in enumerate(parsed.characters):
        voice_id = request.form.get(f"voice_id__{idx}", "").strip()
        stability = _parse_float(request.form.get(f"stability__{idx}", "0.5") or "0.5", default=0.5)
        similarity_boost = _parse_float(request.form.get(f"similarity_boost__{idx}", "0.75") or "0.75", default=0.75)
        style = _parse_float(request.form.get(f"style__{idx}", "0.1") or "0.1", default=0.1)
        speed = _parse_float(request.form.get(f"speed__{idx}", "1") or "1", default=1.0)
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
        return Response(
            render_template("simple_page.html", title="Error", body="; ".join(errors)),
            status=400,
        )

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

    zip_bytes = build_zip_bundle(
        audio_files=audio_files,
        manifest_entries=entries,
        extra_files=[
            ("subtitles.srt", manifest_to_srt(entries).encode("utf-8")),
            ("subtitles.vtt", manifest_to_vtt(entries).encode("utf-8")),
            ("reaper.rpp", build_reaper_project(entries).encode("utf-8")),
        ],
    )
    return Response(
        zip_bytes,
        status=200,
        content_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="bundle.zip"'},
    )


@app.get("/health")
def health() -> Response:
    return Response(json.dumps({"status": "ok"}), content_type="application/json")
