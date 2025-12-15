from __future__ import annotations

from lib.manifest import manifest_to_csv, manifest_to_srt, manifest_to_vtt
from lib.models import ManifestEntry


def test_manifest_csv_quotes_text() -> None:
    csv = manifest_to_csv(
        [
            ManifestEntry(
                index=0,
                character="A",
                filename="a.mp3",
                text='He said "hi"',
                estimated_duration_ms=1000,
                start_time_ms=0,
                end_time_ms=1000,
            )
        ]
    )
    assert '"He said ""hi"""' in csv


def test_manifest_srt_and_vtt_format() -> None:
    entries = [
        ManifestEntry(
            index=0,
            character="A",
            filename="a.mp3",
            text="Hello",
            estimated_duration_ms=1000,
        )
    ]
    srt = manifest_to_srt(entries)
    vtt = manifest_to_vtt(entries)
    assert "1" in srt
    assert "WEBVTT" in vtt

