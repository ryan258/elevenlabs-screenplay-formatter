from __future__ import annotations

import base64
from typing import Any, Dict


def encode_share_payload(value: str) -> str:
    """
    Encode JSON string to URL-safe base64.
    """
    if value == "":
        return ""
    # Standard b64encode produces + and /, which are not URL-safe without encoding.
    # urlsafe_b64encode produces - and _ which are safe.
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii")


def decode_share_payload(value: str) -> str:
    """
    Decode URL-safe base64 string to JSON string.
    """
    if value == "":
        return ""
    try:
        # urlsafe_b64decode handles - and _ instead of + and /
        return base64.urlsafe_b64decode(value.encode("ascii")).decode("utf-8")
    except (ValueError, TypeError, UnicodeDecodeError):
        # Fallback for legacy standard-b64 links if needed, or just fail
        return base64.b64decode(value.encode("ascii")).decode("utf-8")


def normalize_share_payload(share_payload: Dict[str, Any]) -> Dict[str, Any]:
    script_text = str(
        share_payload.get("scriptText") or share_payload.get("script_text") or ""
    ).strip()
    project_settings = share_payload.get("projectSettings") or {}
    if not isinstance(project_settings, dict):
        project_settings = {}
    character_configs = share_payload.get("characterConfigs") or {}
    if not isinstance(character_configs, dict):
        character_configs = {}
    filename_prefix = (
        share_payload.get("filename_prefix") or share_payload.get("filenamePrefix") or ""
    )

    return {
        "scriptText": script_text,
        "projectSettings": project_settings,
        "characterConfigs": character_configs,
        "filename_prefix": str(filename_prefix),
    }


def session_share_view(payload: Dict[str, Any]) -> Dict[str, Any]:
    project_settings = payload.get("projectSettings") or {}
    if not isinstance(project_settings, dict):
        project_settings = {}
    character_configs = payload.get("characterConfigs") or {}
    if not isinstance(character_configs, dict):
        character_configs = {}
    return {
        "scriptText": str(payload.get("scriptText") or "").strip(),
        "projectSettings": project_settings,
        "characterConfigs": character_configs,
        "filename_prefix": str(payload.get("filename_prefix") or ""),
    }
