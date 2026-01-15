# OLLM CLI Architecture

## Overview

OLLM CLI is a local-first command-line interface for open-source LLMs. It provides a provider-agnostic runtime with tools, hooks, extensions, and MCP (Model Context Protocol) integration.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript (ES Modules, strict mode) |
| Runtime | Node.js (≥20.0.0) |
| Package Manager | npm with workspaces |
| Build System | esbuild |
| UI Framework | React + Ink (terminal UI) |
| Testing | Vitest |
| Linting | ESLint + Prettier |

## Monorepo Structure

```
ollm-cli/
├── packages/
│   ├── cli/              # CLI entry, UI components, command parsing
│   ├── core/             # Core runtime, tools, hooks, services
│   ├── ollm-bridge/      # Provider adapters and model management
│   └── test-utils/       # Shared test fixtures and helpers
├── docs/                 # Documentation
├── integration-tests/    # E2E tests
├── scripts/              # Build & automation scripts
└── schemas/              # JSON schemas
```

## Package Responsibilities

### CLI Package (`packages/cli`)

**Purpose**: User-facing terminal interface

**Key Responsibilities**:
- Command-line argument parsing
- Terminal UI rendering (React + Ink)
- User input handling
- Display formatting and theming
- Session management UI
- Slash command implementations

**Main Entry Point**: `cli.tsx`

**Key Components**:
- `AppContainer.tsx` - Main application container
- `nonInteractive.ts` - Headless mode execution
- `ui/` - React components for terminal UI
- `config/` - CLI-specific configuration
- `commands/` - Slash command implementations

### Core Package (`packages/core`)

**Purpose**: Backend business logic and AI interaction

**Key Responsibilities**:
- Provider-agnostic chat runtime
- System prompt management
- Tool registration and execution
- MCP (Model Context Protocol) integration
- Hook system for customization
- Session recording and compression
- Context management
- Policy engine for tool confirmation

**Key Modules**:
```
packages/core/src/
├── agents/          # Agent delegation and sub-agents
├── config/          # Configuration management
├── context/         # Context management, VRAM monitoring
├── core/            # Chat runtime, turn handling
├── extensions/      # Extension loader
├── hooks/           # Hook system
├── mcp/             # MCP client integration
├── policy/          # Approval policies
├── provider/        # Provider registry and interfaces
├── routing/         # Model routing
├── services/        # Session, compression, context services
├── tools/           # Tool registry and built-in tools
└── utils/           # Utility functions
```

### OLLM Bridge Package (`packages/ollm-bridge`)

**Purpose**: Provider adapters and model management

**Key Responsibilities**:
- Local provider adapter (Ollama)
- Message format translation
- Tool schema mapping
- Stream event handling
- Model management operations

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Terminal                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLI Package (packages/cli)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Input     │  │   React     │  │   Config    │              │
│  │  Handler    │→ │   + Ink     │  │   Loader    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Core Package (packages/core)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Chat      │→ │  ToolReg.   │→ │   MCP       │              │
│  │   (Turn)    │  │  (Execute)  │  │   Client    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Provider Adapter (via Registry)                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   OLLM Bridge (packages/ollm-bridge)            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Local Provider Adapter (Ollama)                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Local LLM Server (Ollama)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Interfaces

### Provider System

```typescript
// Message types
type Role = 'system' | 'user' | 'assistant' | 'tool';

interface Message {
  role: Role;
  parts: MessagePart[];
  name?: string;
}

// Provider adapter interface
interface ProviderAdapter {
  name: string;
  chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;
  countTokens?(request: ProviderRequest): Promise<number>;
  listModels?(): Promise<ModelInfo[]>;
  pullModel?(name: string, onProgress?: (p: PullProgress) => void): Promise<void>;
  deleteModel?(name: string): Promise<void>;
  showModel?(name: string): Promise<ModelInfo>;
}

// Stream events
type ProviderEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call'; value: ToolCall }
  | { type: 'finish'; reason: 'stop' | 'length' | 'tool' }
  | { type: 'error'; error: { message: string; code?: string } };
```

### Tool System

```typescript
interface DeclarativeTool<TParams, TResult> {
  name: string;
  displayName: string;
  schema: { name: string; description?: string; parameters?: Record<string, unknown> };
  createInvocation(params: TParams, messageBus: MessageBus): ToolInvocation<TParams, TResult>;
}

interface ToolInvocation<TParams, TResult> {
  params: TParams;
  getDescription(): string;
  shouldConfirmExecute(signal: AbortSignal): Promise<ToolCallConfirmationDetails | false>;
  execute(signal: AbortSignal, updateOutput?: (output: string) => void): Promise<TResult>;
}
```

---

## Key Design Patterns

### 1. Event-Driven Architecture
The system uses an event emitter pattern for loose coupling between components:
- Stream events for real-time output
- Hook events for customization points
- Tool confirmation events for policy decisions

### 2. Message Bus Pattern
A `MessageBus` class handles tool confirmation requests and policy decisions, enabling decoupled communication between the policy engine and tool execution.

### 3. Registry Pattern
Tools, providers, and resources use registry patterns:
- `ToolRegistry` - Manages available tools
- `ProviderRegistry` - Manages provider adapters
- `AgentRegistry` - Manages sub-agents

### 4. Hook System
Extensible hooks for customization:
- `session_start` / `session_end`
- `before_agent` / `after_agent`
- `before_model` / `after_model`
- `before_tool` / `after_tool`

### 5. Adapter Pattern
Provider adapters translate between internal message format and provider-specific APIs, enabling support for multiple LLM backends.

---

## Configuration Hierarchy

Configuration is loaded in order of increasing priority:

1. **System Defaults** (hardcoded)
2. **User Settings** (`~/.ollm/config.yaml`)
3. **Workspace Settings** (`.ollm/config.yaml`)
4. **Environment Variables**
5. **Command-line Arguments** (highest priority)

---

## Built-in Tools

| Tool | Description |
|------|-------------|
| `read_file` | Read file content with optional line range |
| `read_many_files` | Read multiple files at once |
| `write_file` | Write content to file |
| `edit_file` | Apply targeted edits to file |
| `glob` | Find files by pattern |
| `grep` | Search file contents |
| `ls` | List directory contents |
| `shell` | Execute shell command |
| `web_fetch` | Fetch web page content |
| `web_search` | Search the web |
| `memory` | Persistent key-value storage |

---

## Context Management

### VRAM-Based Sizing
- Dynamic context sizing based on available GPU memory
- Support for NVIDIA, AMD, and Apple Silicon
- Fallback to CPU mode with RAM monitoring

### Context Snapshots
- Save conversation state before context overflow
- Restore previous context states
- Rolling cleanup of old snapshots

### Compression Strategies
- **Summarize**: Use model to create summary of older messages
- **Truncate**: Remove oldest messages
- **Hybrid**: Summarize old, keep recent intact

---

## Hook System

### Hook Events
| Event | Trigger |
|-------|---------|
| `session_start` | New session begins |
| `session_end` | Session ends |
| `before_agent` | Before agent processes |
| `after_agent` | After agent completes |
| `before_model` | Before model call |
| `after_model` | After model response |
| `before_tool` | Before tool executes |
| `after_tool` | After tool completes |

### Hook Protocol
Hooks communicate via JSON over stdin/stdout:
```json
// Input
{ "event": "before_model", "data": { "prompt": "...", "model": "..." } }

// Output
{ "continue": true, "systemMessage": "optional message" }
```

---

## Extension System

Extensions are directories containing:
```
my-extension/
├── manifest.json     # Extension metadata
├── ollm.md           # Context for AI
├── settings.json     # Extension settings
└── tools/            # Custom tools (optional)
```

### Extension Locations
- User extensions: `~/.ollm/extensions/`
- Workspace extensions: `.ollm/extensions/`

---

## MCP Integration

MCP (Model Context Protocol) enables external tool integration:

### Supported Transports
- **STDIO**: Local process communication
- **SSE**: Server-Sent Events
- **HTTP**: HTTP-based transport

### Configuration
```yaml
mcpServers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
```

---

## Security Architecture

### Policy Engine
Controls tool execution permissions with three modes:
- **ASK**: Always ask for confirmation
- **AUTO**: Auto-approve safe operations
- **YOLO**: Auto-approve everything

### Environment Sanitization
- Deny patterns for sensitive variables (`*_KEY`, `*_SECRET`, `*_TOKEN`)
- Allow list for core variables (`PATH`, `HOME`, `USER`)
- Pattern-based redaction in output

---

## Data Locations

| Location | Purpose |
|----------|---------|
| `~/.ollm/` | User-level config and data |
| `~/.ollm/config.yaml` | User settings |
| `~/.ollm/session-data/` | Session history |
| `~/.ollm/extensions/` | User extensions |
| `.ollm/` | Workspace-level config |
| `.ollm/config.yaml` | Project settings |
| `.ollm/ollm.md` | Project context |
| `.ollm/extensions/` | Project extensions |

---

## Agent System

### Agent Delegation
The main agent can spawn specialized sub-agents for complex tasks:
- **Codebase Investigator**: Deep codebase analysis and exploration

### Agent Communication
Sub-agents run as separate conversations with their own context but share access to the same tools.

---

## Model Routing

### Routing Profiles
| Profile | Description |
|---------|-------------|
| `fast` | Quick responses, smaller models |
| `general` | Balanced performance |
| `code` | Code-optimized models |
| `creative` | Creative writing models |

### Selection Logic
1. Match profile to available models
2. Consider model capabilities
3. Apply fallbacks when preferred model unavailable

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP integration |
| `ink` | Terminal React UI |
| `react` | UI framework |
| `fdir` | Fast directory traversal |
| `glob` | Glob pattern matching |
| `simple-git` | Git operations |
| `zod` | Schema validation |
| `diff` | Text diffing |
| `marked` | Markdown parsing |
