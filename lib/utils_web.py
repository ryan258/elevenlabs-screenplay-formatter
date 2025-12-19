from __future__ import annotations

import threading
import time
from typing import Dict, List


class RateLimiter:
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
            # Initialize if needed
            if key not in self._requests:
                self._requests[key] = []

            # Clean old requests
            self._requests[key] = [t for t in self._requests[key] if t > cutoff]
            
            # Memory leak fix - remove empty keys
            if not self._requests[key]:
                del self._requests[key]
                # If we just cleared it, obviously we are under the limit
                self._requests[key] = [now]
                return True

            # Check limit
            if len(self._requests[key]) >= self._max_requests:
                return False

            self._requests[key].append(now)
            return True


# Global rate limiter instance (5 requests per minute per IP)
generation_limiter = RateLimiter(max_requests=5, window_s=60)


def clamp_voice_setting(value: float, min_val: float, max_val: float, default: float) -> float:
    """Clamp voice settings to valid range"""
    try:
        return max(min_val, min(max_val, float(value)))
    except (TypeError, ValueError):
        return default
