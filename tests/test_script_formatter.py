from __future__ import annotations

from lib.diagnostics import build_line_info
from lib.models import ParserUnmatchedLine
from lib.script_formatter import format_script


def test_format_script_uppercases_character_cues() -> None:
    script = "INT. HOUSE\n\njohn\nHello there.\n"
    result = format_script(script)
    assert "JOHN" in result.formatted_text
    assert result.changed


def test_format_script_adds_character_list() -> None:
    script = "JANE\nHi.\n"
    result = format_script(script)
    assert result.formatted_text.startswith("Characters:\n- JANE\n")


def test_format_script_normalizes_whitespace() -> None:
    script = "JOHN\t\nHello  there.\n"
    result = format_script(script)
    assert "\t" not in result.formatted_text
    assert "  " not in result.formatted_text


def test_build_line_info_marks_unmatched() -> None:
    lines = "LINE ONE\nLINE TWO\nLINE THREE"
    unmatched = [ParserUnmatchedLine(line_number=2, content="LINE TWO")]
    info = build_line_info(lines, unmatched)
    assert info[1].is_unmatched is True
