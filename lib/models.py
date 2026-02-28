from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass(frozen=True)
class WordTimestamp:
    word: str
    start_ms: int
    end_ms: int


@dataclass(frozen=True)
class DialogueChunk:
    character: str
    text: str
    original_text: Optional[str] = None
    start_time_ms: Optional[int] = None
    end_time_ms: Optional[int] = None
    words: Optional[List[WordTimestamp]] = None


@dataclass(frozen=True)
class VoiceSettings:
    stability: float
    similarity_boost: float
    style: float
    speed: float


@dataclass(frozen=True)
class CharacterConfig:
    voice_id: str
    voice_settings: VoiceSettings


CharacterConfigs = Dict[str, CharacterConfig]
VoicePresets = Dict[str, CharacterConfig]


@dataclass(frozen=True)
class ProjectSettings:
    model: str
    output_format: str
    concatenate: bool
    speak_parentheticals: bool
    profile_id: Optional[str] = None
    request_delay_ms: Optional[int] = None
    version_label: Optional[str] = None
    language_code: Optional[str] = None
    preserve_stage_directions: Optional[bool] = None


@dataclass(frozen=True)
class BackgroundTrackSettings:
    volume: float
    filename: Optional[str] = None


@dataclass(frozen=True)
class SoundEffectSettings:
    id: str
    label: str
    start_time_ms: int
    volume: float
    filename: Optional[str] = None


@dataclass(frozen=True)
class PersistedAudioProductionSettings:
    background_track: Optional[BackgroundTrackSettings] = None
    sound_effects: List[SoundEffectSettings] = field(default_factory=list)


@dataclass(frozen=True)
class ProjectMetadata:
    name: Optional[str] = None
    description: Optional[str] = None


@dataclass(frozen=True)
class ProjectConfig:
    version: str
    script_text: str
    character_configs: CharacterConfigs
    project_settings: ProjectSettings
    voice_presets: Optional[VoicePresets] = None
    audio_production: Optional[PersistedAudioProductionSettings] = None
    metadata: Optional[ProjectMetadata] = None


@dataclass(frozen=True)
class ManifestEntry:
    index: int
    character: str
    filename: str
    text: str
    estimated_duration_ms: int
    start_time_ms: Optional[int] = None
    end_time_ms: Optional[int] = None
    words: Optional[List[WordTimestamp]] = None


@dataclass(frozen=True)
class ParserUnmatchedLine:
    line_number: int
    content: str


@dataclass(frozen=True)
class CharacterDetectionInfo:
    """Metadata about how a character was detected during parsing"""

    character_name: str
    line_count: int
    word_count: int  # Added
    first_line_number: int
    detection_method: str  # "character_list", "uppercase_line", "same_line_dialogue"
    aliases: List[str]
    confidence: float  # 0.0 to 1.0


@dataclass(frozen=True)
class ParserDiagnostics:
    unmatched_lines: List[ParserUnmatchedLine]
    character_detections: List[CharacterDetectionInfo] = field(default_factory=list)
    total_lines_processed: int = 0
    dialogue_lines_matched: int = 0
    total_word_count: int = 0  # Added
    parsing_mode: str = ""  # "standard", "fountain", "empty"
