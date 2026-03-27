from __future__ import annotations

from pathlib import Path

import pytest

from apps.api.config import AppConfig
from apps.api.jobs import JobStore
from lib.config import ElevenLabsConfig

pytest.importorskip("flask")

from apps.web.app import app


def test_generation_stop_returns_cancelling_controls(tmp_path: Path, monkeypatch) -> None:
    cfg = AppConfig(
        elevenlabs=ElevenLabsConfig(
            api_key="test",
            base_url="https://example.invalid",
            timeout_s=1.0,
        ),
        flask_secret_key="x" * 32,
        upload_dir=str(tmp_path),
    )
    store = JobStore(tmp_path)
    job = store.create()

    monkeypatch.setitem(app.config, "APP_CONFIG", cfg)
    monkeypatch.setitem(app.config, "JOB_STORE", store)
    app.secret_key = cfg.flask_secret_key

    with app.test_client() as client:
        response = client.post(
            f"/generation/stop/{job.job_id}",
            headers={"HX-Request": "true"},
        )

    assert response.status_code == 200
    assert b"Stopping..." in response.data
    assert b"Waiting for the current clip to finish" in response.data
    assert job.snapshot().status == "cancelling"
