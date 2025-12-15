from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from lib.config import ElevenLabsConfig
from lib.models import VoiceSettings, WordTimestamp


def _join_url(base_url: str, path: str) -> str:
    return base_url.rstrip("/") + "/" + path.lstrip("/")


def _translate_api_error(status: int, raw_message: str) -> str:
    lowered = (raw_message or "").lower()
    if status == 401:
        return "ElevenLabs rejected the API key (401)."
    if status == 429:
        return "ElevenLabs rate limit reached (429). Increase request delay or retry later."
    if "insufficient_quota" in lowered:
        return "ElevenLabs character quota is exhausted. Upgrade plan or wait for reset."
    if status >= 500:
        return "ElevenLabs is experiencing issues (5xx). Try again shortly."
    return f"API Error {status}: {raw_message or 'Unexpected response from ElevenLabs.'}"


def _parse_rate_limit_remaining(headers: Dict[str, str]) -> Optional[int]:
    header = headers.get("x-rate-limit-remaining") or headers.get("x-ratelimit-remaining")
    if header is None:
        return None
    try:
        value = int(header)
    except ValueError:
        return None
    return value


def _adjust_delay_based_on_rate_limit(
    remaining: Optional[int], current_delay_ms: int, base_delay_ms: int
) -> int:
    if remaining is None:
        return current_delay_ms
    if remaining <= 2:
        return min(current_delay_ms + 250, 2000)
    if remaining > 5 and current_delay_ms > base_delay_ms:
        return max(base_delay_ms, current_delay_ms - 100)
    return current_delay_ms


@dataclass(frozen=True)
class ElevenLabsVoice:
    voice_id: str
    name: str
    category: Optional[str] = None
    description: Optional[str] = None
    labels: Optional[Dict[str, str]] = None
    preview_url: Optional[str] = None


@dataclass(frozen=True)
class ElevenLabsModel:
    model_id: str
    name: str
    description: Optional[str] = None


class ElevenLabsClient:
    def __init__(self, config: ElevenLabsConfig) -> None:
        self._config = config

    def list_voices(self) -> List[ElevenLabsVoice]:
        url = _join_url(self._config.base_url, "/v1/voices")
        data = self._request_json("GET", url, headers={"xi-api-key": self._config.api_key})
        voices = data.get("voices") or []
        result: List[ElevenLabsVoice] = []
        for entry in voices:
            if not isinstance(entry, dict):
                continue
            voice_id = str(entry.get("voice_id") or "")
            name = str(entry.get("name") or "")
            if not voice_id or not name:
                continue
            result.append(
                ElevenLabsVoice(
                    voice_id=voice_id,
                    name=name,
                    category=entry.get("category"),
                    description=entry.get("description"),
                    labels=entry.get("labels") if isinstance(entry.get("labels"), dict) else None,
                    preview_url=entry.get("preview_url"),
                )
            )
        return result

    def list_models(self) -> List[ElevenLabsModel]:
        url = _join_url(self._config.base_url, "/v1/models")
        data = self._request_json("GET", url, headers={"xi-api-key": self._config.api_key})
        if not isinstance(data, list):
            return []
        result: List[ElevenLabsModel] = []
        for entry in data:
            if not isinstance(entry, dict):
                continue
            model_id = str(entry.get("model_id") or "")
            name = str(entry.get("name") or "")
            if not model_id or not name:
                continue
            result.append(
                ElevenLabsModel(model_id=model_id, name=name, description=entry.get("description"))
            )
        return result

    def generate_audio(
        self,
        *,
        voice_id: str,
        text: str,
        model_id: str,
        output_format: str,
        voice_settings: VoiceSettings,
        previous_text: Optional[str] = None,
        next_text: Optional[str] = None,
        accept: str = "audio/mpeg",
        max_retries: int = 2,
        base_delay_ms: int = 500,
    ) -> Tuple[bytes, Optional[int]]:
        url = _join_url(self._config.base_url, f"/v1/text-to-speech/{voice_id}")
        payload = {
            "text": text,
            "model_id": model_id,
            "output_format": output_format,
            "previous_text": previous_text,
            "next_text": next_text,
            "voice_settings": {
                "stability": voice_settings.stability,
                "similarity_boost": voice_settings.similarity_boost,
                "style": voice_settings.style or 0,
                "speed": voice_settings.speed,
                "use_speaker_boost": True,
            },
        }

        attempt = 0
        delay_ms = base_delay_ms
        last_exc: Optional[Exception] = None
        while attempt <= max_retries:
            try:
                body = json.dumps(payload).encode("utf-8")
                data, headers = self._request_bytes(
                    "POST",
                    url,
                    headers={
                        "xi-api-key": self._config.api_key,
                        "Content-Type": "application/json",
                        "Accept": accept,
                    },
                    body=body,
                )
                remaining = _parse_rate_limit_remaining(headers)
                delay_ms = _adjust_delay_based_on_rate_limit(remaining, delay_ms, base_delay_ms)
                return data, remaining
            except Exception as exc:
                last_exc = exc
                if attempt >= max_retries:
                    break
                time.sleep(min(5.0, 1.0 * (attempt + 1)))
                attempt += 1
        raise last_exc if last_exc else RuntimeError("Unknown error generating audio")

    def fetch_alignment(self, *, voice_id: str, text: str, model_id: str) -> Optional[List[WordTimestamp]]:
        url = _join_url(self._config.base_url, f"/v1/text-to-speech/{voice_id}/alignment")
        try:
            payload = json.dumps({"text": text, "model_id": model_id}).encode("utf-8")
            data = self._request_json(
                "POST",
                url,
                headers={"xi-api-key": self._config.api_key, "Content-Type": "application/json"},
                body=payload,
            )
        except Exception:
            return None

        alignment = data.get("alignment") or data.get("words") or []
        if not isinstance(alignment, list):
            return None
        result: List[WordTimestamp] = []
        for entry in alignment:
            if not isinstance(entry, dict):
                continue
            word = str(entry.get("word") or entry.get("text") or "").strip()
            if not word:
                continue
            try:
                start_ms = round(float(entry.get("start") or 0) * 1000)
                end_ms = round(float(entry.get("end") or 0) * 1000)
            except (TypeError, ValueError):
                continue
            result.append(WordTimestamp(word=word, start_ms=int(start_ms), end_ms=int(end_ms)))
        return result or None

    def _request_bytes(
        self,
        method: str,
        url: str,
        *,
        headers: Dict[str, str],
        body: Optional[bytes] = None,
    ) -> Tuple[bytes, Dict[str, str]]:
        req = urllib.request.Request(url=url, data=body, method=method)
        for k, v in headers.items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=self._config.timeout_s) as resp:
                data = resp.read()
                resp_headers = {k.lower(): v for k, v in resp.headers.items()}
                return data, resp_headers
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
            raise RuntimeError(_translate_api_error(exc.code, raw)) from exc

    def _request_json(
        self,
        method: str,
        url: str,
        *,
        headers: Dict[str, str],
        body: Optional[bytes] = None,
    ) -> dict:
        data, _ = self._request_bytes(method, url, headers=headers, body=body)
        parsed = json.loads(data.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise TypeError("Expected JSON object response")
        return parsed

