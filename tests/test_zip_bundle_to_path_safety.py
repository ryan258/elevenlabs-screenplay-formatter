from __future__ import annotations

import zipfile
from pathlib import Path

from lib.exports.zip_bundle import build_zip_bundle_to_path
from lib.models import ManifestEntry


def test_build_zip_bundle_to_path_strips_paths(tmp_path: Path) -> None:
    audio_path = tmp_path / "audio.bin"
    audio_path.write_bytes(b"data")
    out = tmp_path / "bundle.zip"

    build_zip_bundle_to_path(
        audio_files=[("../evil.mp3", audio_path), ("nested/ok.mp3", audio_path)],
        manifest_entries=[
            ManifestEntry(
                index=0,
                character="A",
                filename="../evil.mp3",
                text="Hello",
                estimated_duration_ms=1000,
            )
        ],
        output_path=out,
    )

    with zipfile.ZipFile(out, "r") as zf:
        names = zf.namelist()
        assert "evil.mp3" in names
        assert "ok.mp3" in names
