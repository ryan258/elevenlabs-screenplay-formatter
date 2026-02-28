# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## MISSION BRIEFING: Prompt Chaining Lab

A Python framework for creating sequential LLM workflows where each step builds on previous discoveries.
**Stack**: FastAPI + Jinja2 + HTMX + SQLite. **NO React. NO Docker. NO Redis. NO User Accounts.**

---

## Commands

**Run Server**: `./scripts/dev.sh` (port 8000)

- Checks: `./scripts/check.sh`

**Setup:**

1. `python3 -m venv .venv && source .venv/bin/activate`
2. `pip install -e ".[dev]"`
3. Copy `.env.example` to `.env`

---

## Architecture: The Anti-Gravity Standard

### Core Components

- **Arsenal (`lib/`)**: Pure Python modules. Independent. Copy-paste ready.
  - `config.py`: Core configuration dataclasses.
  - `parser.py`: Screenplay parsing and diagnostics.
  - `elevenlabs/`: API client, retries, rate limiting.
  - `exports/`: ZIP, SRT/VTT, Reaper generators.
  - `models.py`: Immutable data models.
- **Frontend (`apps/web/templates/`)**: Jinja2 pages with HTMX for interactivity.
- **Entry (`apps/api/main.py`)**: Thin routing layer.

### Data Flow

1. **Input**: User submits form (HTMX POST).
2. **Process**: Backend `lib/` modules execute logic.
3. **Update**: Server returns HTML partials (HTMX swap).

---

## Critical Patterns (Mission Control Intel)

### Pattern 1: The "Arsenal" Test

- BEFORE writing code, ask: "Can I move `lib/my_module.py` to another project and use it instantly?"
- If NO -> Refactor. Dependencies usually flow `apps/` -> `lib/`. NEVER `lib/` -> `apps/`.

### Pattern 2: Candlelight UI

- Use `apps/web/static/candlelight.css` (CSS Variables).
- **Bg**: `#121212`, **Text**: `#EBD2BE`, **Accent**: `#A6ACCD`.
- NO CSS frameworks (Tailwind allowed ONLY via CDN if absolutely necessary, prefer vanilla).

### Pattern 3: No-Bloat

- **Forbidden**: `npm`, `node_modules`, `Dockerfile`, `docker-compose.yml`.
- **Reason**: We run on bare metal. We own the stack.

---

## Code Review Protocol

**FINAL VERDICT:** [SHIP IT 🚢] or [HOLD 🛑]

- **Bloat Check**: Any React/Vue? Any Docker? -> **HOLD**.
- **Arsenal Check**: Logic in `routes` instead of `lib`? -> **HOLD**.
- **Visuals**: Not Candlelight? -> **HOLD**.

---

## File Map

**Backend:**

- `lib/` - The Core (Arsenal).
- `apps/api/` - FastAPI routes and schemas.
- `apps/web/` - Flask frontend.
- `apps/web/templates/` - HTML/HTMX.
- `apps/web/static/` - CSS/JS (minimal).
