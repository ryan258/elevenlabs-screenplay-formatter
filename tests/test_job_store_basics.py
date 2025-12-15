from __future__ import annotations

from pathlib import Path

from apps.api.jobs import JobStore


def test_job_store_create_sets_work_dir(tmp_path: Path) -> None:
    store = JobStore(tmp_path)
    job = store.create()
    assert job.job_id
    assert job.work_dir.exists()
    assert str(job.work_dir).startswith(str((tmp_path / "jobs").resolve()))

