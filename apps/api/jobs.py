from __future__ import annotations

from collections import deque
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Tuple

from apps.api.config import AppConfig
from lib.audio.ffmpeg import concat_audio
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle_to_path
from lib.generation import GeneratedAudio, GenerationProgress, generate_all_audio_iter
from lib.manifest import build_manifest_entries, manifest_to_srt, manifest_to_vtt
from lib.models import CharacterConfig, WordTimestamp
from lib.parser import parse_script
from lib.reaper_export import build_reaper_project
from lib.validation import validate_character_configs


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

    def wait_for_events(self, *, last_event_id: int, timeout_s: float) -> Tuple[List[Dict[str, Any]], int]:
        with self._event_cond:
            if not any(int(e.get("id", 0)) > last_event_id for e in self._events):
                self._event_cond.wait(timeout=timeout_s)
            events = [e for e in self._events if int(e.get("id", 0)) > last_event_id]
            if events:
                last_event_id = int(events[-1].get("id", last_event_id))
            return events, last_event_id


class JobStore:
    def __init__(self, root_dir: Path) -> None:
        self._root_dir = root_dir
        self._lock = threading.Lock()
        self._jobs: Dict[str, Job] = {}

    def create(self) -> Job:
        job_id = uuid.uuid4().hex
        now = time.time()
        work_dir = (self._root_dir / "jobs" / job_id).resolve()
        work_dir.mkdir(parents=True, exist_ok=True)
        job = Job(job_id=job_id, created_at_s=now, updated_at_s=now, work_dir=work_dir)
        with self._lock:
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
        concatenate: bool,
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
                "concatenate": concatenate,
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
        concatenate: bool,
        filename_prefix: str,
        character_configs: Dict[str, CharacterConfig],
    ) -> None:
        job.status = "running"
        job.updated_at_s = time.time()
        self._emit(job, "status", {"status": "running"})

        try:
            if not cfg.elevenlabs.api_key:
                raise RuntimeError("Missing ELEVENLABS_API_KEY")
            if not model:
                raise RuntimeError("Missing model id")
            if not output_format:
                raise RuntimeError("Missing output format")

            parsed = parse_script(script_text, preserve_stage_directions=preserve_stage_directions)
            job.total = len(parsed.dialogue_chunks)
            job.updated_at_s = time.time()
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
                job.current = p.current
                job.total = p.total
                job.message = p.message
                job.updated_at_s = time.time()
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

            if concatenate:
                # Use the already-written per-line clips and build a single timeline render.
                ext = "wav" if str(output_format).startswith("pcm_") else "mp3"
                concat_path = (job.work_dir / f"concatenated_audio.{ext}").resolve()
                concat_audio(cfg.ffmpeg, [(audio_dir / name).resolve() for name in generated_files], concat_path)
                extra_paths.append((concat_path.name, concat_path))

            export_path = (job.work_dir / "bundle.zip").resolve()
            audio_paths = [(name, (audio_dir / name).resolve()) for name in generated_files]
            build_zip_bundle_to_path(
                audio_files=audio_paths,
                manifest_entries=entries,
                output_path=export_path,
                extra_files=extra_paths,
            )
            job.export_path = export_path
            job.status = "complete"
            job.message = "Complete"
            job.updated_at_s = time.time()
            self._emit(job, "complete", {"export_ready": True})
        except Exception as exc:
            job.status = "error"
            job.error = str(exc)
            job.message = "Error"
            job.updated_at_s = time.time()
            self._emit(job, "job_error", {"error": str(exc)})
        finally:
            self._emit(job, "done", {"status": job.status})

    def _write_generated_audio(self, audio_dir: Path, generated: GeneratedAudio) -> None:
        target = (audio_dir / generated.filename).resolve()
        audio_dir_resolved = audio_dir.resolve()
        try:
            target.relative_to(audio_dir_resolved)
        except ValueError as exc:
            raise ValueError("Invalid output filename") from exc
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(generated.audio_bytes)
