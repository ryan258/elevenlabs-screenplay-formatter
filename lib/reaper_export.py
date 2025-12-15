from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional

from lib.models import ManifestEntry


def _seconds(ms: Optional[int]) -> str:
    return f"{((ms or 0) / 1000):.6f}"


def _escape_name(value: str) -> str:
    return value.replace('"', "'")


def _get_reaper_source_type(filename: str) -> str:
    if not filename:
        return "WAV"
    ext = filename.split(".")[-1].lower()
    if ext in {"wav", "wave", "pcm"}:
        return "WAV"
    if ext == "mp3":
        return "MP3"
    return "WAV"


def _build_item(entry: ManifestEntry) -> str:
    start = entry.start_time_ms or 0
    end = entry.end_time_ms if entry.end_time_ms is not None else (start + entry.estimated_duration_ms)
    length = max(0.001, (end - start) / 1000)
    source_type = _get_reaper_source_type(entry.filename)
    return "\n".join(
        [
            "    <ITEM",
            f"      POSITION {_seconds(start)}",
            f"      LENGTH {length:.6f}",
            "      MUTE 0",
            "      SEL 0",
            f'      NAME "{_escape_name(entry.character)} - {_escape_name(entry.filename)}"',
            "      SOFFS 0.000000",
            "      PLAYRATE 1.000000",
            "      SOURCETIME 0.000000",
            "      FADEIN 0 0 0 0 0 0",
            "      FADEOUT 0 0 0 0 0 0",
            "      SNAPOFFS 0.000000",
            "      LOOP 0",
            "      ALLTAKES 0",
            "      <TAKE",
            '        NAME ""',
            "        MUTE 0",
            "        PAN 0.000000",
            "        VOL 1.000000",
            "        PITCH 0.000000",
            "        PLAYRATE 1.000000",
            "        SOFFS 0.000000",
            "        STARTOFFS 0.000000",
            "        SEL 1",
            f"        <SOURCE {source_type}",
            f'          FILE "{_escape_name(entry.filename)}"',
            "        >",
            "      >",
            "    >",
        ]
    )


def build_reaper_project(entries: List[ManifestEntry], project_name: str = "ElevenLabs Session") -> str:
    tracks: Dict[str, List[ManifestEntry]] = defaultdict(list)
    for entry in entries:
        key = entry.character or "Dialogue"
        tracks[key].append(entry)

    track_blocks: List[str] = []
    for character, items in tracks.items():
        sorted_items = sorted(items, key=lambda e: (e.start_time_ms or 0))
        item_blocks = "\n".join(_build_item(item) for item in sorted_items)
        track_blocks.append(
            "\n".join(
                [
                    "  <TRACK",
                    "    MUTE 0",
                    "    SOLO 0",
                    "    VOLPAN 1.000000 0.000000 -1.000000 -1.000000 1",
                    f'    NAME "{_escape_name(character)}"',
                    "    PEAKCOL 16576",
                    "    <ITEMS",
                    item_blocks,
                    "    >",
                    "  >",
                ]
            )
        )

    return "\n".join(
        [
            '<REAPER_PROJECT 0.1 "6.0/x64" 0',
            f'  NAME "{_escape_name(project_name)}"',
            "  RIPPLE 0",
            "  GROUPOVERRIDE 0 0 0",
            "  AUTOXFADE 1",
            "  ENVATTACH 1",
            "  PROJOFFS 0 0 0",
            "  PLAYRATE 1 0 0.25 4",
            "  SELECTION 0 0",
            "  SEQSEL 0 0",
            "\n".join(track_blocks),
            ">",
        ]
    )

