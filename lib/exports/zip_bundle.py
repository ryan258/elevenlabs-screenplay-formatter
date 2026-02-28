from __future__ import annotations

import io
import json
import zipfile
from dataclasses import asdict
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

from lib.filenames import safe_basename
from lib.manifest import manifest_to_csv
from lib.models import ManifestEntry


def _sanitize_manifest_entries(
    manifest_entries: List[ManifestEntry],
    *,
    safe_audio_names: List[str],
) -> List[ManifestEntry]:
    if not manifest_entries:
        return []

    sanitized: List[ManifestEntry] = []
    for entry in manifest_entries:
        if 0 <= entry.index < len(safe_audio_names):
            filename = safe_audio_names[entry.index]
        else:
            filename = safe_basename(entry.filename, default="clip.mp3")

        sanitized.append(
            ManifestEntry(
                index=entry.index,
                character=entry.character,
                filename=filename,
                text=entry.text,
                estimated_duration_ms=entry.estimated_duration_ms,
                start_time_ms=entry.start_time_ms,
                end_time_ms=entry.end_time_ms,
                words=entry.words,
            )
        )
    return sanitized


def build_zip_bundle(
    audio_files: Iterable[Tuple[str, bytes]],
    manifest_entries: List[ManifestEntry],
    *,
    extra_files: Optional[Iterable[Tuple[str, bytes]]] = None,
) -> bytes:
    """
    Returns a ZIP file as bytes:
    - audio files stored by filename
    - manifest.json + manifest.csv (when entries provided)
    """
    buffer = io.BytesIO()
    safe_audio_names: List[str] = []
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for index, (filename, data) in enumerate(audio_files):
            safe_name = safe_basename(filename, default=f"clip_{index:04d}.mp3")
            safe_audio_names.append(safe_name)
            zf.writestr(safe_name, data)

        if manifest_entries:
            sanitized_entries = _sanitize_manifest_entries(
                manifest_entries, safe_audio_names=safe_audio_names
            )
            zf.writestr(
                "manifest.json",
                json.dumps([asdict(e) for e in sanitized_entries], indent=2, ensure_ascii=False),
            )
            zf.writestr("manifest.csv", manifest_to_csv(sanitized_entries))

        if extra_files:
            for name, data in extra_files:
                safe_name = safe_basename(name, default="file")
                zf.writestr(safe_name, data)

    return buffer.getvalue()


def build_zip_bundle_to_path(
    *,
    audio_files: Iterable[Tuple[str, Path]],
    manifest_entries: List[ManifestEntry],
    output_path: Path,
    extra_files: Optional[Iterable[Tuple[str, Path]]] = None,
) -> None:
    """
    Writes a ZIP file to disk:
    - audio files stored by filename (sanitized)
    - manifest.json + manifest.csv (when entries provided)
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    safe_audio_names: List[str] = []
    with zipfile.ZipFile(output_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for filename, path in audio_files:
            safe_name = safe_basename(filename, default=path.name)
            safe_audio_names.append(safe_name)
            zf.write(path, arcname=safe_name)

        if manifest_entries:
            sanitized_entries = _sanitize_manifest_entries(
                manifest_entries, safe_audio_names=safe_audio_names
            )
            zf.writestr(
                "manifest.json",
                json.dumps([asdict(e) for e in sanitized_entries], indent=2, ensure_ascii=False),
            )
            zf.writestr("manifest.csv", manifest_to_csv(sanitized_entries))

        if extra_files:
            for name, path in extra_files:
                safe_name = safe_basename(name, default=path.name)
                zf.write(path, arcname=safe_name)
