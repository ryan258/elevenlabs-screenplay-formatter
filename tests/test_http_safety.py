from __future__ import annotations

from pathlib import Path

import pytest

from apps.api.http_safety import ensure_child_path, sanitize_fieldname, sanitize_filename


def test_sanitize_fieldname_strips_unsafe_chars() -> None:
    assert sanitize_fieldname("soundEffect_123") == "soundEffect_123"
    assert sanitize_fieldname("../evil") == "evil"
    assert sanitize_fieldname("a/b") == "ab"
    assert sanitize_fieldname("a b") == "ab"


def test_sanitize_filename_preserves_simple_names() -> None:
    assert sanitize_filename("hello.mp3") == "hello.mp3"
    assert sanitize_filename(" hello world .mp3 ") == "hello_world_.mp3"


def test_ensure_child_path_rejects_escape(tmp_path: Path) -> None:
    parent = tmp_path / "root"
    parent.mkdir()
    with pytest.raises(ValueError):
        ensure_child_path(parent, "../outside")
