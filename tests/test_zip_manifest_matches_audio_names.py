from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

from lib.exports.zip_bundle import build_zip_bundle, build_zip_bundle_to_path
from lib.models import ManifestEntry


def test_zip_manifest_filenames_match_sanitized_audio_names(tmp_path: Path) -> None:
    audio_0 = tmp_path / "a.bin"
    audio_1 = tmp_path / "b.bin"
    audio_0.write_bytes(b"a")
    audio_1.write_bytes(b"b")

    manifest = [
        ManifestEntry(index=0, character="A", filename="../evil.mp3", text="Hi", estimated_duration_ms=1000),
        ManifestEntry(index=1, character="B", filename="nested/ok.mp3", text="Yo", estimated_duration_ms=1000),
    ]

    out = tmp_path / "bundle.zip"
    build_zip_bundle_to_path(
        audio_files=[("../evil.mp3", audio_0), ("nested/ok.mp3", audio_1)],
        manifest_entries=manifest,
        output_path=out,
    )

    with zipfile.ZipFile(out, "r") as zf:
        names = set(zf.namelist())
        assert "evil.mp3" in names
        assert "ok.mp3" in names
        manifest_data = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert [row["filename"] for row in manifest_data] == ["evil.mp3", "ok.mp3"]


def test_zip_bytes_manifest_filenames_match_sanitized_audio_names() -> None:
    manifest = [
        ManifestEntry(index=0, character="A", filename="../evil.mp3", text="Hi", estimated_duration_ms=1000),
        ManifestEntry(index=1, character="B", filename="nested/ok.mp3", text="Yo", estimated_duration_ms=1000),
    ]

    zip_bytes = build_zip_bundle(
        audio_files=[("../evil.mp3", b"a"), ("nested/ok.mp3", b"b")],
        manifest_entries=manifest,
    )

    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        names = set(zf.namelist())
        assert "evil.mp3" in names
        assert "ok.mp3" in names
        manifest_data = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert [row["filename"] for row in manifest_data] == ["evil.mp3", "ok.mp3"]


def test_zip_manifest_out_of_bounds_uses_safe_default() -> None:
    manifest = [
        ManifestEntry(index=99, character="A", filename="..", text="Hi", estimated_duration_ms=1000),
    ]
    zip_bytes = build_zip_bundle(
        audio_files=[("ok.mp3", b"a")],
        manifest_entries=manifest,
    )

    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        manifest_data = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert manifest_data[0]["filename"] == "clip.mp3"
