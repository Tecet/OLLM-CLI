# OLLM CLI - Product Overview

OLLM CLI is a local-first command-line interface for open-source LLMs. It provides a provider-agnostic runtime with tools, hooks, extensions, and MCP (Model Context Protocol) integration.

## Key Features

### Core Capabilities
- Interactive TUI (React + Ink) and non-interactive execution modes
- Streaming responses with real-time tool calls and confirmations
- Provider-agnostic architecture supporting multiple LLM backends
- Works offline when models are installed locally

### Tool System
- Built-in tools: file operations, shell, web fetch, search, memory
- Policy engine with ASK, AUTO, YOLO approval modes
- Tool confirmation with diff preview for file edits
- Output truncation and streaming for long-running tools

### Extensibility
- Hook system for event-driven automation and safety gates
- Extension system with manifest-based configuration
- MCP (Model Context Protocol) integration for external tools
- Skills system for task-specific instruction modules

### Session Management
- Session recording and resume capability
- Chat compression to manage context limits
- Context snapshots for conversation rollover
- Loop detection to prevent runaway tool calls

### Context Management
- Dynamic context sizing based on available VRAM
- Automatic VRAM monitoring for GPU memory optimization
- Context snapshots for long conversation rollover
- Automatic context compression with multiple strategies
- Memory safety guards to prevent OOM errors
- Real-time context usage display in status bar

### Model Management
- List, pull, remove, and inspect models
- Model routing profiles (fast, general, code, creative)
- Dynamic context sizing based on available VRAM
- Per-model token limits and capability detection
- Multi-provider support (Ollama, vLLM, OpenAI-compatible)

### Developer Productivity
- Git integration (status, commit, diff, undo)
- @-mentions for explicit context loading (@file, @symbol, @url)
- Diff review mode with approve/reject workflow
- Auto-commit with semantic commit messages
- Git status in system prompt and status bar

### Intelligence Layer
- Codebase indexing with semantic search (RAG)
- Structured output with JSON schema enforcement
- Code execution sandbox for safe testing
- Vision support for image analysis
- Productivity tools: undo, export, copy, templates
- Cost tracking for token usage and budget monitoring

## Design Principles

1. **Local-first**: No remote telemetry by default, all data stays local
2. **Provider-agnostic**: Supports multiple LLM backends via adapters (Ollama, vLLM, OpenAI-compatible)
3. **Safe tool execution**: Policy enforcement with user confirmation
4. **Fast startup**: Incremental rendering, lazy loading
5. **Clear error messages**: Retry and backoff strategies
6. **Security-conscious**: Environment sanitization, secret redaction
7. **Cross-platform**: Works consistently on Windows, macOS, and Linux

## User Data Locations

| Location | Purpose |
|----------|---------|
| `~/.ollm/` | User-level config and data |
| `~/.ollm/config.yaml` | User settings |
| `~/.ollm/session-data/` | Session history |
| `~/.ollm/extensions/` | User extensions |
| `~/.ollm/codebase-index/` | Vector store for semantic search |
| `~/.ollm/usage-data/` | Cost tracking database |
| `~/.ollm/templates/` | Prompt templates |
| `~/.ollm/snapshots/` | Context snapshots for rollover |
| `.ollm/` | Workspace-level config |
| `.ollm/config.yaml` | Project settings |
| `.ollm/ollm.md` | Project context |
| `.ollm/extensions/` | Project extensions |
| `.ollm/codebase-index/` | Workspace-specific index |

## CLI Modes

### Interactive Mode
Full TUI with chat history, tool confirmations, and status bar.

### Non-Interactive Mode
Single prompt execution with configurable output formats:
- `text`: Plain text output
- `json`: JSON object with response
- `stream-json`: NDJSON stream of events

## Documentation References

- [Architecture Overview](../docs/architecture.md)
- Development Plan (../.dev/development-plan.md)
- [Context Management](../docs/context-management-plan.md)
