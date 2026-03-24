from __future__ import annotations

from collections import deque
from dataclasses import asdict
import json
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

import logging
from apps.api.config import AppConfig
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle_to_path
from lib.generation import GeneratedAudio, GenerationProgress, generate_all_audio_iter
from lib.manifest import build_manifest_entries, manifest_to_csv, manifest_to_srt, manifest_to_vtt
from lib.models import CharacterConfig, WordTimestamp
from lib.parser import parse_script
from lib.reaper_export import build_reaper_project
from lib.validation import validate_character_configs
from lib.utils import check_disk_space

logger = logging.getLogger(__name__)


@dataclass
class JobSnapshot:
    job_id: str
    status: str
    created_at_s: float
    updated_at_s: float
    current: int
    total: int
    message: str
    error: Optional[str]
    export_ready: bool


@dataclass
class Job:
    job_id: str
    created_at_s: float
    updated_at_s: float
    status: str = "queued"  # queued | running | complete | error
    current: int = 0
    total: int = 0
    message: str = ""
    error: Optional[str] = None
    export_path: Optional[Path] = None
    work_dir: Path = field(default_factory=Path)
    _event_seq: int = 0
    _events: Deque[Dict[str, Any]] = field(default_factory=lambda: deque(maxlen=2000))
    _event_cond: threading.Condition = field(default_factory=lambda: threading.Condition())

    def snapshot(self) -> JobSnapshot:
        with self._event_cond:
            return JobSnapshot(
                job_id=self.job_id,
                status=self.status,
                created_at_s=self.created_at_s,
                updated_at_s=self.updated_at_s,
                current=self.current,
                total=self.total,
                message=self.message,
                error=self.error,
                export_ready=self.export_path is not None and self.export_path.exists(),
            )

    def add_event(self, event: str, data: Dict[str, Any]) -> int:
        with self._event_cond:
            self._event_seq += 1
            payload = {"id": self._event_seq, "event": event, "data": data, "ts": time.time()}
            self._events.append(payload)
            self._event_cond.notify_all()
            return self._event_seq

    def get_events_since(self, last_event_id: int) -> List[Dict[str, Any]]:
        with self._event_cond:
            return [e for e in self._events if int(e.get("id", 0)) > last_event_id]

    def wait_for_events(
        self, *, last_event_id: int, timeout_s: float
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self._event_cond:
            if not any(int(e.get("id", 0)) > last_event_id for e in self._events):
                self._event_cond.wait(timeout=timeout_s)
            events = [e for e in self._events if int(e.get("id", 0)) > last_event_id]
            if events:
                last_event_id = int(events[-1].get("id", last_event_id))
            return events, last_event_id

    def update_state(self, **kwargs: Any) -> None:
        """Thread-safe method to update job state fields."""
        with self._event_cond:
            for key, value in kwargs.items():
                if hasattr(self, key) and not key.startswith('_'):
                    setattr(self, key, value)
            self.updated_at_s = time.time()


class JobStore:
    def __init__(self, root_dir: Path) -> None:
        self._root_dir = root_dir
        self._lock = threading.Lock()
        self._jobs: Dict[str, Job] = {}
        self._last_cleanup_s = 0.0  # For periodic cleanup (Bug 6 fix)

    def cleanup_old_jobs(self, *, max_age_s: int = 86400) -> int:
        """Remove completed/errored jobs older than max_age_s (24h default) - Bug 6 fix"""
        cutoff = time.time() - max_age_s
        to_remove: List[Tuple[str, Path]] = []
        with self._lock:
            for job_id, job in self._jobs.items():
                if job.status in {"complete", "error"} and job.updated_at_s < cutoff:
                    to_remove.append((job_id, job.work_dir))
            for job_id, _ in to_remove:
                del self._jobs[job_id]

        # Cleanup filesystem outside the lock
        import shutil

        for job_id, work_dir in to_remove:
            try:
                shutil.rmtree(work_dir, ignore_errors=False)
            except FileNotFoundError:
                # Already deleted elsewhere
                continue
            except Exception as exc:
                logger.warning("Failed to cleanup work dir for job %s: %s", job_id, exc)

        return len(to_remove)

    def _maybe_cleanup_jobs(self, *, interval_s: int = 3600) -> None:
        """Periodically cleanup (hourly) - Bug 6 fix"""
        now = time.time()
        if now - self._last_cleanup_s >= interval_s:
            self._last_cleanup_s = now
            self.cleanup_old_jobs()

    def create(self) -> Job:
        # Call cleanup periodically (Bug 6 fix)
        self._maybe_cleanup_jobs()

        job_id = uuid.uuid4().hex
        now = time.time()
        work_dir = (self._root_dir / "jobs" / job_id).resolve()

        # Hold lock during ALL state changes (Bug 7 fix - race condition)
        with self._lock:
            # Double-check job_id uniqueness
            while job_id in self._jobs:
                job_id = uuid.uuid4().hex
                work_dir = (self._root_dir / "jobs" / job_id).resolve()

            # Create directory while holding lock
            work_dir.mkdir(parents=True, exist_ok=True)
            job = Job(job_id=job_id, created_at_s=now, updated_at_s=now, work_dir=work_dir)
            self._jobs[job_id] = job

        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def _emit(self, job: Job, event: str, data: Dict[str, Any]) -> None:
        job.add_event(event, data)

    def start_generation(
        self,
        *,
        cfg: AppConfig,
        job: Job,
        script_text: str,
        preserve_stage_directions: bool,
        model: str,
        output_format: str,
        request_delay_ms: int,
        speak_parentheticals: bool,
        filename_prefix: str,
        character_configs: Dict[str, CharacterConfig],
    ) -> None:
        thread = threading.Thread(
            target=self._run_generation,
            daemon=True,
            kwargs={
                "cfg": cfg,
                "job": job,
                "script_text": script_text,
                "preserve_stage_directions": preserve_stage_directions,
                "model": model,
                "output_format": output_format,
                "request_delay_ms": request_delay_ms,
                "speak_parentheticals": speak_parentheticals,
                "filename_prefix": filename_prefix,
                "character_configs": character_configs,
            },
        )
        thread.start()

    def _run_generation(
        self,
        *,
        cfg: AppConfig,
        job: Job,
        script_text: str,
        preserve_stage_directions: bool,
        model: str,
        output_format: str,
        request_delay_ms: int,
        speak_parentheticals: bool,
        filename_prefix: str,
        character_configs: Dict[str, CharacterConfig],
    ) -> None:
        job.update_state(status="running")
        self._emit(job, "status", {"status": "running"})

        try:
            if not cfg.elevenlabs.api_key:
                raise RuntimeError("Missing ELEVENLABS_API_KEY")
            if not model:
                raise RuntimeError("Missing model id")
            if not output_format:
                raise RuntimeError("Missing output format")

            # Check disk space before starting (Bug 17 fix)
            check_disk_space(job.work_dir, 100 * 1024 * 1024)  # Estimate 100MB needed

            parsed = parse_script(script_text, preserve_stage_directions=preserve_stage_directions)
            job.update_state(total=len(parsed.dialogue_chunks))
            errors = validate_character_configs(parsed.dialogue_chunks, character_configs)
            if errors:
                raise RuntimeError("; ".join(errors))

            audio_dir = (job.work_dir / "audio").resolve()
            audio_dir.mkdir(parents=True, exist_ok=True)

            generated_files: List[str] = []
            start_times: List[int] = []
            end_times: List[int] = []
            alignments: List[Optional[List[WordTimestamp]]] = []

            def on_progress(p: GenerationProgress) -> None:
                job.update_state(
                    current=p.current,
                    total=p.total,
                    message=p.message,
                )
                self._emit(
                    job,
                    "progress",
                    {
                        "current": p.current,
                        "total": p.total,
                        "current_character": p.current_character,
                        "status": p.status,
                        "message": p.message,
                        "snippet": p.snippet,
                    },
                )

            client = ElevenLabsClient(cfg.elevenlabs)

            for generated in generate_all_audio_iter(
                client=client,
                dialogue_chunks=parsed.dialogue_chunks,
                character_configs=character_configs,
                model_id=model,
                output_format=output_format,
                filename_prefix=filename_prefix,
                delay_ms=request_delay_ms,
                speak_parentheticals=speak_parentheticals,
                fetch_alignment=True,
                on_progress=on_progress,
            ):
                self._write_generated_audio(audio_dir, generated)
                generated_files.append(generated.filename)
                start_times.append(generated.start_time_ms)
                end_times.append(generated.end_time_ms)
                alignments.append(generated.alignment)

            entries = build_manifest_entries(
                parsed.dialogue_chunks,
                generated_files,
                start_times_ms=start_times,
                end_times_ms=end_times,
                alignments=alignments,
            )

            manifest_json_path = (job.work_dir / "manifest.json").resolve()
            manifest_json_path.write_text(
                json.dumps([asdict(e) for e in entries], indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

            manifest_csv_path = (job.work_dir / "manifest.csv").resolve()
            manifest_csv_path.write_text(manifest_to_csv(entries), encoding="utf-8")

            srt_path = (job.work_dir / "subtitles.srt").resolve()
            srt_path.write_text(manifest_to_srt(entries), encoding="utf-8")

            vtt_path = (job.work_dir / "subtitles.vtt").resolve()
            vtt_path.write_text(manifest_to_vtt(entries), encoding="utf-8")

            rpp_path = (job.work_dir / "reaper.rpp").resolve()
            rpp_path.write_text(build_reaper_project(entries), encoding="utf-8")

            extra_paths: List[Tuple[str, Path]] = [
                ("subtitles.srt", srt_path),
                ("subtitles.vtt", vtt_path),
                ("reaper.rpp", rpp_path),
            ]

            export_path = (job.work_dir / "bundle.zip").resolve()
            audio_paths = [(name, (audio_dir / name).resolve()) for name in generated_files]
            build_zip_bundle_to_path(
                audio_files=audio_paths,
                manifest_entries=entries,
                output_path=export_path,
                extra_files=extra_paths,
            )
            job.update_state(export_path=export_path, status="complete", message="Complete" if not job.message else job.message)
            snap = job.snapshot()
            self._emit(
                job,
                "complete",
                {
                    "export_ready": snap.export_ready,
                    "message": job.message,
                },
            )
        except Exception as exc:
            import traceback

            # Log detailed error internally (Bug 8 fix - use logging, not print)
            logger.error("Job %s failed: %s\n%s", job.job_id, exc, traceback.format_exc())

            # Sanitize error for client (Bug 11 fix - prevent information disclosure)
            error_msg = "Generation failed"
            exc_str = str(exc).lower()
            if "quota" in exc_str:
                error_msg = "ElevenLabs quota exhausted"
            elif "rate limit" in exc_str:
                error_msg = "Rate limit reached"
            elif "401" in exc_str or "unauthorized" in exc_str:
                error_msg = "Authentication failed - check API key"

            # Clean up partial audio files on failure (Bug 14 fix)
            audio_dir = (job.work_dir / "audio").resolve()
            if audio_dir.exists():
                try:
                    import shutil

                    shutil.rmtree(audio_dir)
                    logger.info("Cleaned up audio dir for failed job %s", job.job_id)
                except Exception as cleanup_exc:
                    logger.warning(
                        "Failed to cleanup audio for job %s: %s", job.job_id, cleanup_exc
                    )

            job.update_state(status="error", error=error_msg, message="Error")
            self._emit(job, "job_error", {"error": error_msg})
        finally:
            snap = job.snapshot()
            self._emit(
                job,
                "done",
                {
                    "status": job.status,
                    "message": job.message,
                    "export_ready": snap.export_ready,
                },
            )

    def _write_generated_audio(self, audio_dir: Path, generated: GeneratedAudio) -> None:
        target = (audio_dir / generated.filename).resolve()
        audio_dir_resolved = audio_dir.resolve()
        try:
            target.relative_to(audio_dir_resolved)
        except ValueError as exc:
            raise ValueError("Invalid output filename") from exc
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(generated.audio_bytes)
