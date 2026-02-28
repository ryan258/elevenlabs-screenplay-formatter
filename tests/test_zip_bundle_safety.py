from __future__ import annotations

from lib.exports.zip_bundle import build_zip_bundle
from lib.models import ManifestEntry


def test_zip_bundle_strips_path_components() -> None:
    zip_bytes = build_zip_bundle(
        audio_files=[("../evil.mp3", b"data"), ("nested/ok.mp3", b"data2")],
        manifest_entries=[
            ManifestEntry(
                index=0,
                character="A",
                filename="ok.mp3",
                text="Hello",
                estimated_duration_ms=1000,
            )
        ],
    )
    assert zip_bytes.startswith(b"PK")
