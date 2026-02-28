from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

from lib.models import CharacterDetectionInfo, DialogueChunk, ParserDiagnostics, ParserUnmatchedLine


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


def strip_brackets(text: str) -> str:
    return re.sub(r"\[[^\]]+\]", "", text)


def normalize_character_name(value: str) -> str:
    normalized = re.sub(r"\([^)]*\)", "", value)
    normalized = re.sub(r"\bCONT'D\b", "", normalized, flags=re.I)
    normalized = re.sub(r"[^A-Z0-9\s'\"-]", " ", normalized, flags=re.I)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip().upper()


def generate_aliases(full_name: str) -> Set[str]:
    """Generate aliases with limits to prevent explosion (Bug 21 fix)"""
    aliases: Set[str] = set()
    tokens = [token for token in full_name.split(" ") if token]
    if not tokens:
        return aliases

    MAX_TOKENS = 4  # Limit processing for very long names
    if len(tokens) > MAX_TOKENS:
        tokens = tokens[:MAX_TOKENS]

    # Full name
    aliases.add(" ".join(tokens))

    # Individual tokens (first names, last names)
    for token in tokens:
        aliases.add(token)

    # Only generate compound aliases for short names to avoid O(n²) explosion
    if len(tokens) >= 2:
        # First + Last (most common)
        aliases.add(f"{tokens[0]} {tokens[-1]}")

    # Two-word combinations for 3-word names
    if len(tokens) == 3:
        aliases.add(f"{tokens[0]} {tokens[1]}")
        aliases.add(f"{tokens[1]} {tokens[2]}")

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
            diagnostics=ParserDiagnostics(
                unmatched_lines=[],
                character_detections=[],
                total_lines_processed=0,
                dialogue_lines_matched=0,
                parsing_mode="empty",
            ),
        )

    lines = script_text.split("\n")
    chunks: List[DialogueChunk] = []
    defined_characters: List[_DefinedCharacter] = []
    alias_map: Dict[str, _DefinedCharacter] = {}
    full_name_map: Dict[str, _DefinedCharacter] = {}
    unmatched_lines: List[ParserUnmatchedLine] = []

    # Track character detection metadata
    character_metadata: Dict[str, Dict[str, Any]] = {}
    dialogue_lines_count = 0

    def add_character(
        full_name: str, detection_method: str = "unknown", line_number: int = 0
    ) -> _DefinedCharacter:
        existing = full_name_map.get(full_name)
        if existing:
            # Update metadata if we have a better detection method
            if full_name in character_metadata:
                character_metadata[full_name]["detection_methods"].add(detection_method)
            return existing

        new_character = _DefinedCharacter(full_name=full_name, aliases=generate_aliases(full_name))
        defined_characters.append(new_character)
        full_name_map[full_name] = new_character

        # Initialize metadata
        character_metadata[full_name] = {
            "first_line": line_number,
            "line_count": 0,
            "detection_methods": {detection_method},
        }

        for alias in new_character.aliases:
            alias_map[alias] = new_character
        return new_character

    def find_character(name: str) -> Optional[_DefinedCharacter]:
        normalized = normalize_character_name(name)
        if not normalized:
            return None
        return alias_map.get(normalized)

    def register_character(
        raw_name: str, detection_method: str = "unknown", line_number: int = 0
    ) -> Optional[_DefinedCharacter]:
        full_name = normalize_character_name(raw_name)
        if not full_name:
            return None
        return add_character(full_name, detection_method, line_number)

    current_character_full_name: Optional[str] = None
    current_dialogue: List[str] = []

    def flush_dialogue() -> None:
        nonlocal current_dialogue, dialogue_lines_count
        if current_character_full_name and current_dialogue:
            raw = " ".join(current_dialogue).strip()
            text = clean_dialogue(raw, preserve_stage_directions)
            if text:
                original_text = raw if preserve_stage_directions else strip_brackets(raw)
                chunks.append(
                    DialogueChunk(
                        character=current_character_full_name,
                        text=text,
                        original_text=original_text,
                    )
                )
                # Track dialogue line count for this character
                if current_character_full_name in character_metadata:
                    character_metadata[current_character_full_name]["line_count"] += 1
                dialogue_lines_count += 1
        current_dialogue = []

    def record_unmatched(line_number: int, content: str) -> None:
        if content.strip():
            unmatched_lines.append(ParserUnmatchedLine(line_number=line_number, content=content))

    def parse_script_body_line(trimmed_line: str, line_number: int) -> None:
        nonlocal current_character_full_name, dialogue_lines_count

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
                found = register_character(potential_name, "same_line_dialogue", line_number)
            if found:
                flush_dialogue()
                raw_line = dialogue_part.strip()
                text = clean_dialogue(raw_line, preserve_stage_directions)
                if text:
                    original_text = (
                        raw_line if preserve_stage_directions else strip_brackets(raw_line)
                    )
                    chunks.append(
                        DialogueChunk(
                            character=found.full_name, text=text, original_text=original_text
                        )
                    )
                    # Track dialogue line count for same-line dialogue
                    if found.full_name in character_metadata:
                        character_metadata[found.full_name]["line_count"] += 1
                    dialogue_lines_count += 1
                current_character_full_name = None
                return

        found_multi = find_character(trimmed_line)
        if not found_multi and _UPPERCASE_CHARACTER_RE.match(trimmed_line):
            found_multi = register_character(trimmed_line, "uppercase_line", line_number)
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
            if _SCENE_HEADING_RE.search(trimmed_line) or _SAME_LINE_DIALOGUE_RE.search(
                trimmed_line
            ):
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
                    add_character(full_name, "character_list", line_number)
                continue
            if trimmed_line != "" and not trimmed_line.startswith("-"):
                mode = "scriptBody"
            else:
                continue

        if mode == "scriptBody":
            parse_script_body_line(trimmed_line, line_number)

    flush_dialogue()
    character_names = sorted([c.full_name for c in defined_characters])

    # Build character detection info with confidence scores
    character_detections: List[CharacterDetectionInfo] = []
    total_word_count = 0

    for character in defined_characters:
        meta = character_metadata.get(character.full_name, {})
        line_count = meta.get("line_count", 0)

        # Calculate word count for this character
        # Scan chunks instead of tracking in metadata to keep it simple
        char_word_count = sum(
            len(c.text.split()) for c in chunks if c.character == character.full_name
        )
        total_word_count += char_word_count

        # Calculate confidence based on multiple factors
        confidence = 0.0
        detection_methods = meta.get("detection_methods", set())

        if "character_list" in detection_methods:
            confidence += 0.5  # Explicitly listed
        if line_count >= 5:
            confidence += 0.3  # Has substantial dialogue
        elif line_count >= 2:
            confidence += 0.2
        elif line_count >= 1:
            confidence += 0.1

        # Word count bonus
        if char_word_count > 50:
            confidence += 0.1

        confidence = min(1.0, confidence)

        # Primary detection method (prefer character_list if present)
        if "character_list" in detection_methods:
            primary_method = "character_list"
        elif detection_methods:
            primary_method = list(detection_methods)[0]
        else:
            primary_method = "unknown"

        character_detections.append(
            CharacterDetectionInfo(
                character_name=character.full_name,
                line_count=line_count,
                word_count=char_word_count,
                first_line_number=meta.get("first_line", 0),
                detection_method=primary_method,
                aliases=sorted(character.aliases),
                confidence=confidence,
            )
        )

    # Sort by confidence descending, then by character name
    character_detections.sort(key=lambda x: (-x.confidence, x.character_name))

    # Determine parsing mode
    parsing_mode = (
        "fountain"
        if not any(
            "character_list"
            in character_metadata.get(c.full_name, {}).get("detection_methods", set())
            for c in defined_characters
        )
        else "standard"
    )

    return ParsedScript(
        characters=character_names,
        dialogue_chunks=chunks,
        diagnostics=ParserDiagnostics(
            unmatched_lines=unmatched_lines,
            character_detections=character_detections,
            total_lines_processed=len(lines),
            dialogue_lines_matched=dialogue_lines_count,
            total_word_count=total_word_count,
            parsing_mode=parsing_mode,
        ),
    )
