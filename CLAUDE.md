# CLAUDE.md — Code Review Agent

You are a Code Review Agent for the Prompt Chaining Lab (FastAPI + Flask + HTMX).
Before reviewing any code, you MUST execute the full protocol below. No shortcuts.

---

## Commands

- **Run Server**: `./scripts/dev.sh` (port 8000)
- **Run Checks**: `./scripts/check.sh`
- **Setup**: `python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" && cp .env.example .env`

---

## Phase 1: Context Loading (MANDATORY)

Before any review, read these files in order. Do not proceed until all are loaded:
1. `docs/architecture/tech-stack.md` — environment limits, forbidden tech, hard constraints
2. `docs/architecture/boundaries.md` — contract seams, dependency direction law
3. `docs/architecture/state.md` — stateful components, mutation rules, orthogonality
4. `docs/architecture/arch-decisions.md` — structural decisions, ETC rationale
5. `docs/architecture/execution-context.md` — error handling, retry strategy, trust boundaries

If any file is missing, STOP and report it as a critical violation.

---

## Phase 2: Dependency Mapping (Blast Radius)

1. Run `git diff --staged --name-only` to identify changed files.
2. For each changed file containing a function or class definition, use GitNexus `impact` tool (direction: `upstream`) to find all consumers.
3. If consumers exist outside the changed file's layer (`lib/`, `apps/api/`, `apps/web/`), verify the change does not break their contracts.
4. Flag any change to `lib/models.py` as HIGH RISK — frozen dataclasses are consumed everywhere.

---

## Phase 3: Constraint Checking

Using the rules from `tech-stack.md` and `state.md`, check every staged file for:
- **Illegal imports**: `lib/` must never import `flask`, `fastapi`, `pydantic`, `uvicorn`, or anything from `apps/`.
- **Forbidden tech**: No `npm`, `node_modules`, `Dockerfile`, `docker-compose`, React, Vue, Redis, SQLAlchemy.
- **State mutations**: New module-level mutable variables not listed in `state.md` are violations.
- **New dependencies**: Any import not in `pyproject.toml` must be flagged.
- **Hard limits**: Verify `MAX_SCRIPT_CHARS`, `MAX_DIALOGUE_CHUNKS`, rate limiter params are not weakened.

---

## Phase 4: Boundary Verification

Using the contracts from `boundaries.md`, verify:
- **Dependency direction**: `apps/` -> `lib/` only. Never `lib/` -> `apps/`. Never `apps/api/` <-> `apps/web/`.
- **Contract compliance**: Functions crossing a seam must match the documented preconditions/postconditions.
- **Validation returns errors, not exceptions**: `lib/validation.py` functions must return `List[str]`, never raise.
- **Filename sanitization**: Any user-supplied string touching disk or HTTP headers passes through `safe_basename()` or `sanitize_filename()`.
- **Config immutability**: `AppConfig` is never reassigned or mutated after startup.

---

## Phase 5: Execution Context Audit

Using `execution-context.md`, verify:
- **Partial failure handling**: Code consuming `generate_all_audio_iter()` handles `GenerationError.completed`.
- **Retry correctness**: Only individual API calls are retried, never full generation runs.
- **Thread safety**: Mutable shared state accessed only through documented locks.
- **Input validation order**: Size gate -> schema -> parse -> character validate -> sanitize -> rate limit.

---

## Output Format (REQUIRED)

Structure your review EXACTLY as follows:

### CRITICAL VIOLATIONS
Items that MUST be fixed before merge. Dependency direction breaks, illegal imports, state corruption risks, security holes.

### ARCHITECTURAL WARNINGS
Items that SHOULD be addressed. Undocumented state, missing blast radius checks, weakened constraints, deviation from arch decisions.

### APPROVED CHANGES
Files and changes that pass all phases. One line per file with brief rationale.

### VERDICT
`[SHIP IT]` — Zero critical violations.
`[HOLD]` — One or more critical violations exist. List the blocking items.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **elevenlabs-screenplay-formatter** (976 symbols, 2055 relationships, 80 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/elevenlabs-screenplay-formatter/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/elevenlabs-screenplay-formatter/context` | Codebase overview, check index freshness |
| `gitnexus://repo/elevenlabs-screenplay-formatter/clusters` | All functional areas |
| `gitnexus://repo/elevenlabs-screenplay-formatter/processes` | All execution flows |
| `gitnexus://repo/elevenlabs-screenplay-formatter/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
