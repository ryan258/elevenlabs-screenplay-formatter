from __future__ import annotations

import json
from pathlib import Path

import pytest

from lib.audio.ffmpeg import parse_mix_config_json


def test_parse_mix_config_json_requires_child_files(tmp_path: Path) -> None:
    upload_dir = tmp_path / "u"
    upload_dir.mkdir()
    (upload_dir / "backgroundTrack").write_bytes(b"x")
    (upload_dir / "soundEffect_1").write_bytes(b"x")

    payload = json.dumps(
        {
            "background": {"ref": "backgroundTrack", "volume": 0.3},
            "soundEffects": [{"ref": "soundEffect_1", "startTimeMs": 123, "volume": 0.9, "label": "s"}],
        }
    )
    mix = parse_mix_config_json(payload, upload_dir=upload_dir)
    assert mix.background is not None
    assert mix.background.path == (upload_dir / "backgroundTrack").resolve()
    assert mix.sound_effects


def test_parse_mix_config_json_rejects_traversal(tmp_path: Path) -> None:
    upload_dir = tmp_path / "u"
    upload_dir.mkdir()
    payload = json.dumps({"background": {"ref": "../evil", "volume": 0.3}, "soundEffects": []})
    with pytest.raises(ValueError):
        parse_mix_config_json(payload, upload_dir=upload_dir)

