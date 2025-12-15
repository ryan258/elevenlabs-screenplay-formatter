from __future__ import annotations

from pathlib import Path

from apps.api.jobs import JobStore


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

