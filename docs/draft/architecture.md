# OLLM CLI Architecture

## High-Level Diagram
[User Terminal]
      |
      v
[CLI UI + Non-Interactive Runner]
      |
      v
[Core Runtime]
  |   |   |   |
  |   |   |   +--> Hooks + Extensions + MCP
  |   |   +------> Tools + Policy + Message Bus
  |   +----------> Agents + Sessions + Services
  +--------------> Provider Registry
                       |
                       v
                [Provider Adapter]
                       |
                       v
               [Local LLM Server]
               (chat + model mgmt)

## Package Layout
- packages/cli: input handling, UI rendering, command parsing.
- packages/core: tools, policy engine, hooks, extensions, MCP, agents, services.
- packages/ollm-bridge: provider adapter(s) and model management.
- packages/a2a-server: optional agent-to-agent server.
- packages/test-utils: shared fixtures and helpers.

## Core Modules
- ProviderRegistry: loads providers and selects active provider/model.
- ToolRegistry: registers tools and exposes schemas to the model.
- MessageBus + PolicyEngine: confirmation, approvals, and policy updates.
- HookSystem: event-driven hooks around agent, model, and tools.
- Session Services: recording, compression, summarization, history.
- Agent System: delegation and sub-agent support.

## Data Flow (Interactive)
1. CLI collects input and loads settings.
2. Core builds system prompt, context, and tool list.
3. HookSystem runs before-agent and before-model hooks.
4. Provider adapter sends request and streams response.
5. Tool calls are detected and executed via ToolRegistry + MessageBus.
6. HookSystem runs after-model and after-agent hooks.
7. Output is rendered, session recorded, and stats updated.

## Provider Abstraction
- Standard interface for:
  - chat streaming,
  - token counting,
  - model listing/pulling/deleting,
  - tool schema translation.
- Adapter components:
  - MessageAdapter (internal content -> provider format),
  - ToolAdapter (schema -> provider function calling),
  - StreamAdapter (provider stream -> core events).

## Deployment Model
- CLI runs locally and connects to a local model server by default.
- Provider adapter can support remote endpoints when configured.
- Extensions and MCP tools run alongside the CLI process.
