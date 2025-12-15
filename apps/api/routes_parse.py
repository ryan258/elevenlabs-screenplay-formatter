from __future__ import annotations

try:
    from fastapi import APIRouter
except ModuleNotFoundError as exc:  # pragma: no cover
    raise ModuleNotFoundError(
        "FastAPI is not installed. Install Python deps (see pyproject.toml) to run the API."
    ) from exc

from apps.api.schemas import ParseRequest, ParseResponse
from lib.parser import parse_script


router = APIRouter(prefix="/api")


@router.post("/parse", response_model=ParseResponse)
def api_parse(body: ParseRequest) -> ParseResponse:
    parsed = parse_script(body.script_text, preserve_stage_directions=body.preserve_stage_directions)
    return ParseResponse.model_validate(
        {
            "characters": parsed.characters,
            "dialogue_chunks": [
                {"character": c.character, "text": c.text, "original_text": c.original_text}
                for c in parsed.dialogue_chunks
            ],
            "diagnostics": {
                "unmatched_lines": [
                    {"line_number": u.line_number, "content": u.content}
                    for u in parsed.diagnostics.unmatched_lines
                ]
            },
        }
    )

