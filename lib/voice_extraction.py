from __future__ import annotations

import re
from typing import Dict


_VOICE_ID_RE = re.compile(r"^\s*-\s*([A-Z0-9\s]+?)\s*\(Voice ID:\s*([a-zA-Z0-9]+)", re.M)


def extract_voice_ids_from_script(script_text: str) -> Dict[str, str]:
    """
    Expected line format:
      - CHARACTER NAME (Voice ID: abc123...)
    Returns { "CHARACTER NAME": "abc123" }.
    """
    voice_ids: Dict[str, str] = {}
    for match in _VOICE_ID_RE.finditer(script_text):
        character_name = match.group(1).strip()
        voice_id = match.group(2).strip()
        if character_name and voice_id:
            voice_ids[character_name] = voice_id
    return voice_ids

