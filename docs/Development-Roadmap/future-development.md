# OLLM CLI - Future Development Roadmap

**Status:** 📋 Planning  
**Last Updated:** 2026-01-16

---

## Overview

This document outlines planned future development for OLLM CLI beyond the current v0.1.0 release. All stages listed here are **planned but not yet scheduled** for implementation.

**Current Status:**
- **Latest Release:** v0.1.0
- **Completed:** Stages 1-9 (Core features, documentation)
- **Planned:** Stages 10-15 (Future development)

---

## Completed Work

### ✅ Stages 1-9: Core Features (Complete)

All core features have been implemented and documented:

- Interactive TUI (React + Ink) and non-interactive modes
- Provider-agnostic architecture (Ollama support)
- Comprehensive tool system with policy engine
- Context management with VRAM monitoring
- Session recording and compression
- Hook system for event-driven automation
- MCP integration for external tools
- Extension system with manifest support
- Complete testing infrastructure
- Comprehensive documentation

**Specifications:** `.kiro/specs/stage-01-foundation/` through `.kiro/specs/stage-09-docs-release/`

---

## Planned Future Development

**Important:** All stages below are planned for future development. Timeline and implementation order will be determined based on:
- Community feedback and feature requests
- Resource availability and contributor involvement
- Technical dependencies between features
- Real-world usage patterns and priorities

---

### 🔮 Stage 10: Kraken Integration

**Status:** 📋 Planned  
**Priority:** High  
**Complexity:** High  
**Estimated Effort:** 5-7 days

**Description:** External LLM provider integration for accessing cloud models when local models need assistance.

**Key Features:**
- CLI bridge execution (invoke terminal-based coding agents as subprocesses)
- API provider integration (OpenAI, Anthropic, Google AI)
- Provider discovery and health checks
- Intelligent provider selection based on task complexity
- Context transfer between local and external models
- Cost tracking with session budgets
- Auto-escalation on local model failure
- Policy controls with cost estimates

**Use Cases:**
- Escalate complex reasoning to GPT-4/Claude
- Access specialized coding agents
- Leverage larger context windows
- Maintain cost control

**Specification:** `.kiro/specs/stage-10-kraken-integration-future-dev/`

---

### 🔮 Stage 11: Developer Productivity Tools

**Status:** 📋 Planned  
**Priority:** High  
**Complexity:** Medium  
**Estimated Effort:** 5-7 days

**Description:** Git integration, @-mentions, and diff review for Aider-like developer workflows.

**Key Features:**
- Git operations tool (status, commit, diff, log, undo, stash, branch)
- @-mention syntax (`@file.ts`, `@ClassName.method`, `@https://url`)
- Diff review mode with approve/reject workflow
- Auto-commit with AI-generated semantic messages
- Git context in system prompt
- Symbol references by name
- URL loading via @-mentions
- Interactive diff viewer

**Use Cases:**
- Review AI changes before applying
- Auto-commit approved changes
- Load specific files/symbols into context
- Maintain clean Git history

**Specification:** `.kiro/specs/stage-11-developer-productivity-future-dev/`

---

### 🔮 Stage 12: Cross-Platform Support

**Status:** 📋 Planned  
**Priority:** Medium  
**Complexity:** Low  
**Estimated Effort:** 3-4 days

**Description:** Enhanced cross-platform compatibility for Windows, macOS, and Linux.

**Key Features:**
- Platform detection with automatic adaptation
- Standard configuration paths (XDG, AppData, Library)
- Terminal capability detection
- Cross-platform GPU monitoring (nvidia-smi, rocm-smi, Metal)
- Platform-appropriate shell selection
- Path normalization
- Graceful degradation
- Environment variable support

**Use Cases:**
- Same config across platforms
- Automatic terminal adaptation
- Consistent GPU monitoring
- Reliable file operations

**Specification:** `.kiro/specs/stage-12-cross-platform-future-dev/`

---

### 🔮 Stage 13: Multi-Provider Support

**Status:** 📋 Planned  
**Priority:** Medium  
**Complexity:** Medium  
**Estimated Effort:** 4-5 days

**Description:** vLLM and OpenAI-compatible provider adapters for expanded backend options.

**Key Features:**
- vLLM provider (high-performance production deployment)
- OpenAI-compatible provider (LM Studio, LocalAI, Kobold, llama.cpp)
- SSE stream parsing
- Provider registry with aliases
- Guided decoding (vLLM-specific)
- Provider-specific options passthrough
- Feature detection
- Backward compatibility with Ollama

**Use Cases:**
- Deploy with vLLM for production
- Connect to LM Studio for development
- Use llama.cpp for lightweight deployments
- Leverage guided decoding for structured outputs

**Specification:** `.kiro/specs/stage-13-vllm-openai-future-dev/`

---

### 🔮 Stage 14: File Upload System

**Status:** 📋 Planned  
**Priority:** Medium  
**Complexity:** Medium  
**Estimated Effort:** 3-4 days

**Description:** File sharing with LLM through terminal interface.

**Key Features:**
- Multiple upload methods (slash commands, clipboard, drag-drop, @-mentions)
- Session-scoped storage with automatic cleanup
- File deduplication (SHA-256 checksums)
- Image processing (resizing, base64 encoding)
- Text file extraction with syntax highlighting
- Storage limits (per-file and per-session)
- Automatic cleanup with retention policies
- Upload management commands

**Use Cases:**
- Share screenshots for UI debugging
- Upload code files for analysis
- Drag and drop images
- Automatic cleanup of old uploads

**Specification:** `.kiro/specs/stage-14-file-upload-future-dev/`

---

### 🔮 Stage 15: Intelligence Layer

**Status:** 📋 Planned  
**Priority:** High  
**Complexity:** High  
**Estimated Effort:** 10-14 days

**Description:** Advanced AI capabilities including semantic search, structured output, and code execution.

**Key Features:**
- Semantic codebase search (RAG with local embeddings)
- Structured JSON output (schema enforcement)
- Sandboxed code execution (JavaScript, Python, Bash)
- Vision and image analysis
- Developer productivity tools (undo, export, copy, templates)
- Usage and cost tracking
- Automatic indexing with incremental updates
- Security controls and sandbox restrictions

**Use Cases:**
- Search large codebases semantically
- Generate reliable JSON outputs
- Test code snippets safely
- Analyze screenshots and images
- Track LLM usage and costs

**Specification:** `.kiro/specs/stage-15-intelligence-layer-future-dev/`

---

## Feature Categories

### By Priority

**High Priority:**
- Stage 10: Kraken Integration
- Stage 11: Developer Productivity Tools
- Stage 15: Intelligence Layer

**Medium Priority:**
- Stage 12: Cross-Platform Support
- Stage 13: Multi-Provider Support
- Stage 14: File Upload System

### By Complexity

**High Complexity:**
- Stage 10: Kraken Integration
- Stage 15: Intelligence Layer

**Medium Complexity:**
- Stage 11: Developer Productivity Tools
- Stage 13: Multi-Provider Support
- Stage 14: File Upload System

**Low Complexity:**
- Stage 12: Cross-Platform Support

### By Category

**🔌 Provider Integration:**
- Stage 10: Kraken Integration
- Stage 13: Multi-Provider Support

**🛠️ Developer Tools:**
- Stage 11: Developer Productivity Tools
- Stage 15: Intelligence Layer (partial)

**🖥️ Platform & Compatibility:**
- Stage 12: Cross-Platform Support

**📁 File & Media:**
- Stage 14: File Upload System
- Stage 15: Intelligence Layer (vision)

**🧠 Intelligence & AI:**
- Stage 15: Intelligence Layer

---

## Dependencies

```
Stages 1-9 (Complete)
    │
    ├─────────────┬─────────────┬─────────────┐
    │             │             │             │
    ▼             ▼             ▼             ▼
Stage 10      Stage 11      Stage 12      Stage 13
Kraken        Dev Tools     X-Platform    Multi-Provider
    │             │             │             │
    └─────────────┴─────────────┴─────────────┘
                  │
                  ▼
              Stage 14
              File Upload
                  │
                  ▼
              Stage 15
              Intelligence Layer
```

---

## Timeline

**Note:** Timeline is not yet determined. Implementation will be scheduled based on:

- **Community Feedback:** Feature requests and user priorities
- **Resource Availability:** Development capacity and contributors
- **Feature Dependencies:** Technical requirements between stages
- **User Workflows:** Priority for real-world developer needs
- **Ecosystem Maturity:** Stability of underlying technologies

We welcome community input on feature priorities.

---

## Contributing

### For Planned Features

1. **Review Specification:** Read `.kiro/specs/stage-XX-feature-name-future-dev/`
2. **Discuss Approach:** Open issue with "feature" label
3. **Start Small:** Consider implementing a subset or proof-of-concept
4. **Submit PR:** Follow contribution guidelines

### For New Ideas

1. **Check Existing Specs:** Review planned stages
2. **Open Discussion:** Use GitHub Discussions
3. **Provide Context:** Explain use case and workflow benefits
4. **Collaborate:** Work with maintainers to refine

### Development Guidelines

- Follow existing code structure and patterns
- Write tests (unit tests and property-based tests)
- Update documentation
- Ensure cross-platform compatibility
- Maintain local-first, privacy-focused design

---

## Feedback

Have suggestions for the roadmap?

- **Feature Requests:** Open issue with "feature-request" label
- **Priority Feedback:** Comment on existing issues
- **Use Case Sharing:** Describe workflows in GitHub Discussions
- **Roadmap Discussion:** Open issue with "roadmap" label

---

## Related Documentation

- [Roadmap Overview](./roadmap.md) - Main entry point
- [Future Features](./future-features.md) - Quick reference
- [Visual Roadmap](./road_map_visual.md) - Visual timeline
- [Development Plan](../../.dev/Development-Roadmap/ROADMAP.md) - Development tracking
- [Stage Specifications](../../.kiro/specs/) - Detailed requirements
- [Main README](../../README.md) - Project overview
- [Configuration](../configuration.md) - Settings reference
- [Troubleshooting](../troubleshooting.md) - Common issues

---

**Document Version:** 1.0  
**Created:** 2026-01-16  
**Status:** Living document
