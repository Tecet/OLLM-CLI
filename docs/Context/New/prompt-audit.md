# Prompt Routing Audit - prompt-audit.md

Date: 2026-01-22

## Summary
- Adaptive prompt routing is implemented and follows the documented design: prompts selected by (tier × mode).
- The code chooses prompt tier using `getEffectivePromptTier()`; when `autoSize` is true it locks to hardware capability, otherwise it uses the actual (user) context tier.
- Mode templates and system prompt templates exist for the combinations (e.g., `tier1-developer`).

## Key Findings (evidence)
- Tier selection logic (mapping maxTokens → tiers) and effective-tier behaviour: [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts#L880-L993)
  - `getEffectivePromptTier()` returns `hardwareCapabilityTier` when `config.autoSize` is true, else `actualContextTier`.
- Prompt selection & application:
  - `getSystemPromptForTierAndMode()` builds the lookup key (`tierX-mode`) and falls back to `tier3-developer`: [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts#L1004-L1018)
  - `updateSystemPrompt()` inserts the selected system prompt message and emits `system-prompt-updated`: [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts#L1058-L1075)
- Templates exist in code:
  - System prompt templates (static, used as fallback / shipped templates): [packages/core/src/context/types.ts](packages/core/src/context/types.ts#L559-L586)
  - Mode-specific mode templates used by PromptModeManager (developer persona): [packages/core/src/prompts/templates/modes/developer.ts](packages/core/src/prompts/templates/modes/developer.ts#L1)
  - Template registry and builder are present: [packages/core/src/context/SystemPromptBuilder.ts](packages/core/src/context/SystemPromptBuilder.ts#L1-L20)

## Behavior Verified
- Case: user runs `/mode developer` with a 2–4K context (manual sizing, `autoSize: false`):
  - `detectContextTier()` maps `maxTokens <= 4096` → Tier 1.
  - `getEffectivePromptTier()` (manual) → `actualContextTier` (Tier 1).
  - Lookup key becomes `tier1-developer` and `SYSTEM_PROMPT_TEMPLATES['tier1-developer']` is applied.
  - Code path: [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts#L963-L1010) and update flow at [packages/core/src/context/contextManager.ts](packages/core/src/context/contextManager.ts#L1058-L1096).

- Case: same user selection but `autoSize: true` (default in code):
  - `getEffectivePromptTier()` will return `hardwareCapabilityTier` (locked at startup via `detectHardwareCapabilityTier()`), so if hardware supports a larger tier the applied prompt will be that higher tier (not `tier1`).
  - This matches documented behavior: auto-sizing locks prompt tier to hardware to avoid mid-conversation changes. See docs in [docs/Context/Prompts-Routing.md](docs/Context/Prompts-Routing.md#hardware-aware-prompt-selection).

## Gaps / Notes
- Docs sometimes say "prompt tier selection is based on user-selected size" (clarified in the doc that budgets are based on shown size vs 85% cap). The code's rule is: selection is based on user-selected size except when `autoSize` is enabled, in which case hardware tier is used and locked for the session. This is consistent with the detailed diagrams in the docs but worth noting the conditional behavior.
- Prompt templates are embedded in `types.ts` as fallback/static templates; other prompt builders (SystemPromptBuilder and PromptModeManager) assemble additional prompt layers (identity, mandates, mode template). The effective system prompt applied by `ContextManager.updateSystemPrompt()` uses the `SYSTEM_PROMPT_TEMPLATES` lookup.

## Reproduction / Quick Tests
- Manual-size (force Tier 1) & Developer mode (Node REPL or unit test):
  1. Create manager with `autoSize: false` and `targetSize: 4096`.
  2. `await manager.start();` (or set currentContext.maxTokens and call `manager.updateConfig({ targetSize: 4096 })`).
  3. `manager.setMode(OperationalMode.DEVELOPER);`
  4. Inspect `manager.getSystemPrompt()` → should match `tier1-developer` template from `types.ts`.

- Auto-size (default) behavior:
  1. Start manager with `autoSize: true` (default).
  2. The prompt tier will be locked to `hardwareCapabilityTier` computed at startup and will not change on auto-resizes.

## Conclusion
- Implementation follows the documented routing: tier × mode → `tier{n}-{mode}` lookup in `SYSTEM_PROMPT_TEMPLATES` and application via `updateSystemPrompt()`.
- For the specific example you gave (`/mode developer` + 2–4K context), the system will apply `tier1-developer` only when `autoSize` is disabled or when hardware capability tier is Tier 1; otherwise the hardware-locked tier is used.

If you want, I can:
- Add a small unit test that asserts `tier1-developer` is applied when `autoSize: false` and `targetSize: 4096`.
- Run the test suite or a focused test for the prompt selection flow.

---
Audit done. Report saved to `.dev/prompt-audit.md`.

## Reasoning & Model-Detection (additional findings)

- Current state:
  - The codebase contains explicit reasoning infrastructure: `packages/core/src/services/reasoningParser.ts` (parses `<think>...</think>` blocks and produces `ReasoningBlock` structures) and tooling to surface reasoning traces (`packages/core/src/tools/read-reasoning.ts`, `packages/core/src/tools/MemoryDumpTool.ts`).
  - Model capability metadata exists (`ModelCapabilities` in `packages/core/src/services/modelManagementService.ts`) and model routing (`modelRouter` / `modelDatabase`) is present to select models by capability.
  - Tool capability detection and routing exists (`packages/core/src/tools/tool-capabilities.ts`, `packages/core/src/tools/toolRouter.ts`) and `PromptModeManager` already includes tool lists when building prompts.
  - Snapshot generation paths (HotSwapService.generateSnapshot / `generateSnapshot()` in `packages/core/src/context/HotSwapService.ts`) currently use the `STATE_SNAPSHOT_PROMPT` as the system prompt for snapshot-generation; there is no conditional injection of a reasoning-specific instruction there today.
  - `PromptModeManager.buildPrompt()` assembles a core prompt + mode template + workspace + tools + `additionalInstructions`, but it does not accept model capability flags (reasoning/tools capability) nor does it automatically add a reasoning-mode layer.

- Implication:
  - Snapshots and reseed flows do NOT currently inject special reasoning instructions for models that support internal-chain-of-thought or tool usage. As a result, reasoning-capable models may not receive explicit guidance to surface or preserve their internal `<think>` traces in snapshots.

- Recommended changes (minimal, incremental):
  1. Extend `PromptBuildOptions` / `PromptModeManager.buildPrompt()` to accept a `modelCapabilities?: ModelCapabilities` (or a smaller `{ reasoning?: boolean; supportsTools?: boolean }`) parameter. Use this to add an extra prompt layer when applicable:
     - If `reasoning: true`: prepend an instruction like "[REASONING MODE] Preserve and emit your internal reasoning traces enclosed in <think>...</think>. When generating snapshots, include reasoning traces in a <reasoning_traces>...</reasoning_traces> section." into `additionalInstructions` or its own `# Reasoning Mode` section.
     - If `supportsTools: false`: append a small note telling model not to assume tool availability; if `supportsTools: true`, ensure tool schemas / allowed tool list are added (already partly implemented).
  2. Update HotSwapService.generateSnapshot() to detect model capabilities for the current model (via the model management service, `modelDatabase.getCapabilities(model)` or via the `provider` metadata). When generating the XML snapshot, either:
     - Call `modeManager.buildPrompt({ ..., modelCapabilities })` so the built system prompt includes reasoning instructions, or
     - Prepend a small reasoning-specific instruction to `systemPrompt` before calling the provider for the XML snapshot.
  3. When producing stored snapshots (JSON/XML), include an explicit `reasoning_traces` field populated by `ReasoningParser.parse(...)` runs over the conversation outputs where `<think>` blocks are present. This makes traces queryable when restoring or `read-reasoning` is invoked.
  4. Wire `ToolRouter`/`ModelCapabilities` into prompt-building so prompts reflect actual tool availability (the UI already filters tools for prompts in places, but ensure HotSwap / snapshot flows also pass the filtered tool list into `buildPrompt`).

- Where to implement (recommended files):
  - `packages/core/src/prompts/PromptModeManager.ts` — extend `PromptBuildOptions` and `buildPrompt()` to accept and use `modelCapabilities`.
  - `packages/core/src/context/HotSwapService.ts` — detect model capabilities and pass them into snapshot-generation (or prepend instruction), and include reasoning traces in the stored snapshot object passed to `SnapshotManager`.
  - `packages/core/src/services/modelManagementService.ts` / `routing/modelRouter.ts` — use these to obtain capability flags for the active model.
  - `packages/core/src/context/SnapshotParser.ts` — extend to serialize/deserialize the `reasoning_traces` section.

- Minimal example injection text (suggested):
  - "[REASONING MODE] You may include internal reasoning traces enclosed in <think>...</think>. Preserve these traces in the snapshot under a separate <reasoning_traces> section so they can be reviewed or reloaded by the assistant. If tools are available, include instructions on how to call them and preferred schemas."

- Suggested tests to add:
  - Unit test asserting that `PromptModeManager.buildPrompt()` includes the reasoning section when passed `modelCapabilities.reasoning = true`.
  - Integration test asserting that `HotSwapService.swap(..., preserveHistory=false, toMode?)` will include `reasoning_traces` in stored snapshot when the model has reasoning capability and the conversation contains `<think>` blocks parsed by `ReasoningParser`.

## Next actions I can take

- Implement the `modelCapabilities` plumbing in `PromptModeManager.buildPrompt()` and add unit tests (small change, low risk).  
- Implement the HotSwap snapshot injection (detect capabilities + include reasoning traces) and add an integration test for snapshot contents.  
- Or, if you prefer, I can just add documentation to the design docs reflecting this recommended behavior and link the code areas to change.

Which of the three (implement code changes, add design docs, or both) would you like me to do next?
