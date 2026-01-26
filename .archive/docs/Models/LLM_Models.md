**LLM Models Inventory & Schema Review**

Summary
- Sources: `packages/cli/src/config/LLM_profiles.json` (user-facing profiles) and `packages/core/src/routing/modelDatabase.ts` (runtime capability DB).
- Purpose: centralize known models, verify fields used at runtime (context_window, context_profiles, tool_support), and propose a small, typed JSON schema for easier validation and runtime use.

Current Observations
- `LLM_profiles.json` contains rich per-model entries including `context_profiles` with `size`, `size_label`, `vram_estimate` (human string), and `ollama_context_size`.
- `ProfileManager` (CLI) imports and uses `LLM_profiles.json` to present profiles and to build fallback context profiles when Ollama returns only model size in bytes.
- `packages/core/src/routing/modelDatabase.ts` currently provides `ModelEntry` records (pattern, family, contextWindow, capabilities) used at runtime (e.g. `modelDatabase.getCapabilities()` and `getContextWindow()`).

Gaps / Mismatches
- `LLM_profiles.json` uses human-friendly `vram_estimate` strings ("5.5 GB"). Runtime code would prefer numeric bytes to compute thresholds.
- `modelDatabase` capability flags (`toolCalling`, `vision`, `streaming`, `reasoning`) are not mirrored in the CLI profiles schema explicitly.
- No explicit VRAM requirement mapping per `context_profile` (numeric bytes) to compare against detected GPU VRAM.
- `LLM_profiles.json` includes fields used by the CLI UI (`thinking_enabled`, `reasoning_buffer`, `warmup_timeout`) — fine for UI but some should be normalized for runtime feature toggles.

Recommended JSON Schema (summary)
Required top-level fields for each model entry:
- `id` (string): canonical id used by runtime (e.g. `qwen2.5:7b`).
- `name` (string)
- `family` (string?) optional but helpful to map to `modelDatabase` family
- `parameters` (string) and optional `parameters_num` (number)
- `max_context_window` (number): maximum model context tokens
Plan
- Stage 1: Codebase refactor so `packages/cli/src/config/LLM_profiles.json` is the single source of truth and `modelDatabase` routes only (no hard-coded metadata).
- Stage 2: Review and update model entries in `LLM_profiles.json` (normalize VRAM numbers, add `capabilities`, review `max_context_window` values).

- `context_profiles` (array of objects): each with
  - `size` (number)
  - `size_label` (string)
  - `vram_estimate_gb` (number)  -- numeric GB for comparisons
  - `vram_estimate` (string) -- optional human-friendly
  - `ollama_context_size` (number)
- `default_context` (number)
- `capabilities` (object): { `toolCalling`: boolean, `vision`: boolean, `streaming`: boolean, `reasoning`: boolean }
- `tool_support` (boolean) and `tool_support_source` ('profile'|'user_confirmed'|'auto_detected'|'runtime_error')

Optional runtime tuning fields
- `vram_loaded_bytes` (number): estimated VRAM consumed when model is loaded at recommended quantization
- `quantization` (string)
- `thinking_enabled` (boolean)
- `reasoning_buffer` (string|number)
- `warmup_timeout` (ms)

Concrete next steps (recommended)
1. Normalize `vram_estimate` into numeric `vram_estimate_gb` or `vram_estimate_bytes` in `LLM_profiles.json` and validate on load in `ProfileManager`.
2. Add a `capabilities` object in `LLM_profiles.json` that mirrors `modelDatabase` flags (`toolCalling`, `vision`, `streaming`, `reasoning`) to avoid duplicated logic and to make CLI profiles authoritative for UI.
3. Wire `ProfileManager` to produce numeric context profiles (GB/bytes) and expose them via the existing `getProfiles()` API used by the UI.
4. Update `modelDatabase` entries or add a mapping step so `modelDatabase.getCapabilities()` and `ProfileManager.findProfile()` stay consistent. Consider deriving `modelDatabase` from a single canonical source or add synchronization tests.
5. Use VRAM monitor (existing `VRAMMonitor`) to compute feasible `context_profiles` at runtime. `ProfileManager.buildFallbackContextProfiles()` already accepts `sizeBytes` — extend it to prefer numeric VRAM estimates when available.

Actionables for the repo (I can implement these):
- Convert `vram_estimate` strings in `packages/cli/src/config/LLM_profiles.json` to numeric `vram_estimate_gb` values and add `capabilities` blocks.
- Add validation in `packages/cli/src/features/profiles/ProfileManager.ts` to coerce `vram_estimate` into numbers and warn on missing fields.
- (Optional) Add a small script to reconcile `LLM_profiles.json` entries with `packages/core/src/routing/modelDatabase.ts` and report mismatches.

Where to store updates
- Primary source for user-visible profiles: `packages/cli/src/config/LLM_profiles.json` (keep as canonical for UI).
- Runtime canonical capabilities: consider adding a generated `packages/core/src/routing/generated_model_db.ts` derived from `LLM_profiles.json` during build, or keep `modelDatabase.ts` as the runtime source but ensure synchronization.

If you want, I can now:
- (A) Update `LLM_profiles.json` entries to add numeric `vram_estimate_gb` and `capabilities` fields for each model.
- (B) Add input-validation/coercion in `ProfileManager` and a small reconciliation check against `modelDatabase`.
- (C) Implement both and run tests.

Choose A, B, C, or ask for a narrower change and I will implement it.
