from __future__ import annotations

import base64


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
    except Exception:
        # Fallback for legacy standard-b64 links if needed, or just fail
        return base64.b64decode(value.encode("ascii")).decode("utf-8")

