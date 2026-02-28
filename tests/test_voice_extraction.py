from __future__ import annotations

from lib.voice_extraction import extract_voice_ids_from_script


def test_extract_voice_ids_from_script() -> None:
    script = """
Characters:
- JOHN DOE (Voice ID: abc123) - Lead
- JANE (Voice ID: z9Z9Z9)
"""
    assert extract_voice_ids_from_script(script) == {"JOHN DOE": "abc123", "JANE": "z9Z9Z9"}
