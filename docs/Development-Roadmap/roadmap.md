# OLLM CLI Roadmap

## Overview

OLLM CLI is a local-first command-line interface for open-source LLMs with tools, hooks, and MCP integration.

**Latest Release:** v0.1.0  
**Current Status:** Core features complete

---

## Completed Features (v0.1.0)

### ✅ Core Features

The foundation of OLLM CLI has been successfully implemented:

- **Interactive TUI and Non-Interactive Modes** - Full-featured terminal UI (React + Ink) plus headless execution
- **Provider-Agnostic Architecture** - Flexible adapter system supporting multiple LLM backends
- **Comprehensive Tool System** - Built-in tools for file operations, shell, web fetch/search, memory
- **Policy Engine** - Configurable approval modes (ASK, AUTO, YOLO) with diff preview
- **Context Management** - Dynamic sizing with VRAM monitoring, compression, memory safety
- **Session Recording** - Full session capture with resume and compression
- **Hook System** - Event-driven automation with safety gates
- **MCP Integration** - Model Context Protocol support for external tools
- **Extension System** - Manifest-based extensions for custom functionality
- **Testing Infrastructure** - Comprehensive test suite with property-based testing

---

## Future Development

All future development stages are **planned but not yet scheduled**. Implementation timeline will be determined based on community feedback, resource availability, and feature priorities.

### Planned Stages

| Stage | Feature | Priority | Status |
|-------|---------|----------|--------|
| 10 | Kraken Integration (External LLM providers) | High | 📋 Planned |
| 11 | Developer Productivity Tools (Git, @-mentions, diff review) | High | 📋 Planned |
| 12 | Cross-Platform Support (Enhanced compatibility) | Medium | 📋 Planned |
| 13 | Multi-Provider Support (vLLM, OpenAI-compatible) | Medium | 📋 Planned |
| 14 | File Upload System (Terminal file sharing) | Medium | 📋 Planned |
| 15 | Intelligence Layer (Semantic search, structured output, code execution) | High | 📋 Planned |

**For detailed information about planned features, see:**
- [Future Development Roadmap](./Development-Roadmap/future-development.md) - Complete roadmap with detailed descriptions
- [Visual Roadmap](./Development-Roadmap/road_map_visual.md) - Visual timeline and dependency graphs
- [Future Features Quick Reference](./Development-Roadmap/future-features.md) - Quick reference guide
- [Stage Specifications](../.kiro/specs/) - Detailed requirements and design documents

---

## Contributing

We welcome contributions to any planned feature!

1. **Review the Specification** - Read the detailed requirements in `.kiro/specs/stage-XX-feature-name-future-dev/`
2. **Discuss Your Approach** - Open an issue with the "feature" label
3. **Start Small** - Consider implementing a subset or proof-of-concept first
4. **Submit a Pull Request** - Follow contribution guidelines

**For new ideas:**
- Check existing specifications to see if your idea is covered
- Open a GitHub Discussion to propose new features
- Provide context about your use case and workflow benefits

---

## Feedback

Have suggestions for the roadmap?

- **Feature Requests:** Open an issue with the "feature-request" label
- **Priority Feedback:** Comment on existing issues to indicate features you need
- **Use Case Sharing:** Describe your workflows in GitHub Discussions
- **Roadmap Discussion:** Open an issue with the "roadmap" label

Your input helps us prioritize development and ensure OLLM CLI meets real-world needs.

---

## Related Documentation

- [Roadmap Overview](./Development-Roadmap/roadmap.md) - Main entry point
- [Future Development](./Development-Roadmap/future-development.md) - Detailed future plans
- [Visual Roadmap](./Development-Roadmap/road_map_visual.md) - Visual timeline and diagrams
- [Future Features](./Development-Roadmap/future-features.md) - Quick reference
- [Development Plan](../.dev/Development-Roadmap/ROADMAP.md) - Development tracking
- [README](../README.md) - Project overview and quick start
- [Configuration Reference](./configuration.md) - Complete settings documentation
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- [Development Plan](../.dev/development-plan.md) - Completed stages 1-9

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0
