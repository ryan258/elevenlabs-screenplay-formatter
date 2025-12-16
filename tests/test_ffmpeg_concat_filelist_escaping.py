from __future__ import annotations

from pathlib import Path

import pytest

from lib.audio.ffmpeg import _escape_ffmpeg_concat_filelist_path


def test_escape_ffmpeg_concat_filelist_path_escapes_single_quotes(tmp_path: Path) -> None:
    path = tmp_path / "O'NEIL.mp3"
    escaped = _escape_ffmpeg_concat_filelist_path(path)
    assert escaped.endswith("O\\'NEIL.mp3")


def test_escape_ffmpeg_concat_filelist_path_escapes_backslashes(tmp_path: Path) -> None:
    path = tmp_path / r"clip\name.mp3"
    escaped = _escape_ffmpeg_concat_filelist_path(path)
    assert "clip\\\\name.mp3" in escaped


def test_escape_ffmpeg_concat_filelist_path_rejects_newlines(tmp_path: Path) -> None:
    path = Path(str(tmp_path / "bad") + "\nname.mp3")
    with pytest.raises(ValueError):
        _escape_ffmpeg_concat_filelist_path(path)

