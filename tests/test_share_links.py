from __future__ import annotations

from lib.share_links import decode_share_payload, encode_share_payload


def test_share_links_roundtrip_utf8() -> None:
    original = "Hello — café 漢字"
    encoded = encode_share_payload(original)
    decoded = decode_share_payload(encoded)
    assert decoded == original


def test_share_links_url_safety() -> None:
    # This input produces '+' and '/' in standard base64
    # "Example input??" -> "RXhhbXBsZSBpbnB1dD8/" in std b64 (has /)
    # We want to ensure our output has - and _ instead
    original = "Example input??" * 10
    encoded = encode_share_payload(original)

    assert "+" not in encoded
    assert "/" not in encoded
    assert "-" in encoded or "_" in encoded or encoded.isalnum()

    decoded = decode_share_payload(encoded)
    assert decoded == original
