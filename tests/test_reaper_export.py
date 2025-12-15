from __future__ import annotations

from lib.models import ManifestEntry
from lib.reaper_export import build_reaper_project


def test_reaper_project_contains_track_and_item() -> None:
    project = build_reaper_project(
        [
            ManifestEntry(
                index=0,
                character="JOHN",
                filename="0000_JOHN.mp3",
                text="Hello",
                estimated_duration_ms=1000,
                start_time_ms=0,
                end_time_ms=1000,
            )
        ],
        project_name="Test",
    )
    assert "<REAPER_PROJECT" in project
    assert 'NAME "Test"' in project
    assert 'NAME "JOHN"' in project

