from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, List

from lib.models import DialogueChunk, ParserUnmatchedLine


@dataclass(frozen=True)
class ScriptLineInfo:
    line_number: int
    content: str
    is_unmatched: bool


@dataclass(frozen=True)
class DialogueGroup:
    character: str
    lines: List[DialogueChunk]


def build_line_info(
    script_text: str, unmatched_lines: List[ParserUnmatchedLine]
) -> List[ScriptLineInfo]:
    unmatched_set = {item.line_number for item in unmatched_lines}
    lines = script_text.split("\n")
    return [
        ScriptLineInfo(
            line_number=index + 1,
            content=line,
            is_unmatched=(index + 1) in unmatched_set,
        )
        for index, line in enumerate(lines)
    ]


def group_dialogue_by_character(chunks: List[DialogueChunk]) -> List[DialogueGroup]:
    grouped: Dict[str, List[DialogueChunk]] = OrderedDict()
    for chunk in chunks:
        key = chunk.character or "UNKNOWN"
        grouped.setdefault(key, []).append(chunk)
    return [DialogueGroup(character=key, lines=items) for key, items in grouped.items()]
