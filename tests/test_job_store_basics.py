from __future__ import annotations

from pathlib import Path

from apps.api.jobs import JobStore
from apps.web.session_store import WebSessionStore


def test_job_store_create_sets_work_dir(tmp_path: Path) -> None:
    store = JobStore(tmp_path)
    job = store.create()
    assert job.job_id
    assert job.work_dir.exists()
    assert str(job.work_dir).startswith(str((tmp_path / "jobs").resolve()))


def test_job_events_ring_buffer_is_non_destructive(tmp_path: Path) -> None:
    store = JobStore(tmp_path)
    job = store.create()

    job.add_event("progress", {"n": 1})
    job.add_event("progress", {"n": 2})

    a = job.get_events_since(0)
    b = job.get_events_since(0)
    assert [e["data"]["n"] for e in a] == [1, 2]
    assert [e["data"]["n"] for e in b] == [1, 2]


def test_web_session_store_cleanup_deletes_old_sessions(tmp_path: Path) -> None:
    store = WebSessionStore(tmp_path)
    data = store.create(payload={"scriptText": "Hello"})
    store.put(type(data)(session_id=data.session_id, updated_at_s=0.0, payload=data.payload))

    deleted = store.cleanup_old_sessions(max_age_s=1)
    assert deleted == 1
    assert store.get(data.session_id) is None
