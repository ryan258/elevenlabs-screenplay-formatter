from __future__ import annotations

from typing import List

from lib.models import CharacterConfigs, DialogueChunk


def validate_character_configs(
    dialogue_chunks: List[DialogueChunk], character_configs: CharacterConfigs
) -> List[str]:
    errors: List[str] = []
    characters = sorted({c.character for c in dialogue_chunks if c.character})
    for character in characters:
        cfg = character_configs.get(character)
        if cfg is None or not cfg.voice_id:
            errors.append(f"Missing voice configuration for character: {character}")
    return errors
