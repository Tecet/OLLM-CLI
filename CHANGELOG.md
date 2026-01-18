# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog (https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning (https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New features in development

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes

## [0.1.0] - 2026-01-15

### Added

#### Interactive Terminal UI
- React + Ink powered terminal interface with streaming responses
- Syntax highlighting for code blocks with automatic language detection
- Status bar displaying model name, context usage, and VRAM metrics
- Tool execution preview with diff visualization for file changes
- Side panel with context information and GPU statistics
- Hybrid and simple layout modes for different use cases

#### Context Management
- Adaptive context sizing based on available VRAM
- Automatic compression when approaching context limits using sliding-window strategy
- Snapshot and rollover support for long conversations
- Real-time monitoring of token usage and memory consumption
- Dynamic context window adjustment (2K-32K tokens)
- VRAM buffer management with configurable thresholds
- Context pool for efficient memory management
- Memory safety guards to prevent out-of-memory errors

#### Tool System
- Built-in tools for file operations (read, write, edit, list, glob, grep)
- Shell command execution with timeout and output truncation
- Web fetch and search capabilities
- Memory tool for persistent context across sessions
- Policy-based confirmation system (ASK, AUTO, YOLO modes)
- Diff preview for file edits before applying changes
- Output streaming for long-running operations
- Tool timeout configuration

#### Session Management
- Record and resume conversations with full context preservation
- Automatic session compression to manage context limits
- Loop detection to prevent runaway tool calls
- Session history with searchable archives
- Auto-save functionality with configurable intervals
- Session state persistence across restarts

#### Extensibility
- Hook system for event-driven automation and safety gates
- Extension system with manifest-based configuration
- MCP (Model Context Protocol) integration for external tools
- Provider-agnostic architecture supporting multiple LLM backends
- Skills system for task-specific instruction modules

#### Configuration System
- Layered configuration with clear precedence order
- User-level config at `~/.ollm/config.yaml`
- Workspace-level config at `.ollm/config.yaml`
- Environment variable support for all major settings
- CLI flag overrides for temporary changes
- JSON schema validation for configuration files
- Support for multiple provider configurations (Ollama, vLLM, OpenAI-compatible)

#### Model Management
- List available models from provider
- Pull models from remote repositories
- Remove models to free up disk space
- Inspect model details and capabilities
- Model routing profiles (fast, general, code, creative)
- Dynamic context sizing based on model capabilities
- Per-model token limits and parameter configuration

#### Performance Monitoring
- Real-time GPU statistics (temperature, VRAM usage, utilization)
- Token usage tracking and cost estimation
- Performance metrics display (TTFT, tokens/sec)
- Compact and detailed metrics modes
- Status bar integration for key metrics
- Configurable polling intervals for status updates

#### Developer Features
- Diff review mode with approve/reject workflow
- Inline diff display for small changes
- External pager for large diffs
- Reasoning display for models that support it
- Collapsible reasoning sections
- Debug mode with detailed logging
- Comprehensive error messages with context

#### Testing Infrastructure
- Vitest-based testing framework
- Property-based testing with fast-check
- Unit tests for core functionality
- Integration tests for end-to-end workflows
- Test utilities and fixtures
- Code coverage reporting
- Mock providers for testing

#### Documentation
- Comprehensive README with quick start guide
- Configuration reference with all settings documented
- Troubleshooting guide with common issues and solutions
- Architecture documentation
- Development setup instructions
- Roadmap with planned future features
- Platform-specific testing guide

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- Environment variable sanitization to prevent secret leakage
- Secret redaction in logs and error messages
- Safe shell command execution with proper escaping
- File operation permissions validation
- Sandboxed tool execution environment

[Unreleased]: https://github.com/yourusername/ollm-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/ollm-cli/releases/tag/v0.1.0
