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
- Fixed TypeScript type errors in `promptRouting.test.ts` by adding explicit Vitest imports

### Security
- Security fixes

## [0.1.0] - 2026-01-26

### Added

#### Comprehensive Documentation
- **57 complete documentation files** covering every aspect of OLLM CLI
- **Getting Started Guides**: Introduction, Installation, Quick Start, Troubleshooting
- **User Interface Documentation**: UI Guide, Commands, Keybinds, Themes, Terminal, Configuration
- **Context Management Documentation**: Architecture, Compression, Management, Checkpoints
- **Model Management Documentation**: Model discovery, compatibility, memory system
- **Tools System Documentation**: Architecture, User Guide, Getting Started, Manifest Reference
- **Hooks System Documentation**: Architecture, User Guide, Protocol, Visual Guide, Keyboard Shortcuts
- **MCP Integration Documentation**: Architecture, Getting Started, Integration, Commands, Marketplace
- **Prompts System Documentation**: Architecture, System Prompts, Templates, Routing
- **Development Roadmap**: Complete roadmap with version-based releases (v0.2.0-v0.9.0)
- **Complete Index**: All documentation organized by topic, audience, and goal

#### Interactive Terminal UI
- React + Ink powered terminal interface with streaming responses
- Syntax highlighting for code blocks with automatic language detection
- Status bar displaying model name, context usage, and VRAM metrics
- Tool execution preview with diff visualization for file changes
- Side panel with context information and GPU statistics
- Hybrid and simple layout modes for different use cases

#### Context Management
- **Fixed context sizing** based on available VRAM (determined at startup)
- Five context tiers: Minimal (2K), Basic (4K), Standard (8K), Premium (16K), Ultra (32K+)
- Automatic compression when approaching context limits using sliding-window strategy
- Snapshot and rollover support for long conversations
- Real-time monitoring of token usage and memory consumption
- VRAM buffer management with configurable thresholds
- Context pool for efficient memory management
- Memory safety guards to prevent out-of-memory errors
- Pre-calculated 85% utilization values in LLM_profiles.json

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
- User-level config at `~/.ollm/settings.json`
- Workspace-level config at `.ollm/settings.json`
- Environment variable support for all major settings
- CLI flag overrides for temporary changes
- JSON schema validation for configuration files
- Support for Ollama provider configuration

#### Model Management
- List available models from provider
- Pull models from remote repositories
- Remove models to free up disk space
- Inspect model details and capabilities
- Model discovery and metadata enrichment
- Tool support detection (four-tier precedence system)
- Context window configuration (85% utilization)
- Reasoning model support with extended timeouts

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

### Changed
- Updated README.md with npm package installation (`@tecet/ollm`)
- Updated all documentation to reflect fixed context sizing (not dynamic)
- Updated context tier system from ranges to labels (Minimal, Basic, Standard, Premium, Ultra)
- Updated compression documentation to reflect LLM-based summarization
- Updated roadmap to use version-based releases (v0.2.0-v0.9.0) instead of stages
- Updated all GitHub links to use correct username (tecet)

### Documentation Structure
- **9 major sections** with complete coverage
- **Getting Started** (4 files): Introduction, Installation, Quickstart, Troubleshooting
- **UI & Settings** (9 files): Complete interface and configuration documentation
- **Context Management** (6 files): Architecture, compression, management, checkpoints
- **Model Management** (6 files): Discovery, compatibility, memory, configuration
- **Tools System** (6 files): Architecture, user guide, getting started, manifest
- **Hooks System** (7 files): Architecture, user guide, protocol, visual guide
- **MCP Integration** (6 files): Architecture, getting started, integration, commands
- **Prompts System** (6 files): Architecture, system prompts, templates, routing
- **Development Roadmap** (6 files): Roadmap, visual timeline, planned features

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

[Unreleased]: https://github.com/tecet/ollm/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tecet/ollm/releases/tag/v0.1.0
