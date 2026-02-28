import re
from pathlib import Path

# Shared Regular Expressions for screenplay parsing and formatting
SCENE_HEADING_RE = re.compile(r"^(INT\.?|EXT\.?|I\/E\.?|SCENE \d+|EST\.|INT\/EXT\.?|\.)", re.I)
TRANSITION_RE = re.compile(
    r"(CUT TO:|FADE (IN|OUT)|SMASH CUT|MATCH CUT|DISSOLVE TO:|IRIS OUT|WIPE TO:)", re.I
)


def check_disk_space(path: Path, required_bytes: int) -> None:
    """Raise if insufficient disk space (Bug 17 fix)"""
    import shutil

    stat = shutil.disk_usage(path)
    # Require 2x the needed space as safety margin
    if stat.free < required_bytes * 2:
        raise RuntimeError(
            f"Insufficient disk space: {stat.free / 1e9:.1f}GB free, "
            f"need ~{required_bytes * 2 / 1e9:.1f}GB"
        )


def clamp_voice_setting(value: float, min_val: float, max_val: float, default: float) -> float:
    """Clamp voice settings to valid range"""
    try:
        return max(min_val, min(max_val, float(value)))
    except (TypeError, ValueError):
        return default
