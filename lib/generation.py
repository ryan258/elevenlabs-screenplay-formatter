from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable, Dict, Iterator, List, Optional, Tuple

from lib.elevenlabs.client import ElevenLabsClient, _adjust_delay_based_on_rate_limit
from lib.filenames import safe_basename
from lib.manifest import estimate_duration_ms
from lib.models import CharacterConfig, DialogueChunk, WordTimestamp


OUTPUT_FORMAT_DETAILS: Dict[str, Tuple[str, str]] = {
    "mp3_44100_128": ("mp3", "audio/mpeg"),
    "mp3_44100_192": ("mp3", "audio/mpeg"),
    "pcm_24000": ("wav", "audio/wav"),
}


@dataclass(frozen=True)
class GenerationProgress:
    current: int
    total: int
    current_character: str
    status: str  # generating | downloading | complete | error
    message: str
    snippet: Optional[str] = None


@dataclass(frozen=True)
class GeneratedAudio:
    filename: str
    audio_bytes: bytes
    start_time_ms: int
    end_time_ms: int
    alignment: Optional[List[WordTimestamp]]


class GenerationError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        failed_index: int,
        failed_character: str,
        completed: List[GeneratedAudio],
    ) -> None:
        super().__init__(message)
        self.failed_index = failed_index
        self.failed_character = failed_character
        self.completed = completed


def _get_format_details(output_format: str) -> Tuple[str, str]:
    return OUTPUT_FORMAT_DETAILS.get(output_format, OUTPUT_FORMAT_DETAILS["mp3_44100_128"])


def _clip_context(text: Optional[str], *, max_chars: int) -> Optional[str]:
    if not text:
        return None
    clipped = text.strip()
    if not clipped:
        return None
    if len(clipped) <= max_chars:
        return clipped
    return clipped[: max(0, max_chars)].rstrip()


def _get_spoken_text(chunk: DialogueChunk, *, speak_parentheticals: bool) -> str:
    return chunk.original_text if (speak_parentheticals and chunk.original_text) else chunk.text


def generate_all_audio_iter(
    *,
    client: ElevenLabsClient,
    dialogue_chunks: List[DialogueChunk],
    character_configs: Dict[str, CharacterConfig],
    model_id: str,
    output_format: str,
    filename_prefix: str = "",
    delay_ms: int = 500,
    speak_parentheticals: bool = False,
    fetch_alignment: bool = True,
    on_progress: Optional[Callable[[GenerationProgress], None]] = None,
) -> Iterator[GeneratedAudio]:
    total = len(dialogue_chunks)
    extension, accept = _get_format_details(output_format)

    base_delay = max(0, int(delay_ms))
    adaptive_delay = base_delay

    timeline_cursor = 0
    completed: List[GeneratedAudio] = []

    for index, chunk in enumerate(dialogue_chunks):
        cfg = character_configs.get(chunk.character)
        if cfg is None or not cfg.voice_id:
            raise GenerationError(
                f"No voice configuration found for character: {chunk.character}",
                failed_index=index,
                failed_character=chunk.character,
                completed=completed,
            )

        snippet = (chunk.text or "").strip()[:80]
        if on_progress:
            on_progress(
                GenerationProgress(
                    current=index + 1,
                    total=total,
                    current_character=chunk.character,
                    status="generating",
                    message=f"Generating audio for {chunk.character}...",
                    snippet=snippet,
                )
            )

        try:
            text = _get_spoken_text(chunk, speak_parentheticals=speak_parentheticals)
            previous_text = _clip_context(
                _get_spoken_text(dialogue_chunks[index - 1], speak_parentheticals=speak_parentheticals)
                if index > 0
                else None,
                max_chars=500,
            )
            next_text = _clip_context(
                _get_spoken_text(dialogue_chunks[index + 1], speak_parentheticals=speak_parentheticals)
                if index + 1 < len(dialogue_chunks)
                else None,
                max_chars=500,
            )
            audio_bytes, remaining = client.generate_audio(
                voice_id=cfg.voice_id,
                text=text,
                model_id=model_id,
                output_format=output_format,
                voice_settings=cfg.voice_settings,
                previous_text=previous_text,
                next_text=next_text,
                accept=accept,
                base_delay_ms=base_delay,
            )

            alignment: Optional[List[WordTimestamp]] = None
            if fetch_alignment:
                alignment = client.fetch_alignment(voice_id=cfg.voice_id, text=chunk.text, model_id=model_id)

            if alignment:
                offset_alignment = [
                    WordTimestamp(
                        word=w.word,
                        start_ms=w.start_ms + timeline_cursor,
                        end_ms=w.end_ms + timeline_cursor,
                    )
                    for w in alignment
                ]
                start_time_ms = offset_alignment[0].start_ms
                end_time_ms = offset_alignment[-1].end_ms
                timeline_cursor = end_time_ms
                final_alignment = offset_alignment
            else:
                start_time_ms = timeline_cursor
                duration = estimate_duration_ms(chunk.text)
                end_time_ms = start_time_ms + duration
                timeline_cursor = end_time_ms
                final_alignment = None

            base_filename = f"{index:04d}_{chunk.character.replace(' ', '_')}.{extension}"
            raw_name = f"{filename_prefix}_{base_filename}" if filename_prefix else base_filename
            filename = safe_basename(raw_name, default=base_filename)

            generated = GeneratedAudio(
                filename=filename,
                audio_bytes=audio_bytes,
                start_time_ms=start_time_ms,
                end_time_ms=end_time_ms,
                alignment=final_alignment,
            )
            completed.append(generated)
            yield generated

            if on_progress:
                on_progress(
                    GenerationProgress(
                        current=index + 1,
                        total=total,
                        current_character=chunk.character,
                        status="complete",
                        message=f"✓ Completed {chunk.character}",
                        snippet=snippet,
                    )
                )

            adaptive_delay = _adjust_delay_based_on_rate_limit(remaining, adaptive_delay, base_delay)
            if index < total - 1 and adaptive_delay > 0:
                time.sleep(adaptive_delay / 1000)
        except Exception as exc:
            if on_progress:
                on_progress(
                    GenerationProgress(
                        current=index + 1,
                        total=total,
                        current_character=chunk.character,
                        status="error",
                        message=f"✗ Failed: {exc}",
                        snippet=snippet,
                    )
                )
            raise GenerationError(
                str(exc),
                failed_index=index,
                failed_character=chunk.character,
                completed=completed,
            ) from exc


def generate_all_audio(
    *,
    client: ElevenLabsClient,
    dialogue_chunks: List[DialogueChunk],
    character_configs: Dict[str, CharacterConfig],
    model_id: str,
    output_format: str,
    filename_prefix: str = "",
    delay_ms: int = 500,
    speak_parentheticals: bool = False,
    fetch_alignment: bool = True,
    on_progress: Optional[Callable[[GenerationProgress], None]] = None,
) -> List[GeneratedAudio]:
    return list(
        generate_all_audio_iter(
            client=client,
            dialogue_chunks=dialogue_chunks,
            character_configs=character_configs,
            model_id=model_id,
            output_format=output_format,
            filename_prefix=filename_prefix,
            delay_ms=delay_ms,
            speak_parentheticals=speak_parentheticals,
            fetch_alignment=fetch_alignment,
            on_progress=on_progress,
        )
    )
