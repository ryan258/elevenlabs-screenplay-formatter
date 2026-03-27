from __future__ import annotations

from pathlib import Path

from lib.parser import parse_script


def test_parse_script_examples_have_output() -> None:
    screenplay = Path("EXAMPLE_SCREENPLAY.md").read_text(encoding="utf-8")
    parsed = parse_script(screenplay)
    assert parsed.characters
    assert parsed.dialogue_chunks


def test_parse_fountain_examples_have_output() -> None:
    fountain = Path("EXAMPLE_FOUNTAIN.md").read_text(encoding="utf-8")
    parsed = parse_script(fountain)
    assert parsed.dialogue_chunks


def test_parse_script_records_unmatched_lines() -> None:
    parsed = parse_script("INT. HOUSE\nThis is not dialogue\n\nJOHN\nHello")
    assert any(
        item.content == "This is not dialogue" for item in parsed.diagnostics.unmatched_lines
    )


def test_parse_script_keeps_interrupted_dialogue_as_dialogue() -> None:
    parsed = parse_script("Characters:\n- JEAN\n- NARRATOR\n\nJEAN\nI...\n\nNARRATOR\nAnd then it passes.")

    assert parsed.characters == ["JEAN", "NARRATOR"]
    assert [(chunk.character, chunk.text) for chunk in parsed.dialogue_chunks] == [
        ("JEAN", "I..."),
        ("NARRATOR", "And then it passes."),
    ]
