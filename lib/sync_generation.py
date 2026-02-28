from __future__ import annotations

from typing import Dict, List

from lib.config import ElevenLabsConfig
from lib.elevenlabs.client import ElevenLabsClient
from lib.exports.zip_bundle import build_zip_bundle
from lib.generation import generate_all_audio
from lib.manifest import build_manifest_entries, manifest_to_srt, manifest_to_vtt
from lib.models import CharacterConfig, DialogueChunk
from lib.reaper_export import build_reaper_project


def generate_sync_zip_bundle(
    *,
    elevenlabs_config: ElevenLabsConfig,
    dialogue_chunks: List[DialogueChunk],
    character_configs: Dict[str, CharacterConfig],
    model_id: str,
    output_format: str,
    delay_ms: int,
    speak_parentheticals: bool,
) -> bytes:
    """Generate audio and return a complete zip bundle with manifest/subtitles synchronously."""
    client = ElevenLabsClient(elevenlabs_config)
    generated = generate_all_audio(
        client=client,
        dialogue_chunks=dialogue_chunks,
        character_configs=character_configs,
        model_id=model_id,
        output_format=output_format,
        delay_ms=delay_ms,
        speak_parentheticals=speak_parentheticals,
        fetch_alignment=True,
    )

    entries = build_manifest_entries(
        dialogue_chunks,
        [g.filename for g in generated],
        start_times_ms=[g.start_time_ms for g in generated],
        end_times_ms=[g.end_time_ms for g in generated],
        alignments=[g.alignment for g in generated],
    )

    audio_files = [(g.filename, g.audio_bytes) for g in generated]

    zip_bytes = build_zip_bundle(
        audio_files=audio_files,
        manifest_entries=entries,
        extra_files=[
            ("subtitles.srt", manifest_to_srt(entries).encode("utf-8")),
            ("subtitles.vtt", manifest_to_vtt(entries).encode("utf-8")),
            ("reaper.rpp", build_reaper_project(entries).encode("utf-8")),
        ],
    )
    return zip_bytes
