from __future__ import annotations

import io
import json
import zipfile
from dataclasses import asdict
from typing import Iterable, List, Tuple

from lib.manifest import manifest_to_csv
from lib.models import ManifestEntry


def build_zip_bundle(
    audio_files: Iterable[Tuple[str, bytes]],
    manifest_entries: List[ManifestEntry],
) -> bytes:
    """
    Returns a ZIP file as bytes:
    - audio files stored by filename
    - manifest.json + manifest.csv (when entries provided)
    """
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for filename, data in audio_files:
            safe_name = filename or "clip.mp3"
            zf.writestr(safe_name, data)

        if manifest_entries:
            zf.writestr(
                "manifest.json",
                json.dumps([asdict(e) for e in manifest_entries], indent=2),
            )
            zf.writestr("manifest.csv", manifest_to_csv(manifest_entries))

    return buffer.getvalue()
