#!/usr/bin/env bash
set -euo pipefail

export UVICORN_RELOAD="${UVICORN_RELOAD:-1}"
uv run python -m apps.api
