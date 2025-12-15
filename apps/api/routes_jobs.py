from __future__ import annotations

import asyncio
import json
from queue import Empty
from typing import AsyncIterator, Union

try:
    from fastapi import APIRouter, Depends
    from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc

from apps.api.config import AppConfig
from apps.api.character_configs import build_character_configs
from apps.api.deps import get_config, get_job_store
from apps.api.jobs import JobStore
from apps.api.limits import MAX_DIALOGUE_CHUNKS, MAX_SCRIPT_CHARS
from apps.api.schemas import ErrorResponse, GenerateZipRequest
from lib.parser import parse_script
from lib.validation import validate_character_configs


router = APIRouter(prefix="/api")


@router.post("/generate")
def api_generate_job(
    body: GenerateZipRequest,
    cfg: AppConfig = Depends(get_config),
    store: JobStore = Depends(get_job_store),
) -> JSONResponse:
    if len(body.script_text) > MAX_SCRIPT_CHARS:
        return JSONResponse(status_code=413, content=ErrorResponse(error="Script is too large").model_dump())
    if not cfg.elevenlabs.api_key:
        return JSONResponse(status_code=400, content=ErrorResponse(error="Missing ELEVENLABS_API_KEY").model_dump())

    parsed = parse_script(
        body.script_text,
        preserve_stage_directions=body.project_settings.preserve_stage_directions,
    )
    if len(parsed.dialogue_chunks) > MAX_DIALOGUE_CHUNKS:
        return JSONResponse(status_code=413, content=ErrorResponse(error="Too many dialogue chunks").model_dump())

    character_configs = build_character_configs(body)
    errors = validate_character_configs(parsed.dialogue_chunks, character_configs)
    if not body.project_settings.model:
        errors = ["Missing projectSettings.model", *errors]
    if not body.project_settings.output_format:
        errors = ["Missing projectSettings.outputFormat", *errors]
    if errors:
        return JSONResponse(
            status_code=400,
            content=ErrorResponse(error="Invalid configuration", meta={"errors": errors}).model_dump(),
        )

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
        filename_prefix=body.filename_prefix or "",
        character_configs=character_configs,
    )

    return JSONResponse(
        {
            "job_id": job.job_id,
            "status_url": f"/api/jobs/{job.job_id}",
            "events_url": f"/api/jobs/{job.job_id}/events",
            "export_url": f"/api/exports/{job.job_id}.zip",
        }
    )


@router.get("/jobs/{job_id}")
def api_job_status(job_id: str, store: JobStore = Depends(get_job_store)) -> JSONResponse:
    job = store.get(job_id)
    if job is None:
        return JSONResponse(status_code=404, content=ErrorResponse(error="Job not found").model_dump())
    return JSONResponse(job.snapshot().__dict__)


@router.get("/exports/{job_id}.zip")
def api_job_export(job_id: str, store: JobStore = Depends(get_job_store)) -> Union[FileResponse, JSONResponse]:
    job = store.get(job_id)
    if job is None or job.export_path is None or not job.export_path.exists():
        return JSONResponse(status_code=404, content=ErrorResponse(error="Export not ready").model_dump())
    return FileResponse(job.export_path, media_type="application/zip", filename="bundle.zip")


@router.get("/jobs/{job_id}/events")
async def api_job_events(job_id: str, store: JobStore = Depends(get_job_store)) -> Union[StreamingResponse, JSONResponse]:
    job = store.get(job_id)
    if job is None:
        return JSONResponse(status_code=404, content=ErrorResponse(error="Job not found").model_dump())

    async def event_stream() -> AsyncIterator[bytes]:
        snapshot = job.snapshot().__dict__
        yield f"event: snapshot\ndata: {json.dumps(snapshot)}\n\n".encode("utf-8")
        if snapshot["status"] in {"complete", "error"}:
            yield f"event: done\ndata: {json.dumps({'status': snapshot['status']})}\n\n".encode("utf-8")
            return

        loop = asyncio.get_running_loop()
        while True:
            try:
                item = await loop.run_in_executor(None, lambda: job.events.get(timeout=1))
                event = item.get("event", "message")
                data = item.get("data", {})
                payload = f"event: {event}\ndata: {json.dumps(data)}\n\n".encode("utf-8")
                yield payload
                if event == "done":
                    break
            except Empty:
                yield b": ping\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
