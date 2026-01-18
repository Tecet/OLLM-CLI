# OLLM CLI Development Plan

## Overview

This document outlines the development plan for OLLM CLI, a local-first command-line interface for open-source LLMs. The plan is divided into 9 stages, each with clear deliverables and dependencies.

For detailed architecture information, see [Architecture Documentation](../docs/architecture.md).

## Tech Stack Summary

- **Runtime**: Node.js 20+, TypeScript (strict mode), ES modules
- **Build**: npm workspaces monorepo, esbuild bundling
- **Testing**: Vitest
- **UI**: React + Ink (terminal UI)
- **Linting/Formatting**: ESLint + Prettier

## Key Design Principles

- **Local-first**: No remote telemetry by default, works offline when models are installed
- **Provider-agnostic**: Supports multiple LLM backends via adapters
- **Safe tool execution**: Policy enforcement with confirmation modes (ASK, AUTO, YOLO)
- **Fast startup**: Incremental rendering, lazy loading
- **Clear error messages**: Retry and backoff strategies

## Stage Dependencies

```
Stage 01 (Foundation)
    │
    v
Stage 02 (Core Runtime & Provider)
    │
    ├──────────────────┬──────────────────┐
    v                  v                  v
Stage 03 (Tools)    Stage 04 (Services)  │
    │                  │                  │
    │                  v                  │
    │            Stage 04b (Context Mgmt) │
    │                  │                  │
    └────────┬─────────┴──────────────────┘
             v
Stage 05 (Hooks, Extensions, MCP)
             │
             v
Stage 06 (CLI & UI)
             │
             v
Stage 07 (Model Management & Routing)
             │
             v
Stage 08 (Testing & QA)
             │
             v
Stage 09 (Docs & Release)
```

## Architecture Reference

The following key interfaces and patterns are defined in the [Architecture Documentation](../docs/architecture.md):

- **Provider System**: `ProviderAdapter`, `ProviderEvent`, `Message` interfaces
- **Tool System**: `DeclarativeTool`, `ToolInvocation`, `ToolRegistry`
- **Hook System**: Event-driven customization with JSON protocol
- **Context Management**: VRAM monitoring, snapshots, compression strategies
- **Policy Engine**: ASK, AUTO, YOLO approval modes

---

## Stage 01: Foundation and Repo Scaffolding

**Goal**: Create a clean repo skeleton that can be built and tested.

**Prerequisites**: None

**Estimated Effort**: 1-2 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S01-T01 | Workspace and package manifests | `package.json`, `packages/*/package.json` |
| S01-T02 | TypeScript base config | `tsconfig.base.json`, `packages/*/tsconfig.json` |
| S01-T03 | Build pipeline | `esbuild.config.js`, `scripts/build.js` |
| S01-T04 | Lint and format | `eslint.config.js`, `.prettierrc.json` |
| S01-T05 | Base CLI entry | `packages/cli/src/cli.tsx` |

### Acceptance Criteria
- `npm install` succeeds
- `npm run build` creates `dist/` output
- `npm run lint` and `npm run format` run without error
- `node dist/cli.js --version` prints version

---

## Stage 02: Core Runtime and Provider Interface

**Goal**: Define provider-agnostic interfaces and implement core chat runtime.

**Prerequisites**: Stage 01 complete

**Estimated Effort**: 3-4 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S02-T01 | Provider registry | `packages/core/src/provider/registry.ts` |
| S02-T02 | Chat runtime and stream events | `packages/core/src/core/chatClient.ts`, `turn.ts` |
| S02-T03 | Tool call loop | Tool call queue in `Turn` |
| S02-T04 | Default local provider adapter | `packages/ollm-bridge/src/provider/localProvider.ts` |
| S02-T05 | ReAct fallback | `packages/core/src/core/reactToolHandler.ts` |
| S02-T06 | Token estimation | `packages/core/src/core/tokenLimits.ts` |

### Key Interfaces to Implement

See [Architecture - Core Interfaces](../docs/architecture.md#core-interfaces) for detailed type definitions:

- `Message`, `ToolSchema`, `ToolCall`
- `ProviderRequest`, `ProviderEvent`, `ProviderAdapter`
- `ModelInfo`, `PullProgress`

### Acceptance Criteria
- Can register and resolve providers by name
- Chat streaming works with local server
- Tool calls trigger execution and continuation
- ReAct loop works when native tool calling is disabled

---

## Stage 03: Tool System and Policy

**Goal**: Implement robust tool system with schema validation and confirmation.

**Prerequisites**: Stage 02 complete

**Estimated Effort**: 4-5 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S03-T01 | Tool registry | `packages/core/src/tools/tool-registry.ts` |
| S03-T02 | File tools | `read-file.ts`, `write-file.ts`, `edit-file.ts`, `glob.ts`, `grep.ts`, `ls.ts` |
| S03-T03 | Shell tool | `shell.ts`, `shellExecutionService.ts` |
| S03-T04 | Web tools | `web-fetch.ts`, `web-search.ts` |
| S03-T05 | Policy engine and message bus | `packages/core/src/policy/*`, `confirmation-bus/*` |
| S03-T06 | Tool output handling | Output helpers with truncation |

### Built-in Tools

See [Architecture - Built-in Tools](../docs/architecture.md#built-in-tools) for the complete tool list:

- `read_file`, `read_many_files`, `write_file`, `edit_file`
- `glob`, `grep`, `ls`
- `shell`
- `web_fetch`, `web_search`
- `memory`

### Policy Engine

Implements three approval modes (see [Architecture - Security](../docs/architecture.md#security-architecture)):
- **ASK**: Always ask for confirmation
- **AUTO**: Auto-approve safe operations
- **YOLO**: Auto-approve everything

### Acceptance Criteria
- Tools are discoverable and ordered predictably
- File tools support line ranges and robust errors
- Shell commands execute with streaming and timeouts
- Dangerous tools require confirmation based on policy

---

## Stage 04: Services and Sessions

**Goal**: Persist sessions and manage context safely.

**Prerequisites**: Stage 02 complete (can run parallel with Stage 03)

**Estimated Effort**: 3-4 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S04-T01 | Session recording | `chatRecordingService.ts` |
| S04-T02 | Chat compression | `chatCompressionService.ts` |
| S04-T03 | Loop detection | `loopDetectionService.ts` |
| S04-T04 | Context manager | `contextManager.ts` |
| S04-T05 | File discovery | `fileDiscoveryService.ts` |
| S04-T06 | Environment sanitization | `environmentSanitization.ts` |

### Data Locations
- User data: `~/.ollm/`
- Workspace data: `.ollm/`
- Sessions: `~/.ollm/session-data/`

### Acceptance Criteria
- Sessions can be resumed and listed
- Compression replaces older history with summary
- Loop detection stops runaway tool calls
- Sensitive env variables are redacted

---

## Stage 04b: Context Management System

**Goal**: Implement memory-efficient context management with VRAM-based sizing, snapshots, and compression.

**Prerequisites**: Stage 04 complete

**Estimated Effort**: 3-4 days

**Reference**: `docs/dev-draft/context-management-plan.md`

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S04b-T01 | VRAM Monitor Service | `vramMonitor.ts`, `gpuDetector.ts` |
| S04b-T02 | Token Counter Integration | `tokenCounter.ts` |
| S04b-T03 | Context Pool | `contextPool.ts` |
| S04b-T04 | Snapshot Storage | `snapshotStorage.ts` |
| S04b-T05 | Snapshot Manager | `snapshotManager.ts` |
| S04b-T06 | Compression Service | `compressionService.ts`, `compressionStrategies.ts` |
| S04b-T07 | Memory Guard | `memoryGuard.ts` |
| S04b-T08 | /context Command | `contextCommand.ts`, `ContextStatus.tsx` |

### Key Features
- Dynamic context sizing based on available VRAM
- Context snapshots for conversation rollover
- Multiple compression strategies (summarize, truncate, hybrid)
- Memory guard to prevent OOM errors
- `/context` slash command for user control

### Acceptance Criteria
- VRAM monitoring works on NVIDIA/AMD/Apple Silicon
- Context auto-sizes based on available memory
- Snapshots save and restore correctly
- Compression reduces context while preserving meaning
- OOM errors are prevented

---

## Stage 05: Hooks, Extensions, and MCP

**Goal**: Enable event-driven customization and external tool integration.

**Prerequisites**: Stages 03 and 04 complete

**Estimated Effort**: 4-5 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S05-T01 | Hook system core | `packages/core/src/hooks/*` |
| S05-T02 | Hook trust model | `trustedHooks.ts` |
| S05-T03 | Extension manager | `extensionManager.ts` |
| S05-T04 | MCP client and tool wrappers | `packages/core/src/mcp/*`, `mcp-tool.ts` |

### Hook Events

See [Architecture - Hook System](../docs/architecture.md#hook-system) for the complete event list:

- `session_start`, `session_end`
- `before_agent`, `after_agent`
- `before_model`, `after_model`
- `before_tool`, `after_tool`

### Hook Protocol

Hooks communicate via JSON over stdin/stdout:
```json
// Input
{ "event": "before_model", "data": { "prompt": "...", "model": "..." } }

// Output
{ "continue": true, "systemMessage": "optional message" }
```

### Extension Locations
- User: `~/.ollm/extensions/`
- Workspace: `.ollm/extensions/`

### MCP Integration

See [Architecture - MCP Integration](../docs/architecture.md#mcp-integration) for transport details:
- STDIO, SSE, and HTTP transports
- Tool discovery and registration
- Dynamic tool updates

### Acceptance Criteria
- Hooks execute in order with timeout handling
- Untrusted hooks require explicit approval
- Extensions are discoverable and can be enabled/disabled
- MCP tools appear in registry and can execute

---

## Stage 06: CLI and UI

**Goal**: Provide full interactive TUI and non-interactive runner.

**Prerequisites**: Stage 05 complete

**Estimated Effort**: 4-5 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S06-T01 | CLI config loader | `packages/cli/src/config/*`, `schemas/settings.schema.json` |
| S06-T02 | Non-interactive runner | `nonInteractive.ts` |
| S06-T03 | Interactive UI | `packages/cli/src/ui/*` |
| S06-T04 | Model UI and status | `packages/cli/src/ui/components/model/*` |

### CLI Flags
- `--prompt, -p`: one-shot prompt
- `--model, -m`: select model
- `--provider`: select provider
- `--host`: provider endpoint
- `--list-models`, `--pull-model`, `--remove-model`, `--model-info`
- `--output`: text|json|stream-json
- `--debug`, `--no-color`

### Slash Commands
- `/model list|use|pull|rm`
- `/provider list|use`
- `/session list|resume|delete`
- `/extensions list`

### Acceptance Criteria
- Settings merge deterministically and validate on load
- `ollm -p "hello"` prints output and exits cleanly
- Chat streams in TUI with tool output and confirmations
- Users can switch models in UI

---

## Stage 07: Model Management and Routing

**Goal**: Implement model management services and routing rules.

**Prerequisites**: Stage 06 complete

**Estimated Effort**: 2-3 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S07-T01 | Model management service | `modelManagementService.ts` |
| S07-T02 | Model routing | `modelRouter.ts` |
| S07-T03 | Model limit map | `modelLimits.ts` |
| S07-T04 | Model options schema | `schemas/settings.schema.json` |

### Routing Profiles

See [Architecture - Model Routing](../docs/architecture.md#model-routing) for profile details:

- `fast`: Quick responses, smaller models (phi, gemma, mistral)
- `general`: Balanced performance (llama, mistral, qwen)
- `code`: Code-optimized models (codellama, deepseek-coder, starcoder)
- `creative`: Creative writing models

### Model Database

Maintain known model limits and capabilities:
- Context window sizes
- Token limits
- Capability flags (tool calling, vision, streaming)
- Profile compatibility

### Acceptance Criteria
- List, pull, delete, and show model info work
- Router selects model based on profile and availability
- Token limit logic uses per-model caps
- Options are validated and applied to provider requests

---

## Stage 08: Testing and QA

**Goal**: Validate core behavior and compatibility across models.

**Prerequisites**: Stage 07 complete

**Estimated Effort**: 3-4 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S08-T01 | Unit tests | `packages/core/src/**/__tests__/*` |
| S08-T02 | Integration tests | `integration-tests/` |
| S08-T03 | UI tests | `packages/cli/src/ui/__tests__/*` |
| S08-T04 | Compatibility matrix | `docs/compatibility.md` |

### Test Coverage Areas
- Provider adapters, tool schema mapping, ReAct parser
- Token estimation and routing
- Streaming, tool calls, model management
- UI rendering and key workflows

### Representative Models for Testing
- General purpose model
- Code-optimized model
- Small/fast model

### Acceptance Criteria
- Unit tests pass in CI
- Integration tests pass when server available, skip gracefully otherwise
- UI tests cover streaming and tool confirmations
- Documented pass/fail results for each model

---

## Stage 09: Docs and Release

**Goal**: Provide complete documentation and packaging.

**Prerequisites**: Stage 08 complete

**Estimated Effort**: 2-3 days

### Tasks

| ID | Task | Deliverables |
|----|------|--------------|
| S09-T01 | Documentation | `README.md`, `docs/configuration.md`, `docs/troubleshooting.md` |
| S09-T02 | Packaging | Build outputs, package metadata |
| S09-T03 | Release checklist | `docs/release-checklist.md` |

### Documentation Topics
- Quick start and examples
- Configuration reference
- Troubleshooting guide
- Model compatibility

### Acceptance Criteria
- New users can install and run with minimal steps
- `npm install -g` provides the `ollm` command
- Release steps are documented and repeatable

---

## Parallel Work Opportunities

The following stages/tasks can be worked on in parallel:

1. **Stage 03 + Stage 04**: Tools and Services can be developed simultaneously after Stage 02
2. **Stage 04b**: Can start after Stage 04 core is done, parallel with Stage 05 prep
3. **S03-T02 + S03-T03 + S03-T04**: File, Shell, and Web tools are independent
4. **S04-T01 through S04-T06**: All service tasks are relatively independent
5. **S04b-T01 through S04b-T06**: Context management tasks are relatively independent
6. **S08-T01 + S08-T03**: Unit tests and UI tests can be written in parallel

## Risk Areas

1. **Provider Compatibility**: Different LLM servers may have varying API behaviors
2. **Tool Calling**: ReAct fallback complexity for models without native tool support
3. **Memory Management**: Context compression and VRAM monitoring across GPU vendors
4. **VRAM Detection**: GPU memory APIs vary significantly across NVIDIA/AMD/Apple Silicon
5. **Cross-Platform**: Shell execution and PTY support varies by OS
6. **Context Window Limits**: Different models have vastly different context limits
7. **Streaming Consistency**: Provider streaming formats may differ

## Definition of Done (All Stages)

- All tasks completed with deliverables
- Tests written for public surfaces
- APIs documented with examples
- CLI flags documented and smoke tested
- Security and policy checks enforced

## Related Documentation

- [Architecture Overview](../docs/architecture.md) - Detailed system architecture
- [Context Management Plan](../docs/context-management-plan.md) - VRAM and context handling
- [Ollama Models Reference](../docs/ollama_models.md) - Model compatibility information
