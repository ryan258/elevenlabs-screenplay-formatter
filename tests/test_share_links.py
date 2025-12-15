from __future__ import annotations

from lib.share_links import decode_share_payload, encode_share_payload


def test_share_links_roundtrip_utf8() -> None:
    original = "Hello — café 漢字"
    encoded = encode_share_payload(original)
    decoded = decode_share_payload(encoded)
    assert decoded == original

