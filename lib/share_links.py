from __future__ import annotations

import base64


def encode_share_payload(value: str) -> str:
    """
    JS parity: btoa(unescape(encodeURIComponent(value))).
    This is equivalent to base64-encoding UTF-8 bytes.
    """
    if value == "":
        return ""
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


def decode_share_payload(value: str) -> str:
    """
    JS parity: decodeURIComponent(escape(atob(value))).
    This is equivalent to base64-decoding into UTF-8 text.
    """
    if value == "":
        return ""
    return base64.b64decode(value.encode("ascii")).decode("utf-8")

