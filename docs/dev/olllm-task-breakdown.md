# OLLM CLI Task Breakdown (Standalone)

## Project Baseline
- Node 20+, TypeScript, ES modules.
- Monorepo with npm workspaces.
- Packages: cli, core, ollm-bridge, test-utils.
- UI: React + Ink.
- Build: esbuild; test: Vitest; lint: ESLint.

## Shared Interfaces
- Provider adapter interface and message types are defined in Stage 02.
- Tool system interfaces are defined in Stage 03.
- Hook protocol and extension manifest are defined in Stage 05.

## Task Cards

### Task A: Provider adapter and registry
Goal: Provide a provider-agnostic interface and a default local adapter.
Inputs:
- Provider types defined in Stage 02.
Steps:
- Implement ProviderRegistry.
- Implement local provider adapter with streaming and tool schema mapping.
Deliverables:
- `packages/core/src/provider/registry.ts`
- `packages/ollm-bridge/src/provider/localProvider.ts`
Tests:
- Unit test for chat stream mapping.
Acceptance criteria:
- Chat streaming works with the default local server.

### Task B: Chat runtime and tool loop
Goal: Stream responses and execute tool calls.
Inputs:
- Provider adapter interface.
- Tool registry interface.
Steps:
- Implement ChatClient and Turn.
- Detect tool calls and run tools with policy.
Deliverables:
- `packages/core/src/core/chatClient.ts`
- `packages/core/src/core/turn.ts`
Tests:
- Unit test: tool call triggers tool execution.
Acceptance criteria:
- Streaming continues after tool calls.

### Task C: Tool system and policy
Goal: Build tools with schema validation and confirmation.
Inputs:
- Tool interfaces defined in Stage 03.
Steps:
- Implement ToolRegistry, built-in tools, PolicyEngine, MessageBus.
Deliverables:
- `packages/core/src/tools/*`
- `packages/core/src/policy/*`
Tests:
- Tool schema validation tests and policy decision tests.
Acceptance criteria:
- Dangerous tools require confirmation.

### Task D: Services and sessions
Goal: Add session storage and safety services.
Inputs:
- Core runtime and tool system.
Steps:
- Implement session recording and resume.
- Add compression, loop detection, context manager.
Deliverables:
- `packages/core/src/services/*`
Tests:
- Session read/write tests.
Acceptance criteria:
- Sessions resume with correct history.

### Task E: Hooks, extensions, MCP
Goal: Enable hooks, extensions, and MCP tools.
Inputs:
- Hook protocol and manifest spec.
Steps:
- Implement hook runner and trust model.
- Implement extension manager.
- Implement MCP client and tool wrappers.
Deliverables:
- `packages/core/src/hooks/*`
- `packages/core/src/extensions/*`
- `packages/core/src/mcp/*`
Tests:
- Hook execution tests and MCP tool tests.
Acceptance criteria:
- Hooks execute and MCP tools are visible to the model.

### Task F: CLI and UI
Goal: Provide interactive and non-interactive interfaces.
Inputs:
- Core runtime APIs and services.
Steps:
- Build CLI config loader and non-interactive runner.
- Build TUI with streaming output and tool confirmations.
Deliverables:
- `packages/cli/src/cli.tsx`
- `packages/cli/src/ui/*`
Tests:
- UI render tests and non-interactive output tests.
Acceptance criteria:
- Streaming output and tool confirmations are visible in TUI.

### Task G: Model management and routing
Goal: Expose model list/pull/remove/info and routing rules.
Inputs:
- Provider adapter supports model management.
Steps:
- Implement ModelManagementService and routing rules.
- Add CLI flags and slash commands.
Deliverables:
- `packages/core/src/services/modelManagementService.ts`
- `packages/core/src/routing/modelRouter.ts`
Tests:
- Model list and pull tests (integration).
Acceptance criteria:
- Users can list and pull models from CLI.

### Task H: Testing and QA
Goal: Validate core workflows and compatibility.
Inputs:
- Completed stages.
Steps:
- Add unit, integration, and UI tests.
- Create compatibility matrix doc.
Deliverables:
- `integration-tests/`
- `docs/compatibility.md`
Acceptance criteria:
- CI passes with clear skip behavior when local server is missing.

### Task I: Docs and release
Goal: Provide user docs and release steps.
Inputs:
- Stable CLI behavior.
Steps:
- Write README, configuration docs, troubleshooting.
- Add release checklist.
Deliverables:
- `README.md`, `docs/*`
Acceptance criteria:
- New users can install and run the CLI from docs alone.
