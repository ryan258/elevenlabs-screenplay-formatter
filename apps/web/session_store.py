from __future__ import annotations

import json
import shutil
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from lib.filenames import safe_basename


@dataclass(frozen=True)
class WebSessionData:
    session_id: str
    updated_at_s: float
    payload: Dict[str, Any]


class WebSessionStore:
    def __init__(self, root_dir: Path) -> None:
        self._root_dir = root_dir.resolve()
        self._root_dir.mkdir(parents=True, exist_ok=True)
        self._last_cleanup_s = 0.0

    def _session_path(self, session_id: str) -> Path:
        safe_id = safe_basename(session_id, default="")
        if not safe_id:
            raise ValueError("Invalid session id")
        return (self._root_dir / f"{safe_id}.json").resolve()

    def create(self, *, payload: Dict[str, Any]) -> WebSessionData:
        self.maybe_cleanup_old_sessions()
        session_id = uuid.uuid4().hex
        data = WebSessionData(session_id=session_id, updated_at_s=time.time(), payload=payload)
        self.put(data)
        return data

    def get(self, session_id: str) -> Optional[WebSessionData]:
        path = self._session_path(session_id)
        if not path.exists():
            return None
        obj = json.loads(path.read_text(encoding="utf-8"))
        payload = obj.get("payload") or {}
        updated_at_s = float(obj.get("updated_at_s") or 0.0)
        return WebSessionData(session_id=session_id, updated_at_s=updated_at_s, payload=dict(payload))

    def put(self, data: WebSessionData) -> None:
        path = self._session_path(data.session_id)
        try:
            path.relative_to(self._root_dir)
        except ValueError as exc:
            raise ValueError("Invalid session path") from exc
        obj = {"updated_at_s": data.updated_at_s, "payload": data.payload}
        tmp_path = (path.parent / f".{path.name}.{uuid.uuid4().hex}.tmp").resolve()
        try:
            tmp_path.relative_to(self._root_dir)
        except ValueError as exc:
            raise ValueError("Invalid session temp path") from exc
        tmp_path.write_text(json.dumps(obj, indent=2, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)

    def patch(self, session_id: str, patch: Dict[str, Any]) -> WebSessionData:
        existing = self.get(session_id)
        payload: Dict[str, Any] = {}
        if existing is not None:
            payload = dict(existing.payload)
        payload.update(patch)
        data = WebSessionData(session_id=session_id, updated_at_s=time.time(), payload=payload)
        self.put(data)
        return data

    def preview_dir(self, session_id: str) -> Path:
        safe_id = safe_basename(session_id, default="")
        if not safe_id:
            raise ValueError("Invalid session id")
        out = (self._root_dir / safe_id / "previews").resolve()
        out.mkdir(parents=True, exist_ok=True)
        return out

    def delete(self, session_id: str) -> bool:
        safe_id = safe_basename(session_id, default="")
        if not safe_id:
            return False
        path = self._session_path(safe_id)
        try:
            path.relative_to(self._root_dir)
        except ValueError:
            return False
        deleted_any = False
        if path.exists():
            path.unlink()
            deleted_any = True

        session_dir = (self._root_dir / safe_id).resolve()
        try:
            session_dir.relative_to(self._root_dir)
        except ValueError:
            return deleted_any
        if session_dir.exists():
            shutil.rmtree(session_dir, ignore_errors=True)
            deleted_any = True
        return deleted_any

    def cleanup_old_sessions(self, *, max_age_s: int) -> int:
        cutoff = time.time() - max(0, int(max_age_s))
        deleted = 0
        for path in self._root_dir.glob("*.json"):
            try:
                obj = json.loads(path.read_text(encoding="utf-8"))
                updated_at_s = float(obj.get("updated_at_s") or 0.0)
                if updated_at_s >= cutoff:
                    continue
                session_id = path.stem
                if self.delete(session_id):
                    deleted += 1
            except Exception:
                continue
        return deleted

    def maybe_cleanup_old_sessions(
        self,
        *,
        max_age_s: int = 72 * 3600,
        interval_s: int = 3600,
    ) -> int:
        now = time.time()
        if now - self._last_cleanup_s < max(0, int(interval_s)):
            return 0
        self._last_cleanup_s = now
        return self.cleanup_old_sessions(max_age_s=max_age_s)
