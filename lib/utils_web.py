from __future__ import annotations

import threading
import time
from typing import Dict, List


class _RateLimiter:
    """
    Simple in-memory rate limiter.

    WARNING: This is process-local only. In a multi-worker deployment (e.g. gunicorn/uvicorn users),
    limits will be applied per-worker, allowing 2-4x higher actual rates.
    For production, use a shared store like Redis.
    """

    def __init__(self, max_requests: int, window_s: int):
        self._max_requests = max_requests
        self._window_s = window_s
        self._requests: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check_limit(self, key: str) -> bool:
        """Returns True if under limit, False if over"""
        now = time.time()
        cutoff = now - self._window_s

        with self._lock:
            reqs = self._requests.get(key, [])
            reqs = [t for t in reqs if t > cutoff]

            if len(reqs) >= self._max_requests:
                self._requests[key] = reqs
                return False

            reqs.append(now)
            self._requests[key] = reqs
            return True


# Global rate limiter instance (5 requests per minute per IP)
generation_limiter = _RateLimiter(max_requests=5, window_s=60)
