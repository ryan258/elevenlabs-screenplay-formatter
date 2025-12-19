from __future__ import annotations

import json
import tempfile
from pathlib import Path
import hashlib
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

from flask import Response, current_app, redirect, render_template, request, send_file, session, url_for
from werkzeug.wrappers.response import Response as WerkzeugResponse

from apps.api.character_configs import build_character_configs
from apps.api.config import AppConfig
from apps.api.jobs import JobStore
from apps.api.limits import MAX_DIALOGUE_CHUNKS, MAX_SCRIPT_CHARS
from apps.api.schemas import GenerateZipRequest
from apps.web.app import app
from apps.web.session_store import WebSessionStore
from lib.config import FfmpegConfig
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle
from lib.generation import generate_all_audio, generate_one_audio, output_format_extension
from lib.manifest import build_manifest_entries, manifest_to_srt, manifest_to_vtt
from lib.models import CharacterConfig, VoiceSettings
from lib.parser import parse_script
from lib.reaper_export import build_reaper_project
from lib.share_links import decode_share_payload
from lib.validation import validate_character_configs
from lib.voice_extraction import extract_voice_ids_from_script
from lib.utils_web import RateLimiter, generation_limiter, clamp_voice_setting

_VOICES_CACHE_TTL_S = 300





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


def _get_web_store(cfg: AppConfig) -> WebSessionStore:
    store = current_app.config.get("WEB_SESSION_STORE")
    if store is None:
        store = WebSessionStore((Path(cfg.upload_dir) / "web_sessions").resolve())
        current_app.config["WEB_SESSION_STORE"] = store
    if not isinstance(store, WebSessionStore):
        raise RuntimeError("WEB_SESSION_STORE is not initialized")
    return store


def _api_key_cache_tag(api_key: str) -> str:
    if not api_key:
        return ""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:16]


def _get_voices_cache() -> Tuple[float, str, List[Dict[str, Any]]]:
    cached = current_app.config.get("ELEVENLABS_VOICES_CACHE")
    if (
        isinstance(cached, tuple)
        and len(cached) == 3
        and isinstance(cached[0], (int, float))
        and isinstance(cached[1], str)
        and isinstance(cached[2], list)
    ):
        return float(cached[0]), str(cached[1]), list(cached[2])
    return 0.0, "", []


def _set_voices_cache(fetched_at_s: float, api_key_tag: str, voices: List[Dict[str, Any]]) -> None:
    current_app.config["ELEVENLABS_VOICES_CACHE"] = (float(fetched_at_s), str(api_key_tag), list(voices))


def _list_elevenlabs_voices(cfg: AppConfig, *, force_refresh: bool) -> List[Dict[str, Any]]:
    fetched_at_s, cached_tag, cached = _get_voices_cache()
    now = time.time()
    key_tag = _api_key_cache_tag(cfg.elevenlabs.api_key)
    if (not force_refresh) and cached and cached_tag == key_tag and (now - fetched_at_s) < _VOICES_CACHE_TTL_S:
        return cached

    if not cfg.elevenlabs.api_key:
        return []

    client = ElevenLabsClient(cfg.elevenlabs)
    voices = client.list_voices()
    out: List[Dict[str, Any]] = []
    for v in voices:
        out.append(
            {
                "voice_id": v.voice_id,
                "name": v.name,
                "category": v.category,
                "description": v.description,
                "preview_url": v.preview_url,
            }
        )
    _set_voices_cache(now, key_tag, out)
    return out


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


def _error_response(
    errors: Sequence[str], *, status: int, hx_retarget: str = "#job-panel"
) -> WerkzeugResponse:
    effective_status = 200 if _is_hx_request() else status
    if not _is_hx_request():
        body = "; ".join([e for e in errors if e])
        return Response(render_template("simple_page.html", title="Error", body=body), status=status)

    resp = Response(render_template("error_box.html", errors=list(errors)), status=effective_status)
    resp.headers["HX-Retarget"] = hx_retarget
    resp.headers["HX-Reswap"] = "innerHTML"
    return resp


def _get_session_id() -> Optional[str]:
    """ONLY use server-side session, never query params (Bug 9 fix - prevent session fixation)"""
    sid = session.get("sid")  # Remove request.args.get("sid")
    if isinstance(sid, str) and sid:
        return sid
    return None


def _payload_from_session(cfg: AppConfig) -> Optional[Dict[str, Any]]:
    sid = _get_session_id()
    if not sid:
        return None
    store = _get_web_store(cfg)
    data = store.get(sid)
    if data is None:
        return None
    return data.payload


def _build_default_payload(
    *,
    script_text: str,
    preserve_stage_directions: bool,
) -> Tuple[Dict[str, Any], List[str]]:
    parsed = parse_script(script_text, preserve_stage_directions=preserve_stage_directions)
    extracted_voice_ids = extract_voice_ids_from_script(script_text)

    character_configs_payload: Dict[str, Dict[str, Any]] = {}
    for character in parsed.characters:
        voice_id = extracted_voice_ids.get(character, "")
        character_configs_payload[character] = {
            "voiceId": voice_id,
            "voiceSettings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.1,
                "speed": 1.0,
            },
        }

    payload: Dict[str, Any] = {
        "scriptText": script_text,
        "projectSettings": {
            "model": "",
            "outputFormat": "mp3_44100_128",
            "concatenate": True,
            "speakParentheticals": False,
            "preserveStageDirections": preserve_stage_directions,
            "requestDelayMs": 500,
        },
        "characterConfigs": character_configs_payload,
        "filename_prefix": "",
        "lastJobId": None,
    }
    return payload, parsed.characters


def _voice_rows_from_payload(parsed_characters: List[str], payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    cfgs: Dict[str, Any] = payload.get("characterConfigs") or {}
    rows: List[Dict[str, Any]] = []
    for character in parsed_characters:
        item = cfgs.get(character) or {}
        vs = item.get("voiceSettings") or {}
        rows.append(
            {
                "voice_id": str(item.get("voiceId") or ""),
                "stability": float(vs.get("stability") or 0.5),
                "similarity_boost": float(vs.get("similarity_boost") or 0.75),
                "style": float(vs.get("style") or 0.1),
                "speed": float(vs.get("speed") or 1.0),
            }
        )
    return rows


def _validate_payload(cfg: AppConfig, payload: Dict[str, Any]) -> List[str]:
    try:
        body = GenerateZipRequest.model_validate(payload)
    except Exception as exc:
        return [str(exc)]

    if len(body.script_text) > MAX_SCRIPT_CHARS:
        return ["Script is too large"]
    try:
        parsed = parse_script(
            body.script_text,
            preserve_stage_directions=body.project_settings.preserve_stage_directions,
        )
    except Exception as exc:
        return [f"Failed to parse script: {exc}"]
    if len(parsed.dialogue_chunks) > MAX_DIALOGUE_CHUNKS:
        return ["Too many dialogue chunks"]

    character_configs = build_character_configs(body)
    errors = validate_character_configs(parsed.dialogue_chunks, character_configs)
    if not body.project_settings.model:
        errors.insert(0, "Missing projectSettings.model")
    if not body.project_settings.output_format:
        errors.insert(0, "Missing projectSettings.outputFormat")
    if not cfg.elevenlabs.api_key:
        errors.insert(0, "Missing ELEVENLABS_API_KEY")
    return errors


def _share_normalized_payload(share_payload: Dict[str, Any]) -> Dict[str, Any]:
    script_text = str(share_payload.get("scriptText") or share_payload.get("script_text") or "").strip()
    project_settings = share_payload.get("projectSettings") or {}
    if not isinstance(project_settings, dict):
        project_settings = {}
    character_configs = share_payload.get("characterConfigs") or {}
    if not isinstance(character_configs, dict):
        character_configs = {}
    filename_prefix = share_payload.get("filename_prefix") or share_payload.get("filenamePrefix") or ""

    return {
        "scriptText": script_text,
        "projectSettings": project_settings,
        "characterConfigs": character_configs,
        "filename_prefix": str(filename_prefix),
    }


def _session_share_view(payload: Dict[str, Any]) -> Dict[str, Any]:
    project_settings = payload.get("projectSettings") or {}
    if not isinstance(project_settings, dict):
        project_settings = {}
    character_configs = payload.get("characterConfigs") or {}
    if not isinstance(character_configs, dict):
        character_configs = {}
    return {
        "scriptText": str(payload.get("scriptText") or "").strip(),
        "projectSettings": project_settings,
        "characterConfigs": character_configs,
        "filename_prefix": str(payload.get("filename_prefix") or ""),
    }


def _find_preview_path(preview_dir: Path, chunk_index: int) -> Optional[Path]:
    candidates = [
        (preview_dir / f"preview_{chunk_index:04d}.mp3").resolve(),
        (preview_dir / f"preview_{chunk_index:04d}.wav").resolve(),
    ]
    for path in candidates:
        try:
            path.relative_to(preview_dir)
        except ValueError:
            continue
        if path.exists():
            return path
    return None


@app.get("/")
def index() -> str:
    shared_project: Optional[str] = request.args.get("project")

    cfg = _get_cfg()
    stored_payload = _payload_from_session(cfg)
    stored = stored_payload or {}
    script_text = str(stored.get("scriptText") or "")
    preserve = bool(stored.get("projectSettings", {}).get("preserveStageDirections"))

    if shared_project:
        try:
            decoded = decode_share_payload(shared_project)
            share_payload_raw = json.loads(decoded)
            share_norm = _share_normalized_payload(share_payload_raw)
            share_script_text = str(share_norm["scriptText"] or "").strip()
            if share_script_text:
                share_project_settings = share_norm["projectSettings"]
                preserve_stage_directions = bool(
                    share_project_settings.get("preserveStageDirections") or share_payload_raw.get("preserve_stage_directions")
                )

                share_effective, _characters = _build_default_payload(
                    script_text=share_script_text,
                    preserve_stage_directions=preserve_stage_directions,
                )
                if isinstance(share_project_settings, dict) and share_project_settings:
                    share_effective["projectSettings"] = {**share_effective.get("projectSettings", {}), **share_project_settings}
                share_character_configs = share_norm["characterConfigs"]
                if isinstance(share_character_configs, dict) and share_character_configs:
                    share_effective["characterConfigs"] = share_character_configs
                filename_prefix = share_norm.get("filename_prefix") or ""
                if filename_prefix:
                    share_effective["filename_prefix"] = str(filename_prefix)

                needs_new_session = True
                if stored_payload and _session_share_view(stored_payload) == _session_share_view(share_effective):
                    needs_new_session = False

                if needs_new_session:
                    data = _get_web_store(cfg).create(payload=share_effective)
                    session["sid"] = data.session_id
                    stored_payload = data.payload

                stored = stored_payload or {}
                script_text = str(stored.get("scriptText") or "")
                preserve = bool(stored.get("projectSettings", {}).get("preserveStageDirections"))
        except Exception:
            script_text = ""

    return render_template("index.html", script_text=script_text, preserve=preserve, has_session=stored_payload is not None)


@app.get("/characters")
def characters() -> str:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return render_template("simple_page.html", title="Characters", body="Paste a script first.")

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return render_template("simple_page.html", title="Characters", body=f"Failed to parse script: {exc}")
    voice_rows = _voice_rows_from_payload(parsed.characters, payload)
    return render_template("characters.html", parsed=parsed, voice_rows=voice_rows, errors=[])


@app.get("/generation")
def generation() -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return redirect("/")

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return Response(
            render_template("simple_page.html", title="Generation", body=f"Failed to parse script: {exc}"),
            status=400,
        )
    project_settings = payload.get("projectSettings") or {}

    models_list = []
    if cfg.elevenlabs.api_key:
        try:
            client = ElevenLabsClient(cfg.elevenlabs)
            models_list = client.list_models()
        except Exception:
            pass  # Fallback to empty list or default input

    job_id = request.args.get("job_id") or payload.get("lastJobId")
    context: Dict[str, Any] = {
        "parsed": parsed,
        "errors": [],
        "model": str(project_settings.get("model") or ""),
        "models": models_list,
        "output_format": str(project_settings.get("outputFormat") or "mp3_44100_128"),
        "request_delay_ms": int(project_settings.get("requestDelayMs") or 500),
        "speak_parentheticals": bool(project_settings.get("speakParentheticals")),
        "concatenate": bool(project_settings.get("concatenate")),
        "filename_prefix": str(payload.get("filename_prefix") or ""),
        "job_id": job_id,
    }

    if job_id:
        store = _get_store(cfg)
        job = store.get(str(job_id))
        if job is None:
            context.update(
                {
                    "status": "unknown",
                    "current": 0,
                    "total": len(parsed.dialogue_chunks),
                    "message": "Job not found (restart generation).",
                }
            )
        else:
            snap = job.snapshot()
            context.update(
                {
                    "status": snap.status,
                    "current": snap.current,
                    "total": max(snap.total, len(parsed.dialogue_chunks)),
                    "message": snap.message or "",
                }
            )

    return Response(render_template("generation.html", **context), status=200)


@app.get("/timeline")
def timeline() -> WerkzeugResponse:
    cfg = _get_cfg()
    store = _get_store(cfg)

    job_id = request.args.get("job_id")
    page = max(1, _parse_int(request.args.get("page", "1") or "1", default=1))
    per_page = 50

    if job_id:
        job = store.get(str(job_id))
        if job is None:
            return Response(render_template("simple_page.html", title="Timeline", body="Job not found."), status=404)
        manifest_path = (job.work_dir / "manifest.json").resolve()
        if not manifest_path.exists():
            return Response(
                render_template("simple_page.html", title="Timeline", body="manifest.json not ready."),
                status=404,
            )
        entries = json.loads(manifest_path.read_text(encoding="utf-8"))
        total_chunks = len(entries)
        total_pages = max(1, (total_chunks + per_page - 1) // per_page)
        page = min(page, total_pages)
        start_index = (page - 1) * per_page
        items = []
        for entry in entries[start_index : start_index + per_page]:
            items.append(
                {
                    "index": int(entry.get("index") or 0),
                    "character": str(entry.get("character") or ""),
                    "text": str(entry.get("text") or ""),
                    "preview_url": f"/api/jobs/{job.job_id}/audio/{entry.get('filename')}",
                }
            )

        return Response(
            render_template(
                "timeline.html",
                chunks=items,
                total_chunks=total_chunks,
                page=page,
                total_pages=total_pages,
                start_index=start_index,
                job_id=str(job.job_id),
                errors=[],
            ),
            status=200,
        )

    payload = _payload_from_session(cfg)
    if not payload:
        return redirect("/")

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return Response(render_template("simple_page.html", title="Timeline", body=f"Failed to parse script: {exc}"), status=400)

    total_chunks = len(parsed.dialogue_chunks)
    total_pages = max(1, (total_chunks + per_page - 1) // per_page)
    page = min(page, total_pages)
    start_index = (page - 1) * per_page

    sid = _get_session_id()
    if not sid:
        return redirect("/")
    web_store = _get_web_store(cfg)
    preview_dir = web_store.preview_dir(sid)

    items = []
    for idx, chunk in enumerate(parsed.dialogue_chunks[start_index : start_index + per_page], start=start_index):
        preview_path = _find_preview_path(preview_dir, idx)
        items.append(
            {
                "index": idx,
                "character": chunk.character,
                "text": chunk.text,
                "preview_url": f"/timeline/previews/{idx}" if preview_path is not None else None,
            }
        )

    return Response(
        render_template(
            "timeline.html",
            chunks=items,
            total_chunks=total_chunks,
            page=page,
            total_pages=total_pages,
            start_index=start_index,
            job_id=None,
            errors=[],
        ),
        status=200,
    )


@app.get("/exports")
def exports() -> str:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg) or {}
    job_id = request.args.get("job_id") or payload.get("lastJobId")

    concat_ready = False
    export_ready = False
    if job_id:
        store = _get_store(cfg)
        job = store.get(str(job_id))
        if job is not None:
            export_ready = job.export_path is not None and job.export_path.exists()
            work_dir = job.work_dir.resolve()
            concat_ready = any(
                (work_dir / name).exists()
                for name in (
                    "concatenated_audio.mp3",
                    "concatenated_audio.wav",
                )
            )

    return render_template(
        "exports.html",
        job_id=job_id,
        export_ready=export_ready,
        concat_ready=concat_ready,
    )


@app.post("/parse")
def parse() -> WerkzeugResponse:
    script_text = request.form.get("script_text", "")
    if len(script_text) > MAX_SCRIPT_CHARS:
        return _error_response(["Script is too large"], status=413, hx_retarget="#job-panel")
    preserve = request.form.get("preserve_stage_directions") == "on"

    cfg = _get_cfg()
    web_store = _get_web_store(cfg)
    try:
        payload, _characters = _build_default_payload(script_text=script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return _error_response([f"Failed to parse script: {exc}"], status=400, hx_retarget="#job-panel")
    data = web_store.create(payload=payload)
    session["sid"] = data.session_id

    if _is_hx_request():
        resp = Response("", status=200)
        resp.headers["HX-Redirect"] = url_for("characters")
        return resp
    return redirect(url_for("characters"))


@app.post("/characters/autofill")
def characters_autofill() -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return redirect("/")

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return _error_response([f"Failed to parse script: {exc}"], status=400, hx_retarget="#characters-table")
    extracted = extract_voice_ids_from_script(script_text)
    cfgs: Dict[str, Any] = payload.get("characterConfigs") or {}
    for character in parsed.characters:
        voice_id = extracted.get(character)
        if voice_id:
            item = cfgs.get(character) or {}
            item["voiceId"] = voice_id
            cfgs[character] = item

    payload["characterConfigs"] = cfgs
    sid = _get_session_id()
    if sid:
        _get_web_store(cfg).patch(sid, payload)

    if not _is_hx_request():
        return redirect(url_for("characters"))

    voice_rows = _voice_rows_from_payload(parsed.characters, payload)
    html = render_template("characters_table.html", parsed=parsed, voice_rows=voice_rows)
    return Response(html, status=200, content_type="text/html")


@app.get("/characters/voices")
def characters_voices() -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return Response(render_template("error_box.html", errors=["Paste a script first."]), status=200)

    if not cfg.elevenlabs.api_key:
        return Response(
            render_template("error_box.html", errors=["Missing ELEVENLABS_API_KEY (set it in your environment)."]),
            status=200,
        )

    force_refresh = request.args.get("refresh") == "1"
    try:
        voices = _list_elevenlabs_voices(cfg, force_refresh=force_refresh)
    except Exception as exc:
        return Response(render_template("error_box.html", errors=[f"Failed to load voices: {exc}"]), status=200)

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return Response(render_template("error_box.html", errors=[f"Failed to parse script: {exc}"]), status=200)

    html = render_template(
        "voices_list.html",
        voices=voices,
        characters=parsed.characters,
    )
    return Response(html, status=200, content_type="text/html")


@app.post("/characters/apply_voice")
def characters_apply_voice() -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return redirect("/")

    character = (request.form.get("character") or "").strip()
    voice_id = (request.form.get("voice_id") or "").strip()
    if not character or not voice_id:
        return _error_response(["Missing character or voice id"], status=400, hx_retarget="#voices-list")

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return _error_response([f"Failed to parse script: {exc}"], status=400, hx_retarget="#voices-list")
    if character not in parsed.characters:
        return _error_response(["Invalid character selection"], status=400, hx_retarget="#voices-list")

    cfgs: Dict[str, Any] = payload.get("characterConfigs") or {}
    item = cfgs.get(character) or {}
    item["voiceId"] = voice_id
    cfgs[character] = item
    payload["characterConfigs"] = cfgs

    sid = _get_session_id()
    if sid:
        _get_web_store(cfg).patch(sid, payload)

    if not _is_hx_request():
        return redirect(url_for("characters"))

    voice_rows = _voice_rows_from_payload(parsed.characters, payload)
    html = render_template("characters_table.html", parsed=parsed, voice_rows=voice_rows)
    return Response(html, status=200, content_type="text/html")


@app.post("/characters/apply_preset")
def characters_apply_preset() -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return redirect("/")

    preset = (request.form.get("preset") or "balanced").strip().lower()
    presets: Dict[str, Dict[str, float]] = {
        "balanced": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.1, "speed": 1.0},
        "stable": {"stability": 0.75, "similarity_boost": 0.75, "style": 0.0, "speed": 1.0},
        "expressive": {"stability": 0.35, "similarity_boost": 0.75, "style": 0.35, "speed": 1.0},
        "fast": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.1, "speed": 1.2},
    }
    selected = presets.get(preset) or presets["balanced"]

    cfgs: Dict[str, Any] = payload.get("characterConfigs") or {}
    for character in list(cfgs.keys()):
        item = cfgs.get(character) or {}
        item["voiceSettings"] = dict(selected)
        cfgs[character] = item
    payload["characterConfigs"] = cfgs

    sid = _get_session_id()
    if sid:
        _get_web_store(cfg).patch(sid, payload)

    if not _is_hx_request():
        return redirect(url_for("characters"))

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return _error_response([f"Failed to parse script: {exc}"], status=400, hx_retarget="#characters-table")
    voice_rows = _voice_rows_from_payload(parsed.characters, payload)
    html = render_template("characters_table.html", parsed=parsed, voice_rows=voice_rows)
    return Response(html, status=200, content_type="text/html")


@app.post("/characters/save")
def characters_save() -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return redirect("/")

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return _error_response([f"Failed to parse script: {exc}"], status=400, hx_retarget="#save-result")

    character_configs_payload: Dict[str, Dict[str, Any]] = {}
    for idx, character in enumerate(parsed.characters):
        voice_id = request.form.get(f"voice_id__{idx}", "").strip()
        # Bug 19 fix - clamp voice settings to valid ranges
        stability = clamp_voice_setting(
            _parse_float(request.form.get(f"stability__{idx}", "0.5") or "0.5", default=0.5),
            min_val=0.0, max_val=1.0, default=0.5
        )
        similarity_boost = clamp_voice_setting(
            _parse_float(request.form.get(f"similarity_boost__{idx}", "0.75") or "0.75", default=0.75),
            min_val=0.0, max_val=1.0, default=0.75
        )
        style = clamp_voice_setting(
            _parse_float(request.form.get(f"style__{idx}", "0.1") or "0.1", default=0.1),
            min_val=0.0, max_val=1.0, default=0.1
        )
        speed = clamp_voice_setting(
            _parse_float(request.form.get(f"speed__{idx}", "1") or "1", default=1.0),
            min_val=0.25, max_val=4.0, default=1.0
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

    payload["characterConfigs"] = character_configs_payload
    sid = _get_session_id()
    if sid:
        _get_web_store(cfg).patch(sid, payload)

    if _is_hx_request():
        resp = Response(render_template("ok_box.html", message="Saved."), status=200, content_type="text/html")
        resp.headers["HX-Redirect"] = url_for("generation")
        return resp
    return redirect(url_for("generation"))


@app.post("/generation/validate")
def generation_validate() -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return redirect("/")

    project_settings = payload.get("projectSettings") or {}
    project_settings["model"] = request.form.get("model", "").strip()
    project_settings["outputFormat"] = request.form.get("output_format", "mp3_44100_128").strip()
    project_settings["requestDelayMs"] = _parse_int(request.form.get("request_delay_ms", "500") or "500", default=500)
    project_settings["speakParentheticals"] = request.form.get("speak_parentheticals") == "on"
    project_settings["concatenate"] = request.form.get("concatenate") == "on"
    payload["projectSettings"] = project_settings
    payload["filename_prefix"] = request.form.get("filename_prefix", "").strip()

    sid = _get_session_id()
    if sid:
        _get_web_store(cfg).patch(sid, payload)

    errors = _validate_payload(cfg, payload)
    if _is_hx_request():
        if errors:
            return _error_response(errors, status=400, hx_retarget="#validation")
        return Response(render_template("ok_box.html", message="Looks good."), status=200, content_type="text/html")

    script_text = str(payload.get("scriptText") or "")
    preserve = bool(payload.get("projectSettings", {}).get("preserveStageDirections"))
    try:
        parsed = parse_script(script_text, preserve_stage_directions=preserve)
    except Exception as exc:
        return Response(render_template("simple_page.html", title="Generation", body=f"Failed to parse script: {exc}"), status=400)
    return Response(
        render_template(
            "generation.html",
            parsed=parsed,
            errors=errors,
            model=project_settings.get("model", ""),
            output_format=project_settings.get("outputFormat", "mp3_44100_128"),
            request_delay_ms=project_settings.get("requestDelayMs", 500),
            speak_parentheticals=project_settings.get("speakParentheticals", False),
            concatenate=project_settings.get("concatenate", False),
            filename_prefix=payload.get("filename_prefix", ""),
            job_id=None,
        ),
        status=400 if errors else 200,
    )


@app.post("/generation/start")
def generation_start() -> WerkzeugResponse:
    # Bug 18 fix - Rate limit generation requests
    client_ip = request.remote_addr or "unknown"
    if not generation_limiter.check_limit(client_ip):
        return _error_response(["Rate limit exceeded. Try again in 1 minute."], status=429)

    cfg = _get_cfg()
    store = _get_store(cfg)
    payload = _payload_from_session(cfg)
    if not payload:
        return _error_response(["Paste a script first."], status=400)

    project_settings = payload.get("projectSettings") or {}
    project_settings["model"] = request.form.get("model", "").strip()
    project_settings["outputFormat"] = request.form.get("output_format", "mp3_44100_128").strip()
    project_settings["requestDelayMs"] = _parse_int(request.form.get("request_delay_ms", "500") or "500", default=500)
    project_settings["speakParentheticals"] = request.form.get("speak_parentheticals") == "on"
    project_settings["concatenate"] = request.form.get("concatenate") == "on"
    payload["projectSettings"] = project_settings
    payload["filename_prefix"] = request.form.get("filename_prefix", "").strip()

    sid = _get_session_id()
    if sid:
        _get_web_store(cfg).patch(sid, payload)

    errors = _validate_payload(cfg, payload)
    if errors:
        return _error_response(errors, status=400, hx_retarget="#job-panel")

    body = GenerateZipRequest.model_validate(payload)
    try:
        parsed = parse_script(body.script_text, preserve_stage_directions=body.project_settings.preserve_stage_directions)
    except Exception as exc:
        return _error_response([f"Failed to parse script: {exc}"], status=400, hx_retarget="#job-panel")
    character_configs = build_character_configs(body)

    job = store.create()
    store.start_generation(
        cfg=cfg,
        job=job,
        script_text=body.script_text,
        preserve_stage_directions=body.project_settings.preserve_stage_directions,
        model=body.project_settings.model,
        output_format=body.project_settings.output_format,
        request_delay_ms=body.project_settings.request_delay_ms or 500,
        speak_parentheticals=body.project_settings.speak_parentheticals,
        concatenate=body.project_settings.concatenate,
        filename_prefix=body.filename_prefix or "",
        character_configs=character_configs,
    )

    if sid:
        payload["lastJobId"] = job.job_id
        _get_web_store(cfg).patch(sid, payload)

    snap = job.snapshot()
    context = {
        "job_id": snap.job_id,
        "status": snap.status,
        "current": snap.current,
        "total": max(snap.total, len(parsed.dialogue_chunks)),
        "message": snap.message or "Queued",
    }

    template = "job_panel.html" if _is_hx_request() else "job_started.html"
    return Response(render_template(template, **context), status=200, content_type="text/html")


@app.post("/timeline/preview")
def timeline_preview() -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return redirect("/")

    sid = _get_session_id()
    if not sid:
        return redirect("/")

    index = _parse_int(request.form.get("chunk_index", "0") or "0", default=0)
    errors = _validate_payload(cfg, payload)
    if errors:
        return _error_response(errors, status=400, hx_retarget=f"#chunk-{index}")

    body = GenerateZipRequest.model_validate(payload)
    try:
        parsed = parse_script(body.script_text, preserve_stage_directions=body.project_settings.preserve_stage_directions)
    except Exception as exc:
        return _error_response([f"Failed to parse script: {exc}"], status=400, hx_retarget=f"#chunk-{index}")
    if index < 0 or index >= len(parsed.dialogue_chunks):
        return _error_response(["Chunk not found"], status=404, hx_retarget=f"#chunk-{index}")
    character_configs = build_character_configs(body)

    client = ElevenLabsClient(cfg.elevenlabs)
    generated = generate_one_audio(
        client=client,
        dialogue_chunks=parsed.dialogue_chunks,
        character_configs=character_configs,
        model_id=body.project_settings.model,
        output_format=body.project_settings.output_format,
        index=index,
        filename_prefix=body.filename_prefix or "",
        speak_parentheticals=body.project_settings.speak_parentheticals,
        fetch_alignment=False,
    )

    ext = output_format_extension(body.project_settings.output_format)
    preview_dir = _get_web_store(cfg).preview_dir(sid)
    out_path = (preview_dir / f"preview_{index:04d}.{ext}").resolve()
    out_path.write_bytes(generated.audio_bytes)

    item = {
        "index": index,
        "character": parsed.dialogue_chunks[index].character,
        "text": parsed.dialogue_chunks[index].text,
        "preview_url": f"/timeline/previews/{index}",
    }
    if not _is_hx_request():
        page = (index // 50) + 1
        return redirect(url_for("timeline", page=page))

    html = render_template("timeline_chunk.html", item=item)
    return Response(html, status=200, content_type="text/html")


@app.get("/timeline/previews/<int:chunk_index>")
def timeline_preview_file(chunk_index: int) -> WerkzeugResponse:
    cfg = _get_cfg()
    payload = _payload_from_session(cfg)
    if not payload:
        return Response("Not found", status=404)

    sid = _get_session_id()
    if not sid:
        return Response("Not found", status=404)

    preview_dir = _get_web_store(cfg).preview_dir(sid)
    path = _find_preview_path(preview_dir, chunk_index)
    if path is None:
        return Response("Not found", status=404)

    mimetype = "audio/mpeg" if path.name.lower().endswith(".mp3") else "audio/wav"
    return send_file(path, mimetype=mimetype, as_attachment=False, download_name=path.name)


@app.post("/generate.zip")
def generate_zip() -> WerkzeugResponse:
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
        # Bug 19 fix - clamp voice settings to valid ranges
        stability = clamp_voice_setting(
            _parse_float(request.form.get(f"stability__{idx}", "0.5") or "0.5", default=0.5),
            min_val=0.0, max_val=1.0, default=0.5
        )
        similarity_boost = clamp_voice_setting(
            _parse_float(request.form.get(f"similarity_boost__{idx}", "0.75") or "0.75", default=0.75),
            min_val=0.0, max_val=1.0, default=0.75
        )
        style = clamp_voice_setting(
            _parse_float(request.form.get(f"style__{idx}", "0.1") or "0.1", default=0.1),
            min_val=0.0, max_val=1.0, default=0.1
        )
        speed = clamp_voice_setting(
            _parse_float(request.form.get(f"speed__{idx}", "1") or "1", default=1.0),
            min_val=0.25, max_val=4.0, default=1.0
        )
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

            try:
                _concat(ffmpeg, paths, out_path)
                audio_files.append(("concatenated_audio.mp3", out_path.read_bytes()))
            except Exception as exc:
                audio_files.append(("concat_error.txt", str(exc).encode("utf-8")))

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
def health() -> WerkzeugResponse:
    return Response(json.dumps({"status": "ok"}), content_type="application/json")


@app.post("/reset")
def reset() -> WerkzeugResponse:
    session.pop("sid", None)
    return redirect("/")
