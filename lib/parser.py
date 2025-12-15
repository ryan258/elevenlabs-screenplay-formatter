from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Set

from lib.models import DialogueChunk, ParserDiagnostics, ParserUnmatchedLine


@dataclass(frozen=True)
class ParsedScript:
    characters: List[str]
    dialogue_chunks: List[DialogueChunk]
    diagnostics: ParserDiagnostics


_SCENE_HEADING_RE = re.compile(r"^(INT\.?|EXT\.?|I\/E\.?|SCENE \d+|EST\.|INT\/EXT\.?|\.)", re.I)
_TRANSITION_RE = re.compile(
    r"(CUT TO:|FADE (IN|OUT)|SMASH CUT|MATCH CUT|DISSOLVE TO:|IRIS OUT|WIPE TO:)", re.I
)
_SAME_LINE_DIALOGUE_RE = re.compile(r'^([A-Z0-9\s()."\'-]+):\s*(.*)')
_UPPERCASE_CHARACTER_RE = re.compile(r"^[A-Z][A-Z0-9\s.'\"()-]*$")


def clean_dialogue(text: str, preserve_brackets: bool = False) -> str:
    cleaned = re.sub(r"\([^)]+\)", "", text)
    if not preserve_brackets:
        cleaned = re.sub(r"\[[^\]]+\]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def normalize_character_name(value: str) -> str:
    normalized = re.sub(r"\([^)]*\)", "", value)
    normalized = re.sub(r"\bCONT'D\b", "", normalized, flags=re.I)
    normalized = re.sub(r"[^A-Z0-9\s'\"-]", " ", normalized, flags=re.I)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip().upper()


def generate_aliases(full_name: str) -> Set[str]:
    aliases: Set[str] = set()
    tokens = [token for token in full_name.split(" ") if token]
    if not tokens:
        return aliases

    def add_alias(parts: List[str]) -> None:
        if parts:
            aliases.add(" ".join(parts))

    add_alias(tokens)
    for token in tokens:
        add_alias([token])

    for start in range(len(tokens)):
        for end in range(start + 1, len(tokens)):
            add_alias(tokens[start : end + 1])

    if len(tokens) >= 2:
        add_alias([tokens[0], tokens[-1]])

    return aliases


@dataclass
class _DefinedCharacter:
    full_name: str
    aliases: Set[str]


def parse_script(script_text: str, preserve_stage_directions: bool = False) -> ParsedScript:
    if not script_text:
        return ParsedScript(
            characters=[],
            dialogue_chunks=[],
            diagnostics=ParserDiagnostics(unmatched_lines=[]),
        )

    lines = script_text.split("\n")
    chunks: List[DialogueChunk] = []
    defined_characters: List[_DefinedCharacter] = []
    alias_map: Dict[str, _DefinedCharacter] = {}
    full_name_map: Dict[str, _DefinedCharacter] = {}
    unmatched_lines: List[ParserUnmatchedLine] = []

    def add_character(full_name: str) -> _DefinedCharacter:
        existing = full_name_map.get(full_name)
        if existing:
            return existing
        new_character = _DefinedCharacter(full_name=full_name, aliases=generate_aliases(full_name))
        defined_characters.append(new_character)
        full_name_map[full_name] = new_character
        for alias in new_character.aliases:
            alias_map[alias] = new_character
        return new_character

    def find_character(name: str) -> Optional[_DefinedCharacter]:
        normalized = normalize_character_name(name)
        if not normalized:
            return None
        return alias_map.get(normalized)

    def register_character(raw_name: str) -> Optional[_DefinedCharacter]:
        full_name = normalize_character_name(raw_name)
        if not full_name:
            return None
        return add_character(full_name)

    current_character_full_name: Optional[str] = None
    current_dialogue: List[str] = []

    def flush_dialogue() -> None:
        nonlocal current_dialogue
        if current_character_full_name and current_dialogue:
            raw = " ".join(current_dialogue).strip()
            text = clean_dialogue(raw, preserve_stage_directions)
            if text:
                chunks.append(
                    DialogueChunk(
                        character=current_character_full_name,
                        text=text,
                        original_text=raw,
                    )
                )
        current_dialogue = []

    def record_unmatched(line_number: int, content: str) -> None:
        if content.strip():
            unmatched_lines.append(ParserUnmatchedLine(line_number=line_number, content=content))

    def parse_script_body_line(trimmed_line: str, line_number: int) -> None:
        nonlocal current_character_full_name

        if not trimmed_line:
            flush_dialogue()
            current_character_full_name = None
            return

        if _SCENE_HEADING_RE.search(trimmed_line) or _TRANSITION_RE.search(trimmed_line):
            flush_dialogue()
            current_character_full_name = None
            return

        same_line_match = _SAME_LINE_DIALOGUE_RE.match(trimmed_line)
        if same_line_match:
            potential_name = same_line_match.group(1).strip()
            dialogue_part = same_line_match.group(2)
            found = find_character(potential_name)
            if not found and _UPPERCASE_CHARACTER_RE.match(potential_name):
                found = register_character(potential_name)
            if found:
                flush_dialogue()
                raw_line = dialogue_part.strip()
                text = clean_dialogue(raw_line, preserve_stage_directions)
                if text:
                    chunks.append(
                        DialogueChunk(character=found.full_name, text=text, original_text=raw_line)
                    )
                current_character_full_name = None
                return

        found_multi = find_character(trimmed_line)
        if not found_multi and _UPPERCASE_CHARACTER_RE.match(trimmed_line):
            found_multi = register_character(trimmed_line)
        if found_multi:
            flush_dialogue()
            current_character_full_name = found_multi.full_name
            return

        if current_character_full_name:
            current_dialogue.append(trimmed_line)
            return

        flush_dialogue()
        current_character_full_name = None
        record_unmatched(line_number, trimmed_line)

    mode: str = "metadata"  # metadata | characterList | scriptBody

    for idx, line in enumerate(lines):
        line_number = idx + 1
        trimmed_line = line.strip()

        if mode == "metadata":
            if trimmed_line.lower().startswith("characters:"):
                mode = "characterList"
                continue
            if _SCENE_HEADING_RE.search(trimmed_line) or _SAME_LINE_DIALOGUE_RE.search(trimmed_line):
                mode = "scriptBody"
            else:
                continue

        if mode == "characterList":
            if trimmed_line.startswith("-"):
                character_def = trimmed_line[1:].strip()
                if not re.search(r"[a-zA-Z]", character_def):
                    continue
                open_paren_index = character_def.find("(")
                raw_name = (
                    character_def[:open_paren_index] if open_paren_index != -1 else character_def
                )
                full_name = normalize_character_name(raw_name)
                if full_name:
                    add_character(full_name)
                continue
            if trimmed_line != "" and not trimmed_line.startswith("-"):
                mode = "scriptBody"
            else:
                continue

        if mode == "scriptBody":
            parse_script_body_line(trimmed_line, line_number)

    flush_dialogue()
    character_names = sorted([c.full_name for c in defined_characters])
    return ParsedScript(
        characters=character_names,
        dialogue_chunks=chunks,
        diagnostics=ParserDiagnostics(unmatched_lines=unmatched_lines),
    )

