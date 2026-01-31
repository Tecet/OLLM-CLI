# DEVLOG — OLLM CLI

**Project:** OLLM CLI  
**Window:** 2026-01-24 → 2026-01-31  
**Purpose:** Lightweight timeline of key decisions, reworks, and milestones.

---

## 2026-01-24 — UI + Chat Context

- Built out ChatContext UI pass and flow refinements.
- Stabilized the basic chat view and interaction cadence.

## 2026-01-26 — Sessions & Context

- Implemented sessions context mechanics and early compression strategy.
- Added baseline auditing to validate message ordering and context integrity.

## 2026-01-27 — Refactoring + Tools

- Refactored core system surfaces to reduce drift from intended architecture.
- Tightened tool calling patterns and aligned with prompt routes.

## 2026-01-28 — Compression + Filtering

- Completed context compression audit and filtering improvements.
- Verified snapshot lifecycle invariants and checkpoint handling.

## 2026-01-29 — Sessions Rework

- Full rework of sessions and prompt builder integration.
- Moved system prompt components to template files and reduced token overhead.
- Enabled User mode and per-mode tool configuration.

## 2026-01-30 — Alpha Publish Readiness

- Completed build and alpha release checklists.
- Finalized publish instructions and tool overload fix.
- Prepared public-ready README and documentation set.

## 2026-01-31 — Post-Hackathon Cleanup

- Documentation polish, prompt index, and project summary.
- Verification pass on lint/build/test and cleanup of test noise.

---

## Key Decisions (Condensed)

- **Template-based prompts:** Moved mandates, skills, and tool descriptions out of TS.
- **Per-mode tools:** Tools now filtered by mode with wildcard support.
- **User mode enabled:** Added user mode to extend customization without code changes.
- **Compression guardrails:** Preserve snapshots before destructive actions.

---

## Notes

Detailed narrative and rationale are in `.kiro/logs/KIRO Hackaton.md`.
