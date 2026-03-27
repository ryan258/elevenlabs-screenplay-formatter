from __future__ import annotations

import re
from pathlib import Path

import pytest

pytest.importorskip("flask")

from apps.api.config import AppConfig
from apps.web.routes import (
    DEFAULT_GENERATION_MODEL,
    DEFAULT_OUTPUT_FORMAT,
    DEFAULT_REQUEST_DELAY_MS,
    _build_default_payload,
)
from apps.web.session_store import WebSessionStore
from lib.config import ElevenLabsConfig

from apps.web.app import app


def test_build_default_payload_uses_generation_defaults() -> None:
    payload, _characters = _build_default_payload(
        script_text="Characters:\n- NARRATOR\n\nNARRATOR\nHello.",
        preserve_stage_directions=False,
    )

    assert payload["projectSettings"]["model"] == DEFAULT_GENERATION_MODEL
    assert payload["projectSettings"]["outputFormat"] == DEFAULT_OUTPUT_FORMAT
    assert payload["projectSettings"]["requestDelayMs"] == DEFAULT_REQUEST_DELAY_MS


def test_generation_page_renders_defaults_and_auto_validation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    cfg = AppConfig(
        elevenlabs=ElevenLabsConfig(
            api_key="",
            base_url="https://example.invalid",
            timeout_s=1.0,
        ),
        flask_secret_key="x" * 32,
        upload_dir=str(tmp_path),
    )
    web_store = WebSessionStore(tmp_path / "web_sessions")
    payload, _characters = _build_default_payload(
        script_text="Characters:\n- NARRATOR\n\nNARRATOR\nHello.",
        preserve_stage_directions=False,
    )
    session_data = web_store.create(payload=payload)

    monkeypatch.setitem(app.config, "APP_CONFIG", cfg)
    monkeypatch.setitem(app.config, "WEB_SESSION_STORE", web_store)
    app.secret_key = cfg.flask_secret_key

    with app.test_client() as client:
        with client.session_transaction() as session:
            session["sid"] = session_data.session_id
        response = client.get("/generation")

    html = response.data.decode("utf-8")

    assert response.status_code == 200
    assert 'id="generation-form"' in html
    assert f'value="{DEFAULT_GENERATION_MODEL}"' in html
    assert re.search(r'value="pcm_24000"[^>]*selected', html)
    assert re.search(r'name="request_delay_ms"[^>]*value="500"', html)
    assert 'id="validation"' in html
    assert 'hx-post="/generation/validate"' in html
    assert 'hx-include="#generation-form"' in html
    assert (
        'hx-trigger="change delay:200ms from:#generation-form, input changed delay:400ms from:#generation-form"'
        in html
    )
