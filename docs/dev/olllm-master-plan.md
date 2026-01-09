# OLLM CLI Development Plan (Standalone)

## Purpose
- Build a local-first CLI for open-source LLMs with tools, hooks, extensions, and MCP.
- Provide a provider-agnostic core with a default local server adapter.
- Preserve a fast, safe, and scriptable developer workflow.

## Product Requirements
- Interactive TUI (React + Ink) and non-interactive execution.
- Streaming responses with tool calls and confirmations.
- Hook system for automation and safety gates.
- Extension system and MCP tool integration.
- Model management (list, pull, remove, info).
- Session recording and resume.
- Configurable prompts, context limits, and model options.

## Non-functional Requirements
- Works offline when models are installed.
- Clear error messages with retry and backoff.
- Safe tool execution with policy enforcement.
- Fast startup and incremental rendering.
- No remote telemetry by default.

## Tech Stack
- Node 20+, TypeScript, ES modules.
- npm workspaces monorepo.
- Build: esbuild; test: Vitest; lint: ESLint; format: Prettier.
- UI: React + Ink.

## Repo Skeleton
repo/
  package.json
  tsconfig.base.json
  esbuild.config.js
  packages/
    cli/
      src/
        cli.tsx
        nonInteractive.ts
        ui/
    core/
      src/
        agents/
        config/
        core/
        extensions/
        hooks/
        mcp/
        provider/
        services/
        tools/
        utils/
    ollm-bridge/
      src/
        provider/
        adapters/
    test-utils/
  schemas/
  scripts/
  docs/

## Core Components
- Provider registry and adapters.
- Chat runtime with streaming and tool call handling.
- Tool registry, policy engine, and message bus.
- Hooks, extensions, and MCP integration.
- Services: session recording, compression, loop detection, context manager.
- CLI and UI (interactive and non-interactive).

## Stages and Deliverables

Stage 01: Foundation
- Monorepo scaffolding, base configs, build/test/lint scripts.
- Package skeletons with TypeScript entry points.

Stage 02: Core runtime and provider
- Provider interface and registry.
- Chat runtime with streaming events.
- Default local provider adapter and tool call translation.

Stage 03: Tool system and policy
- Tool interfaces, registry, built-in tools.
- Policy engine and confirmation UI.

Stage 04: Services and sessions
- Session recording, compression, loop detection.
- Context manager, file discovery, env sanitization.

Stage 05: Hooks, extensions, MCP
- Hook runner and trust model.
- Extension manifest and loader.
- MCP client and tool wrappers.

Stage 06: CLI and UI
- CLI flags, slash commands, non-interactive runner.
- TUI components, debug console, accessibility.

Stage 07: Model management and routing
- Model list/pull/remove/info.
- Routing rules and per-model limits.

Stage 08: Testing and QA
- Unit, integration, and UI tests.
- Compatibility matrix for representative models.

Stage 09: Docs and release
- README, configuration reference, troubleshooting.
- Packaging and release workflow.

## Stage Gates (Definition of Done)
- Each stage ships with tests for its public surfaces.
- Every new API has docs and examples.
- All CLI flags are documented and covered by smoke tests.
- Security and policy checks are enforced in all tool executions.
