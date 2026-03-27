#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required to run this project. Install it first: https://docs.astral.sh/uv/" >&2
  exit 1
fi

export UVICORN_RELOAD="${UVICORN_RELOAD:-1}"

uv sync
exec uv run python -m apps.api
