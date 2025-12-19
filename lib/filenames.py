from __future__ import annotations


def safe_basename(value: str, *, default: str) -> str:
    """
    Returns a safe single-path-segment filename.
    - Checks null bytes FIRST (Bug 10 fix - prevent path traversal bypass)
    - Strips directory components
    - Rejects traversal and empty names
    """
    # Check for null bytes BEFORE any processing
    if not value or "\x00" in value:
        return default

    name = value.replace("\\", "/").split("/")[-1]
    if not name or name in {".", ".."}:
        return default

    return name
