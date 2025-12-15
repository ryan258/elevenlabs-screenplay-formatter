from __future__ import annotations

from typing import Dict

from apps.api.schemas import GenerateZipRequest
from lib.models import CharacterConfig, VoiceSettings


def build_character_configs(body: GenerateZipRequest) -> Dict[str, CharacterConfig]:
    character_configs: Dict[str, CharacterConfig] = {}
    for name, raw in body.character_configs.items():
        character_configs[name] = CharacterConfig(
            voice_id=raw.voice_id,
            voice_settings=VoiceSettings(
                stability=raw.voice_settings.stability,
                similarity_boost=raw.voice_settings.similarity_boost,
                style=raw.voice_settings.style,
                speed=raw.voice_settings.speed,
            ),
        )
    return character_configs

