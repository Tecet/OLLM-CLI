# Kiro Specs Audit Report

**Stages Reviewed**: 1, 2, 3, 4, 4b (Completed)  
**Date**: 2026-01-12

---

## Executive Summary

All completed stages have comprehensive, well-structured design documents with clear interfaces, correctness properties, and testing strategies. The documentation is thorough but there are opportunities for improvement in consistency, deduplication, and cross-stage integration.

---

## Findings by Category

### 1. Duplication Issues

| Location | Issue | Recommendation |
|----------|-------|----------------|
| Stage-03 & Stage-04 | Both define `Message` interface with slight variations | Extract shared types to `packages/core/src/types/common.ts` |
| Stage-04 & Stage-04b | `CompressionService` appears in both with overlapping interfaces | Consolidate into Stage-04b; reference from Stage-04 |
| Stage-02 & Stage-03 | `ToolSchema` and `ToolCall` defined similarly | Unify in `packages/core/src/types/tool.ts` |

### 2. Missing Cross-References

| Stage | Missing Reference |
|-------|-------------------|
| Stage-02 design.md | No link to Stage-03 tools integration |
| Stage-04 design.md | References Stage-04b but link is broken |
| Stage-03 | No reference to policy configuration in Stage-04/config |

**Recommendation**: Add `## Cross-References` section to each design.md with file:// links.

### 3. Inconsistent Naming Conventions

| Pattern | Occurrences | Suggestion |
|---------|-------------|------------|
| `chatClient` vs `ChatClient` | Stage-02, Stage-04 | Use PascalCase for classes |
| `tool-registry` vs `toolRegistry` | Stage-03 filename vs interface | Use kebab-case for files, camelCase for code |
| `MessageBus` vs `ConfirmationBus` | Mixed in Stage-03 | Choose one: "MessageBus" throughout |

### 4. Property Tests Gap Analysis

| Stage | Properties | Missing Coverage |
|-------|------------|------------------|
| Stage-01 | 3 | No property for package interdependency |
| Stage-02 | Not numbered | ReAct parsing edge cases |
| Stage-03 | Not numbered | Policy condition operators (matches, startsWith) |
| Stage-04 | 28 | Good coverage |
| Stage-04b | 41 | Excellent coverage |

**Recommendation**: Add numbered property system to Stage-02 and Stage-03.

### 5. Error Handling Inconsistencies

| Stage | Issue |
|-------|-------|
| Stage-02 | Provider errors use `{ message, code }` |
| Stage-03 | Tool errors use `{ message, type }` |
| Stage-04 | Service errors are untyped |

**Recommendation**: Define shared `OLLMError` base type with consistent structure.

---

## Improvement Suggestions by Stage

### Stage-01: Foundation

| Priority | Suggestion |
|----------|------------|
| Medium | Add property for cross-package imports working correctly |
| Low | Document minimum Node.js version in requirements |
| Low | Add workspace dependency resolution verification |

### Stage-02: Core Provider

| Priority | Suggestion |
|----------|------------|
| High | Number correctness properties (currently unnumbered) |
| High | Add retry logic for transient provider errors |
| Medium | Document streaming backpressure handling |
| Medium | Add timeout configuration to `ProviderRequest` |
| Low | Add provider capability detection (tools support, vision, etc.) |

### Stage-03: Tools & Policy

| Priority | Suggestion |
|----------|------------|
| High | Number correctness properties |
| High | Add `web_fetch` tool for URL content retrieval |
| Medium | Add tool execution timeout configuration |
| Medium | Document sandbox/security boundaries for shell tool |
| Low | Add tool result caching mechanism |

### Stage-04: Services & Sessions

| Priority | Suggestion |
|----------|------------|
| High | Remove `ChatCompressionService` (now in Stage-04b) |
| Medium | Add session export to markdown format |
| Medium | Add session search by content |
| Low | Add session tagging/categorization |

### Stage-04b: Context Management

| Priority | Suggestion |
|----------|------------|
| Medium | Add Intel/Arc GPU support to VRAM Monitor |
| Medium | Add context usage prediction based on prompt |
| Low | Add compression strategy effectiveness metrics |
| Low | Add snapshot diff visualization |

---

## Architectural Suggestions

### 1. Shared Types Package

Create `packages/shared/src/types/` with:
- `message.ts` - Message, MessagePart, Role
- `tool.ts` - ToolSchema, ToolCall, ToolResult
- `error.ts` - OLLMError, ErrorCode
- `config.ts` - Common configuration interfaces

### 2. Event System

Standardize events across stages:
```typescript
interface OLLMEvent<T = unknown> {
  type: string;
  source: string;
  timestamp: Date;
  data: T;
}
```

### 3. Configuration Schema

Document complete `~/.ollm/config.yaml` schema with all options from all stages in one place.

---

## Documentation Improvements

| Area | Current State | Recommendation |
|------|---------------|----------------|
| API Reference | Embedded in design.md | Extract to `docs/api/` |
| Config Reference | Scattered | Create `docs/configuration.md` |
| Error Codes | Undefined | Create `docs/errors.md` |
| Migration Guide | Missing | Create for breaking changes |

---

## Testing Framework Alignment

All stages reference `fast-check` for property testing but configuration varies. Standardize:

```typescript
// vitest.config.ts (workspace root)
export default {
  test: {
    include: ['**/*.test.ts', '**/*.prop.ts'],
  },
};

// Property test file naming: *.prop.ts
// Minimum iterations: 100
// Tag format: "Feature: <stage>, Property <N>: <text>"
```

---

## Conclusion

The Kiro specs are well-documented with strong foundations. The main opportunities are:
1. **Deduplication** of shared types across stages
2. **Consistent numbering** of correctness properties
3. **Standardized error handling** across all components
4. **Centralized configuration** documentation

These improvements will reduce maintenance burden and improve developer experience.
