# Context Management Audit Findings

## Executive Summary

This audit examined the OLLM CLI's context management functionality across 8 key areas. The investigation revealed significant inconsistencies in token counting implementations, duplicate compression services with incompatible APIs, and potential integration gaps in dynamic sizing. While the architecture is well-designed, implementation issues could explain the inaccurate token counting problem (Issue 3).

## Key Findings

### 1. Token Counting Inconsistencies

**Issue**: Multiple services implement their own token counting using `Math.ceil(text.length / 4)` heuristic instead of using the centralized `TokenCounterService`.

**Affected Components**:
- `packages/core/src/context/compressionService.ts` - Implements `countMessageTokens()` method
- `packages/core/src/services/chatCompressionService.ts` - Implements standalone `countTokens()` function
- `packages/core/src/services/comparisonService.ts` - Uses heuristic for response token counting
- `packages/core/src/services/reasoningParser.ts` - Implements `estimateTokenCount()` method

**Root Cause**: The `TokenCounterService` provides accurate token counting with provider API integration and LRU caching, but compression services bypass this for performance reasons, implementing their own heuristics.

**Impact**: Inconsistent token counts across the system, potential compression failures, inaccurate context size calculations.

### 2. Duplicate Compression Services

**Issue**: Two separate compression services with different APIs and message formats.

**Services Identified**:
- `CompressionService` (`packages/core/src/context/compressionService.ts`) - Used by `ContextManager` in TUI
  - Message type: `Message` (with `role`, `content`, `timestamp`, `metadata`)
  - API: `compress(messages, strategy)` returns `CompressionResult`
- `ChatCompressionService` (`packages/core/src/services/chatCompressionService.ts`) - Used by `ChatClient` in non-interactive mode
  - Message type: `SessionMessage` (with `parts` array)
  - API: `compress(messages, options)` returns `CompressionResult`

**Impact**: Code duplication, maintenance burden, inconsistent behavior between TUI and non-interactive modes.

### 3. Dynamic Sizing Integration

**Status**: Partially Working

**Integration Path**:
1. `ContextManager` calculates optimal context size based on VRAM
2. Updates internal config via `updateConfig({ targetSize: size })`
3. Updates global settings via `SettingsService.getInstance().setContextSize(size)`
4. `ModelContext` reads `settings.llm?.contextSize` for `num_ctx` parameter
5. Passes `num_ctx` to provider in `chatStream()` call

**Potential Issues**:
- Timing: Settings updates may not propagate immediately to active requests
- Scope: Only affects TUI mode; non-interactive mode may not use dynamic sizing
- Validation: No verification that provider accepts the `num_ctx` parameter

### 4. Context Management Architecture

**Strengths**:
- Well-designed layered architecture (CLI/Orchestration/Service/Storage)
- Event-driven coordination between services
- Comprehensive VRAM monitoring across platforms (NVIDIA/AMD/Apple/Windows/CPU)
- Atomic snapshot storage with corruption detection
- Proactive memory safety with 4-level thresholds

**Architecture Components**:
- `ContextManager`: Main orchestrator coordinating all services
- `TokenCounterService`: Provider-integrated counting with caching
- `CompressionService`: Context-level compression strategies
- `VRAMMonitor`: Multi-platform GPU memory monitoring
- `SnapshotManager`: Conversation checkpoints with rolling cleanup
- `MemoryGuard`: Prevents OOM with emergency compression

### 5. Snapshot Storage

**Status**: Well Implemented

**Features**:
- Atomic JSON storage in `~/.ollm/session-data/`
- Corruption detection and recovery
- Rolling cleanup maintaining max snapshot count
- Session-based organization
- Cross-platform path handling

**Potential Windows Issues**: Design appears cross-platform but needs testing for path separators and permissions.

### 6. Provider Integration

**Status**: Properly Implemented

**Integration Points**:
- `LocalProvider` maps internal messages to Ollama format
- Handles streaming responses with tool call support
- Separates system prompts from message history
- Supports `num_ctx` parameter from settings

### 7. Unused/Legacy Code

**Potentially Unused**:
- `ChatCompressionService`: Only used in non-interactive mode; TUI uses different service
- `ChatClient`: Extensive tests but only used in non-interactive CLI mode
- Various test utilities implementing token counting heuristics

**Recommendation**: Consider consolidating compression services or clearly documenting their separate use cases.

### 8. Memory Safety

**Status**: Comprehensive

**Features**:
- 4-level memory thresholds (normal/warning/critical/emergency)
- Proactive monitoring with cooldown to prevent spam
- Automatic compression triggers at warning level
- Emergency truncation at critical level
- Snapshot creation before emergency actions

## Recommendations

### Immediate Actions
1. **Centralize Token Counting**: Update compression services to use `TokenCounterService` instead of heuristics
2. **Consolidate Compression Services**: Merge `CompressionService` and `ChatCompressionService` or clearly separate their responsibilities
3. **Add Token Counting Tests**: Validate that all token counting implementations produce identical results

### Medium-term Improvements
1. **Dynamic Sizing Validation**: Add verification that `num_ctx` updates reach the provider
2. **Cross-platform Testing**: Test snapshot storage on Windows for path/permission issues
3. **Performance Optimization**: Evaluate if token counting centralization impacts performance

### Long-term Architecture
1. **Unified Message Format**: Standardize on single message format across all services
2. **Service Registry**: Implement service discovery to avoid hard-coded service selection
3. **Configuration Management**: Improve settings propagation timing and validation

## Files Examined

### Core Context Management
- `packages/core/src/context/contextManager.ts`
- `packages/core/src/context/tokenCounter.ts`
- `packages/core/src/context/compressionService.ts`
- `packages/core/src/context/vramMonitor.ts`
- `packages/core/src/context/snapshotManager.ts`

### Services with Token Counting Issues
- `packages/core/src/services/chatCompressionService.ts`
- `packages/core/src/services/comparisonService.ts`
- `packages/core/src/services/reasoningParser.ts`

### CLI Integration
- `packages/cli/src/features/context/ModelContext.tsx`
- `packages/cli/src/features/context/ContextManagerContext.tsx`
- `packages/cli/src/config/settingsService.ts`

### Provider Integration
- `packages/ollm-bridge/src/provider/localProvider.ts`

## Conclusion

The context management system has a solid architectural foundation but suffers from implementation inconsistencies that could cause the reported token counting inaccuracies. The most critical issues are the duplicate token counting implementations and separate compression services. Addressing these would improve system reliability and maintainability.</content>
<parameter name="filePath">d:\Workspaces\OLLM CLI\.dev\context-audit-2.md