# OLLM CLI Roadmap

## Overview

This document outlines the development roadmap for OLLM CLI, including completed features and planned future development stages. OLLM CLI is a local-first command-line interface for open-source LLMs with tools, hooks, and MCP integration.

## Current Status

**Latest Release:** v0.1.0  
**Current Stage:** Stage 9 - Documentation and Release  
**Development Status:** Core features complete, future stages planned

## Completed Stages

### ✅ Stage 1-8: Core Features (Completed)

The foundation of OLLM CLI has been successfully implemented, providing a robust local-first LLM interface with comprehensive tooling and extensibility.

**Key Accomplishments:**

- **Interactive TUI and Non-Interactive Modes**: Full-featured terminal UI built with React + Ink, plus headless execution for scripting
- **Provider-Agnostic Architecture**: Flexible adapter system supporting multiple LLM backends
- **Comprehensive Tool System**: Built-in tools for file operations, shell execution, web fetch/search, and memory management
- **Policy Engine**: Configurable approval modes (ASK, AUTO, YOLO) with diff preview for file changes
- **Context Management**: Dynamic context sizing with VRAM monitoring, automatic compression, and memory safety guards
- **Session Recording**: Full session capture with resume capability and compression for long conversations
- **Hook System**: Event-driven automation with safety gates and customizable workflows
- **MCP Integration**: Model Context Protocol support for external tool integration
- **Extension System**: Manifest-based extensions for custom functionality
- **Testing Infrastructure**: Comprehensive test suite with property-based testing using Vitest and fast-check

[View detailed specifications: `.kiro/specs/stage-01-foundation/` through `.kiro/specs/stage-08-testing-qa/`]

---

## Planned Future Development

All stages below are **planned for future development** and not yet scheduled for implementation. Timeline will be determined based on community feedback, resource availability, and feature priorities.

### 🔮 Stage 10: Kraken Integration (Planned)

**Status:** Planned for future development  
**Description:** External LLM provider integration for accessing powerful cloud models when local models need assistance

**Key Features:**
- **CLI Bridge Execution**: Invoke terminal-based coding agents (Gemini CLI, Claude Code, Codex CLI) as subprocesses
- **API Provider Integration**: Connect to cloud LLM APIs (OpenAI, Anthropic, Google AI) with streaming support
- **Provider Discovery**: Automatic health checks and capability detection for configured providers
- **Intelligent Selection**: Smart provider selection based on task complexity, domain, and context requirements
- **Context Transfer**: Seamless conversation context sharing between local and external models
- **Cost Tracking**: Token usage monitoring with session budgets and cost warnings
- **Auto-Escalation**: Automatic fallback to external providers when local models fail or context overflows
- **Policy Controls**: Confirmation dialogs with cost estimates before invoking external providers

**Use Cases:**
- Escalate complex reasoning tasks to GPT-4 or Claude when local models struggle
- Access specialized coding agents for specific programming tasks
- Leverage larger context windows for comprehensive code analysis
- Maintain cost control while accessing premium model capabilities

[View detailed specification: `.kiro/specs/stage-10-kraken-integration-future-dev/`]

---

### 🔮 Stage 11: Developer Productivity Tools (Planned)

**Status:** Planned for future development  
**Description:** Git integration, @-mentions, and diff review for Aider-like developer workflows

**Key Features:**
- **Git Operations Tool**: Status, commit, diff, log, undo, stash, and branch management accessible to the LLM
- **@-Mention Syntax**: Explicit context loading with `@file.ts`, `@src/**/*.ts`, `@ClassName.method`, `@https://url`
- **Diff Review Mode**: Visual diff panel with approve/reject workflow before applying file changes
- **Auto-Commit**: Automatic commits with AI-generated semantic commit messages after approved changes
- **Git Context**: Current repository status included in system prompt for LLM awareness
- **Symbol References**: Reference specific classes, functions, and methods by name
- **URL Loading**: Fetch and include web content directly via @-mentions
- **Review UI**: Interactive diff viewer with syntax highlighting and hunk-by-hunk approval

**Use Cases:**
- Review all AI-proposed changes before they're applied to your codebase
- Automatically commit approved changes with descriptive messages
- Load specific files or code symbols into context without manual copying
- Maintain clean Git history with semantic commits for AI-assisted changes

[View detailed specification: `.kiro/specs/stage-11-developer-productivity-future-dev/`]

---

### 🔮 Stage 12: Cross-Platform Support (Planned)

**Status:** Planned for future development  
**Description:** Comprehensive cross-platform compatibility for Windows, macOS, and Linux

**Key Features:**
- **Platform Detection**: Automatic OS identification with platform-specific behavior adaptation
- **Configuration Paths**: Standard locations following platform conventions (XDG, AppData, Library)
- **Terminal Capabilities**: Automatic detection of color support, Unicode, and terminal features
- **GPU Monitoring**: Cross-platform VRAM monitoring (nvidia-smi, rocm-smi, Apple Silicon APIs)
- **Shell Execution**: Platform-appropriate shell selection (cmd.exe, /bin/sh) and command handling
- **Path Normalization**: Consistent path handling across different separator conventions
- **Graceful Degradation**: Fallback behavior when platform-specific features are unavailable
- **Environment Variables**: Platform-specific variable support and override mechanisms

**Use Cases:**
- Use the same configuration and commands on Windows, macOS, and Linux
- Automatic adaptation to terminal capabilities without manual configuration
- Consistent GPU memory monitoring across NVIDIA, AMD, and Apple Silicon
- Reliable file operations regardless of path separator conventions

[View detailed specification: `.kiro/specs/stage-12-cross-platform-future-dev/`]

---

### 🔮 Stage 13: Multi-Provider Support (Planned)

**Status:** Planned for future development  
**Description:** vLLM and OpenAI-compatible provider adapters for expanded backend options

**Key Features:**
- **vLLM Provider**: High-performance production deployment with guided decoding support
- **OpenAI-Compatible Provider**: Universal adapter for LM Studio, LocalAI, Kobold, llama.cpp
- **SSE Stream Parsing**: Server-Sent Events parser for OpenAI-compatible streaming
- **Provider Registry**: Centralized provider management with aliases and capability detection
- **Guided Decoding**: vLLM-specific features for JSON schema and regex-constrained generation
- **Provider-Specific Options**: Passthrough for advanced backend-specific parameters
- **Feature Detection**: Automatic capability reporting for conditional feature enablement
- **Backward Compatibility**: Existing Ollama setup continues working without changes

**Use Cases:**
- Deploy with vLLM for maximum throughput in production environments
- Connect to LM Studio for local development with a familiar UI
- Use llama.cpp server for lightweight deployments
- Leverage vLLM's guided decoding for reliable structured outputs

[View detailed specification: `.kiro/specs/stage-13-vllm-openai-future-dev/`]

---

### 🔮 Stage 14: File Upload System (Planned)

**Status:** Planned for future development  
**Description:** File sharing with LLM through terminal interface with multiple upload methods

**Key Features:**
- **Multiple Upload Methods**: Slash commands (`/upload`), clipboard paste, drag-and-drop, @-mentions
- **Session-Scoped Storage**: Isolated file storage per conversation with automatic cleanup
- **File Deduplication**: SHA-256 checksums to avoid storing duplicate files
- **Image Processing**: Automatic resizing and base64 encoding for vision models
- **Text File Extraction**: Code and document content extraction with syntax highlighting
- **Storage Limits**: Configurable per-file and per-session size limits
- **Automatic Cleanup**: Retention policies with automatic deletion of old uploads
- **Upload Management**: List, inspect, and delete uploaded files via commands

**Use Cases:**
- Share screenshots for UI debugging with vision models
- Upload code files for analysis without copying and pasting
- Drag and drop images directly into the terminal chat
- Automatically clean up old uploads to manage disk space

[View detailed specification: `.kiro/specs/stage-14-file-upload-future-dev/`]

---

### 🔮 Stage 15: Intelligence Layer (Planned)

**Status:** Planned for future development  
**Description:** Advanced AI capabilities including semantic search, structured output, and code execution

**Key Features:**
- **Semantic Codebase Search**: RAG-based search with local embeddings and vector storage
- **Structured JSON Output**: Schema enforcement with validation and retry logic
- **Sandboxed Code Execution**: Safe execution of JavaScript, Python, and Bash with resource limits
- **Vision and Image Analysis**: Image processing and analysis with vision-capable models
- **Developer Productivity Tools**: Undo, export, copy, and prompt template management
- **Usage and Cost Tracking**: Token usage monitoring with budget warnings and historical tracking
- **Automatic Indexing**: Background codebase indexing with incremental updates
- **Security Controls**: Sandbox restrictions, secret detection, and safe execution policies

**Use Cases:**
- Search large codebases semantically without knowing exact file names
- Generate reliable JSON outputs that conform to your schemas
- Test code snippets safely before committing to your project
- Analyze screenshots and images with vision models
- Track LLM usage and costs across sessions and projects

[View detailed specification: `.kiro/specs/stage-15-intelligence-layer-future-dev/`]

---

## Timeline

**Note:** All future development stages are planned but not yet scheduled. The timeline will be determined based on:

- **Community Feedback**: Feature requests and user priorities from the community
- **Resource Availability**: Development capacity and contributor involvement
- **Feature Dependencies**: Technical dependencies between stages that affect implementation order
- **User Workflows**: Priority of features for real-world developer workflows
- **Ecosystem Maturity**: Stability and adoption of underlying technologies (MCP, vLLM, etc.)

We welcome community input on which features would provide the most value to your workflows.

---

## Contributing

We welcome contributions to any planned feature! Here's how to get involved:

### For Planned Features

1. **Review the Specification**: Read the detailed requirements document in `.kiro/specs/stage-XX-feature-name-future-dev/`
2. **Discuss Your Approach**: Open an issue with the "feature" label to discuss your implementation plan
3. **Start Small**: Consider implementing a subset of the feature or a proof-of-concept first
4. **Submit a Pull Request**: Follow the contribution guidelines and reference the relevant specification

### For New Ideas

1. **Check Existing Specs**: Review planned stages to see if your idea is already covered
2. **Open a Discussion**: Use GitHub Discussions to propose new features or enhancements
3. **Provide Context**: Explain your use case and how the feature would improve your workflow
4. **Collaborate**: Work with maintainers to refine the idea and potentially create a new specification

### Development Guidelines

- Follow the existing code structure and patterns
- Write tests for new functionality (unit tests and property-based tests)
- Update documentation to reflect your changes
- Ensure cross-platform compatibility (Windows, macOS, Linux)
- Maintain the local-first, privacy-focused design principles

---

## Feedback

Have suggestions for the roadmap? We'd love to hear from you!

- **Feature Requests**: Open an issue with the "feature-request" label
- **Priority Feedback**: Comment on existing issues to indicate features you need
- **Use Case Sharing**: Describe your workflows in GitHub Discussions
- **Roadmap Discussion**: Open an issue with the "roadmap" label for broader roadmap feedback

Your input helps us prioritize development and ensure OLLM CLI meets real-world needs.

---

## Version History

| Version | Date       | Changes                                      |
|:--------|:-----------|:---------------------------------------------|
| 0.1.0   | 2026-01-15 | Initial release with core features complete  |

---

## Additional Resources

- [README](../README.md) - Project overview and quick start guide
- [Configuration Reference](./configuration.md) - Complete settings documentation
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- [Architecture Documentation](./architecture.md) - System design and structure
- [Release Checklist](./release-checklist.md) - Release procedures for maintainers

---

**Last Updated:** January 15, 2026
