from __future__ import annotations

from typing import Any, Dict, List, Optional

try:
    from pydantic import BaseModel, Field
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "pydantic is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc


class ParseRequest(BaseModel):
    script_text: str = Field(min_length=0)
    preserve_stage_directions: bool = False


class UnmatchedLine(BaseModel):
    line_number: int
    content: str


class Diagnostics(BaseModel):
    unmatched_lines: List[UnmatchedLine]


class DialogueChunkOut(BaseModel):
    character: str
    text: str
    original_text: Optional[str] = None


class ParseResponse(BaseModel):
    characters: List[str]
    dialogue_chunks: List[DialogueChunkOut]
    diagnostics: Diagnostics


class ConcatenateResponse(BaseModel):
    ok: bool


class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class VoiceSettingsIn(BaseModel):
    stability: float
    similarity_boost: float = Field(alias="similarity_boost")
    style: float
    speed: float


class CharacterConfigIn(BaseModel):
    voice_id: str = Field(alias="voiceId")
    voice_settings: VoiceSettingsIn = Field(alias="voiceSettings")


class ProjectSettingsIn(BaseModel):
    model: str
    output_format: str = Field(alias="outputFormat")
    concatenate: bool
    speak_parentheticals: bool = Field(alias="speakParentheticals")
    preserve_stage_directions: bool = Field(default=False, alias="preserveStageDirections")
    request_delay_ms: Optional[int] = Field(default=None, alias="requestDelayMs")


class GenerateZipRequest(BaseModel):
    script_text: str = Field(alias="scriptText")
    project_settings: ProjectSettingsIn = Field(alias="projectSettings")
    character_configs: Dict[str, CharacterConfigIn] = Field(alias="characterConfigs")
    filename_prefix: Optional[str] = None


class ValidateProjectResponse(BaseModel):
    ok: bool
    errors: List[str]
