from __future__ import annotations

import difflib
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from lib.parser import parse_script

from lib.utils import SCENE_HEADING_RE, TRANSITION_RE

_POTENTIAL_CHARACTER_RE = re.compile(r"^[A-Za-z][A-Za-z0-9\s.'\"()-]*$")


@dataclass(frozen=True)
class ScriptFormatChange:
    kind: str
    details: str


@dataclass(frozen=True)
class ScriptFormatResult:
    original_text: str
    formatted_text: str
    changes: List[ScriptFormatChange]
    diff: str

    @property
    def changed(self) -> bool:
        return self.original_text != self.formatted_text


def _normalize_newlines(value: str) -> str:
    return value.replace("\r\n", "\n").replace("\r", "\n")


def _normalize_whitespace(line: str) -> str:
    if not line.strip():
        return ""
    line = line.replace("\t", " ")
    line = re.sub(r"[ ]{2,}", " ", line)
    return line.strip()


def _collapse_blank_lines(lines: List[str], *, max_blank: int = 1) -> Tuple[List[str], bool]:
    out: List[str] = []
    blank_run = 0
    changed = False
    for line in lines:
        if not line.strip():
            blank_run += 1
            if blank_run <= max_blank:
                out.append("")
            else:
                changed = True
            continue
        blank_run = 0
        out.append(line)
    return out, changed


def _is_potential_character(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if SCENE_HEADING_RE.search(stripped) or TRANSITION_RE.search(stripped):
        return False
    return bool(_POTENTIAL_CHARACTER_RE.match(stripped))


def _looks_like_dialogue(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if SCENE_HEADING_RE.search(stripped) or TRANSITION_RE.search(stripped):
        return False
    if stripped.endswith(":"):
        return False
    if stripped.isupper() and len(stripped.split()) <= 6:
        return False
    return True


def _fix_character_case(lines: List[str]) -> Tuple[List[str], int]:
    out = list(lines)
    fixed = 0
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or stripped.isupper():
            continue
        if not _is_potential_character(stripped):
            continue
        next_index = index + 1
        while next_index < len(lines) and not lines[next_index].strip():
            next_index += 1
        if next_index >= len(lines):
            continue
        next_line = lines[next_index].strip()
        if not _looks_like_dialogue(next_line):
            continue
        out[index] = stripped.upper()
        fixed += 1
    return out, fixed


def _find_character_list(lines: List[str]) -> Optional[Tuple[int, int, List[str]]]:
    for index, line in enumerate(lines):
        if line.strip().lower().startswith("characters:"):
            names: List[str] = []
            end = index + 1
            while end < len(lines):
                stripped = lines[end].strip()
                if stripped.startswith("-"):
                    name = stripped[1:].strip()
                    if name:
                        names.append(name)
                    end += 1
                    continue
                if not stripped:
                    end += 1
                    continue
                break
            return index, end, names
    return None


def _ensure_character_list(lines: List[str], characters: List[str]) -> Tuple[List[str], int, bool]:
    characters = [c for c in characters if c]
    if not characters:
        return lines, 0, False
    existing = _find_character_list(lines)
    if existing is None:
        header = ["Characters:", *[f"- {name}" for name in characters], ""]
        return header + lines, len(characters), True

    _start, end, existing_names = existing
    existing_set = {name.strip().upper() for name in existing_names if name.strip()}
    missing = [name for name in characters if name.strip().upper() not in existing_set]
    if not missing:
        return lines, 0, False
    insert = [f"- {name}" for name in missing]
    return lines[:end] + insert + lines[end:], len(missing), False


def _build_unified_diff(original: str, formatted: str) -> str:
    diff_lines = difflib.unified_diff(
        original.splitlines(),
        formatted.splitlines(),
        fromfile="before",
        tofile="after",
        lineterm="",
    )
    return "\n".join(diff_lines)


def _detect_character_cues(lines: List[str]) -> List[str]:
    characters: List[str] = []
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or not stripped.isupper():
            continue
        if not _is_potential_character(stripped):
            continue
        next_index = index + 1
        while next_index < len(lines) and not lines[next_index].strip():
            next_index += 1
        if next_index >= len(lines):
            continue
        next_line = lines[next_index].strip()
        if not _looks_like_dialogue(next_line):
            continue
        if stripped not in characters:
            characters.append(stripped)
    return characters


def format_script(script_text: str) -> ScriptFormatResult:
    original = script_text or ""
    changes: List[ScriptFormatChange] = []

    text = _normalize_newlines(original)
    if text != original:
        changes.append(ScriptFormatChange(kind="line_breaks", details="Normalized line breaks."))

    lines = text.split("\n")
    normalized_lines = [_normalize_whitespace(line) for line in lines]
    if normalized_lines != lines:
        changes.append(ScriptFormatChange(kind="whitespace", details="Normalized tabs/spaces."))
    lines = normalized_lines

    lines, uppercased = _fix_character_case(lines)
    if uppercased:
        changes.append(
            ScriptFormatChange(
                kind="character_case",
                details=f"Uppercased {uppercased} character cue lines.",
            )
        )

    lines, collapsed = _collapse_blank_lines(lines, max_blank=1)
    if collapsed:
        changes.append(
            ScriptFormatChange(
                kind="blank_lines",
                details="Collapsed repeated blank lines.",
            )
        )

    interim_text = "\n".join(lines)
    parsed = parse_script(interim_text)
    characters = (
        sorted(parsed.characters) if parsed.characters else sorted(_detect_character_cues(lines))
    )
    lines, missing_count, created = _ensure_character_list(lines, characters)
    if missing_count:
        details = (
            f"Added {missing_count} character declarations."
            if not created
            else f"Created character list with {missing_count} entries."
        )
        changes.append(ScriptFormatChange(kind="character_list", details=details))

    formatted = "\n".join(lines)
    diff = _build_unified_diff(original, formatted) if formatted != original else ""

    return ScriptFormatResult(
        original_text=original,
        formatted_text=formatted,
        changes=changes,
        diff=diff,
    )
