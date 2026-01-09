# OLLM CLI - Product Overview

OLLM CLI is a local-first command-line interface for open-source LLMs. It provides a provider-agnostic runtime with tools, hooks, extensions, and MCP (Model Context Protocol) integration.

## Key Features
- Interactive TUI (React + Ink) and non-interactive execution modes
- Streaming responses with tool calls and confirmations
- Hook system for automation and safety gates
- Extension system and MCP tool integration
- Model management (list, pull, remove, info)
- Session recording and resume
- Works offline when models are installed

## Design Principles
- Local-first: no remote telemetry by default
- Provider-agnostic: supports multiple LLM backends via adapters
- Safe tool execution with policy enforcement
- Fast startup and incremental rendering
- Clear error messages with retry and backoff
