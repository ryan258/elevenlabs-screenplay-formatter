import json
from unittest.mock import MagicMock, patch
import pytest

from lib.config import ElevenLabsConfig
from lib.elevenlabs.client import ElevenLabsClient, NonRetryableError
from lib.models import VoiceSettings


@pytest.fixture
def client():
    config = ElevenLabsConfig(
        api_key="test_key", base_url="https://api.elevenlabs.io", timeout_s=5.0
    )
    return ElevenLabsClient(config)


def test_list_voices_success(client):
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(
            {"voices": [{"voice_id": "123", "name": "Test Voice", "category": "premade"}]}
        ).encode("utf-8")
        mock_resp.headers = {}
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        voices = client.list_voices()
        assert len(voices) == 1
        assert voices[0].voice_id == "123"
        assert voices[0].name == "Test Voice"


def test_generate_audio_success(client):
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b"audio_data"
        mock_resp.headers = {"x-ratelimit-remaining": "100"}
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        data, remaining = client.generate_audio(
            voice_id="123",
            text="Hello world",
            model_id="test_model",
            output_format="mp3_44100_128",
            voice_settings=VoiceSettings(stability=0.5, similarity_boost=0.5, style=0.5, speed=1.0),
        )
        assert data == b"audio_data"
        assert remaining == 100


def test_generate_audio_non_retryable_error(client):
    from urllib.error import HTTPError

    with patch("urllib.request.urlopen") as mock_urlopen:
        fp = MagicMock()
        fp.read.return_value = b"Unauthorized"
        err = HTTPError(url="", code=401, msg="Unauthorized", hdrs={}, fp=fp)
        mock_urlopen.side_effect = err

        with pytest.raises(NonRetryableError, match="401"):
            client.generate_audio(
                voice_id="123",
                text="Hello world",
                model_id="test_model",
                output_format="mp3_44100_128",
                voice_settings=VoiceSettings(
                    stability=0.5, similarity_boost=0.5, style=0.5, speed=1.0
                ),
            )
