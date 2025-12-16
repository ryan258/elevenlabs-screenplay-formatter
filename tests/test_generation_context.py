from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

from lib.generation import generate_all_audio, generate_one_audio
from lib.models import CharacterConfig, DialogueChunk, VoiceSettings


@dataclass
class _FakeClient:
    seen: list[tuple[Optional[str], Optional[str]]]

    def generate_audio(  # type: ignore[no-untyped-def]
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
        max_retries: int = 0,
        base_delay_ms: int = 0,
    ) -> Tuple[bytes, Optional[int]]:
        self.seen.append((previous_text, next_text))
        return b"audio", None

    def fetch_alignment(self, *, voice_id: str, text: str, model_id: str) -> None:  # pragma: no cover
        return None


def test_generate_all_audio_passes_previous_and_next_context() -> None:
    chunks = [
        DialogueChunk(character="A", text="Hello", original_text="Hello"),
        DialogueChunk(character="A", text="World", original_text="World"),
        DialogueChunk(character="A", text="!", original_text="!"),
    ]
    cfg = CharacterConfig(
        voice_id="vid",
        voice_settings=VoiceSettings(stability=0.5, similarity_boost=0.75, style=0.1, speed=1.0),
    )
    client = _FakeClient(seen=[])

    _ = generate_all_audio(
        client=client,  # type: ignore[arg-type]
        dialogue_chunks=chunks,
        character_configs={"A": cfg},
        model_id="m",
        output_format="mp3_44100_128",
        speak_parentheticals=True,
        fetch_alignment=False,
    )

    assert client.seen == [
        (None, "World"),
        ("Hello", "!"),
        ("World", None),
    ]


def test_generate_one_audio_passes_previous_and_next_context() -> None:
    chunks = [
        DialogueChunk(character="A", text="Hello", original_text="Hello"),
        DialogueChunk(character="A", text="World", original_text="World"),
        DialogueChunk(character="A", text="!", original_text="!"),
    ]
    cfg = CharacterConfig(
        voice_id="vid",
        voice_settings=VoiceSettings(stability=0.5, similarity_boost=0.75, style=0.1, speed=1.0),
    )
    client = _FakeClient(seen=[])

    _ = generate_one_audio(
        client=client,  # type: ignore[arg-type]
        dialogue_chunks=chunks,
        character_configs={"A": cfg},
        model_id="m",
        output_format="mp3_44100_128",
        index=1,
        speak_parentheticals=True,
        fetch_alignment=False,
    )

    assert client.seen == [("Hello", "!")]
