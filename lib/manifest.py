from __future__ import annotations

from dataclasses import replace
from typing import Iterable, List, Optional

from lib.models import DialogueChunk, ManifestEntry, WordTimestamp

WORDS_PER_MINUTE = 150


def estimate_duration_ms(text: str) -> int:
    word_count = len([w for w in text.split() if w])
    return round((word_count / WORDS_PER_MINUTE) * 60 * 1000)


def _format_timestamp(ms: int, fmt: str) -> str:
    clamped = max(0, int(round(ms)))
    hours = clamped // 3_600_000
    minutes = (clamped % 3_600_000) // 60_000
    seconds = (clamped % 60_000) // 1000
    milliseconds = clamped % 1000
    separator = "," if fmt == "srt" else "."
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}{separator}{milliseconds:03d}"


def _ensure_timing_entries(entries: Iterable[ManifestEntry]) -> List[ManifestEntry]:
    cursor = 0
    timed: List[ManifestEntry] = []
    for entry in entries:
        start = entry.start_time_ms if entry.start_time_ms is not None else cursor
        fallback = entry.estimated_duration_ms or estimate_duration_ms(entry.text)
        end = entry.end_time_ms if entry.end_time_ms is not None else (start + fallback)
        cursor = end
        timed.append(replace(entry, start_time_ms=start, end_time_ms=end))
    return timed


def build_manifest_entries(
    chunks: List[DialogueChunk],
    filenames: List[str],
    start_times_ms: Optional[List[int]] = None,
    end_times_ms: Optional[List[int]] = None,
    alignments: Optional[List[Optional[List[WordTimestamp]]]] = None,
) -> List[ManifestEntry]:
    running_start = 0
    entries: List[ManifestEntry] = []
    for index, chunk in enumerate(chunks):
        filename = filenames[index] if index < len(filenames) else ""
        start = (
            (start_times_ms[index] if start_times_ms and index < len(start_times_ms) else None)
            or chunk.start_time_ms
            or running_start
        )
        end_override = end_times_ms[index] if end_times_ms and index < len(end_times_ms) else None
        estimated = (
            (end_override - start) if end_override is not None else estimate_duration_ms(chunk.text)
        )
        end = end_override or chunk.end_time_ms or (start + estimated)
        running_start = end
        words = alignments[index] if alignments and index < len(alignments) else chunk.words
        entries.append(
            ManifestEntry(
                index=index,
                character=chunk.character,
                filename=filename,
                text=chunk.text,
                estimated_duration_ms=int(estimated),
                start_time_ms=start,
                end_time_ms=end,
                words=words,
            )
        )
    return entries


def manifest_to_csv(entries: List[ManifestEntry]) -> str:
    header = "index,character,filename,text,estimatedDurationMs,startTimeMs,endTimeMs"

    def csv_quote(value: str) -> str:
        return '"' + value.replace('"', '""') + '"'

    rows: List[str] = []
    for entry in entries:
        escaped_character = csv_quote(entry.character)
        escaped_filename = csv_quote(entry.filename)
        escaped_text = csv_quote(entry.text)
        start = "" if entry.start_time_ms is None else str(entry.start_time_ms)
        end = "" if entry.end_time_ms is None else str(entry.end_time_ms)
        rows.append(
            f"{entry.index + 1},{escaped_character},{escaped_filename},{escaped_text},"
            f"{entry.estimated_duration_ms},{start},{end}"
        )
    return "\n".join([header, *rows])


def manifest_to_srt(entries: List[ManifestEntry]) -> str:
    timed = _ensure_timing_entries(entries)
    blocks: List[str] = []
    for entry in timed:
        start = _format_timestamp(entry.start_time_ms or 0, "srt")
        end = _format_timestamp(entry.end_time_ms or 0, "srt")
        blocks.append(f"{entry.index + 1}\n{start} --> {end}\n{entry.text}\n")
    return "\n".join(blocks).strip()


def manifest_to_vtt(entries: List[ManifestEntry]) -> str:
    timed = _ensure_timing_entries(entries)
    cues: List[str] = []
    for entry in timed:
        start = _format_timestamp(entry.start_time_ms or 0, "vtt")
        end = _format_timestamp(entry.end_time_ms or 0, "vtt")
        cues.append(f"{start} --> {end}\n{entry.text}\n")
    return ("WEBVTT\n\n" + "\n".join(cues)).strip()
