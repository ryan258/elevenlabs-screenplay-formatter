from __future__ import annotations

import importlib
import sys
from unittest.mock import MagicMock

def passthrough_decorator(*_args, **_kwargs):
    def decorator(func):
        return func

    return decorator


from apps.api.schemas import GenerateZipRequest
from lib.generation import OUTPUT_FORMAT_DETAILS


def _load_api_validate_project(monkeypatch):
    mock_fastapi = MagicMock()
    mock_fastapi.APIRouter.return_value.post.side_effect = passthrough_decorator
    mock_fastapi.Depends = MagicMock()

    monkeypatch.setitem(sys.modules, "fastapi", mock_fastapi)
    monkeypatch.setitem(sys.modules, "fastapi.responses", MagicMock())

    module_name = "apps.api.routes_generate"
    sys.modules.pop(module_name, None)
    module = importlib.import_module(module_name)
    api_validate_project = module.api_validate_project
    sys.modules.pop(module_name, None)
    return api_validate_project


def _build_request(output_format: str) -> GenerateZipRequest:
    return GenerateZipRequest.model_validate(
        {
            "scriptText": "INT. TEST",
            "projectSettings": {
                "model": "eleven_monolingual_v1",
                "outputFormat": output_format,
                "speakParentheticals": False,
            },
            "characterConfigs": {},
        }
    )


def test_validate_output_format_invalid(monkeypatch):
    # Ensure invalid output format is rejected
    api_validate_project = _load_api_validate_project(monkeypatch)
    req = _build_request("invalid_format_xyz")

    mock_cfg = MagicMock()
    mock_cfg.elevenlabs.api_key = "fake_key"

    response = api_validate_project(req, mock_cfg)
    assert response.ok is False
    assert any("Invalid outputFormat" in err for err in response.errors)


def test_validate_output_format_valid(monkeypatch):
    # Ensure valid output formats are accepted
    api_validate_project = _load_api_validate_project(monkeypatch)
    valid_format = list(OUTPUT_FORMAT_DETAILS.keys())[0]
    req = _build_request(valid_format)

    mock_cfg = MagicMock()
    mock_cfg.elevenlabs.api_key = "fake_key"

    response = api_validate_project(req, mock_cfg)
    assert response.ok is True
    assert not response.errors
