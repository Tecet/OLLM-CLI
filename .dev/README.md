# OLLM CLI Development Plan

This folder contains the development plan for OLLM CLI, organized into stages that can be distributed among coding subagents.

## Quick Links

- [Development Plan Overview](./development-plan.md) - Full plan with dependencies and timeline
- [Stage Files](./stages/) - Detailed task breakdowns per stage
- [Architecture Documentation](../docs/architecture.md) - System architecture and design patterns

## Stages Overview

| Stage | Name | Effort | Dependencies |
|-------|------|--------|--------------|
| 01 | [Foundation](./stages/stage-01-foundation.md) | 1-2 days | None |
| 02 | [Core Runtime & Provider](./stages/stage-02-core-provider.md) | 3-4 days | Stage 01 |
| 03 | [Tool System & Policy](./stages/stage-03-tools-policy.md) | 4-5 days | Stage 02 |
| 04 | [Services & Sessions](./stages/stage-04-services-sessions.md) | 3-4 days | Stage 02 |
| 04b | [Context Management](./stages/stage-04b-context-management.md) | 3-4 days | Stage 04 |
| 05 | [Hooks, Extensions, MCP](./stages/stage-05-hooks-extensions-mcp.md) | 4-5 days | Stages 03, 04b |
| 06 | [CLI & UI](./stages/stage-06-cli-ui.md) | 4-5 days | Stage 05 |
| 07 | [Model Management](./stages/stage-07-model-management.md) | 2-3 days | Stage 06 |
| 08 | [Testing & QA](./stages/stage-08-testing-qa.md) | 3-4 days | Stage 07 |
| 09 | [Docs & Release](./stages/stage-09-docs-release.md) | 2-3 days | Stage 08 |

**Total Estimated Effort**: 29-39 days

## Parallel Work Opportunities

```
Stage 01 ──────────────────────────────────────────────────────────────►
          │
          ▼
Stage 02 ──────────────────────────────────────────────────────────────►
          │
          ├─────────────────┬─────────────────┐
          ▼                 ▼                 │
Stage 03 ─────────►   Stage 04 ─────────►    │  (Can run in parallel)
          │                 │                 │
          │                 ▼                 │
          │           Stage 04b ─────────►   │  (Context Management)
          │                 │                 │
          └────────┬────────┴─────────────────┘
                   ▼
Stage 05 ──────────────────────────────────────────────────────────────►
                   │
                   ▼
Stage 06 ──────────────────────────────────────────────────────────────►
                   │
                   ▼
Stage 07 ──────────────────────────────────────────────────────────────►
                   │
                   ▼
Stage 08 ──────────────────────────────────────────────────────────────►
                   │
                   ▼
Stage 09 ──────────────────────────────────────────────────────────────►
```

## Subagent Assignment Guide

See [subagent-guide.md](./subagent-guide.md) for recommended team distribution.

## Getting Started

1. Start with Stage 01 to set up the repo foundation
2. Complete Stage 02 for core runtime
3. Stages 03 and 04 can be worked on in parallel
4. Continue sequentially from Stage 05 onwards

## Definition of Done (All Stages)

- All tasks completed with deliverables
- Tests written for public surfaces
- APIs documented with examples
- CLI flags documented and smoke tested
- Security and policy checks enforced

## Key Architecture References

When implementing stages, refer to the [Architecture Documentation](../docs/architecture.md) for:

- **Core Interfaces**: Provider, Tool, and Message type definitions
- **Design Patterns**: Registry, Message Bus, Adapter patterns
- **Data Flow**: How components interact
- **Security Model**: Policy engine and environment sanitization
- **Configuration**: Hierarchy and file locations
