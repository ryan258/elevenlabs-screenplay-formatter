from __future__ import annotations

from pathlib import Path


def sanitize_fieldname(value: str) -> str:
    keep = []
    for ch in value:
        if ch.isalnum() or ch in {"_", "-"}:
            keep.append(ch)
    return "".join(keep)[:128]


def sanitize_filename(value: str) -> str:
    keep = []
    for ch in value:
        if ch.isalnum() or ch in {".", "_", "-", " "}:
            keep.append(ch)
    return ("".join(keep)).strip().replace(" ", "_") or "file"


def ensure_child_path(parent: Path, name: str) -> Path:
    candidate = (parent / name).resolve()
    parent_resolved = parent.resolve()
    try:
        candidate.relative_to(parent_resolved)
    except ValueError as exc:
        raise ValueError("Invalid path") from exc
    return candidate

