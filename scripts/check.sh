#!/usr/bin/env bash
set -euo pipefail

python3 -m ruff check .
python3 -m ruff format --check .
python3 -m mypy
python3 -m pytest -q
