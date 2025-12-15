from __future__ import annotations


def safe_basename(value: str, *, default: str) -> str:
    """
    Returns a safe single-path-segment filename.
    - Strips any directory components.
    - Rejects traversal and empty names.
    """
    name = (value or "").replace("\\", "/").split("/")[-1]
    if not name or name in {".", ".."} or "\x00" in name:
        return default
    return name
