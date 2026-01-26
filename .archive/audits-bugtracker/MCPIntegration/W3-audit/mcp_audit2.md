# MCP Integration Audit Report

**Date:** January 19, 2026  
**Auditor:** GitHub Copilot  
**Scope:** MCP (Model Context Protocol) handling in OLLM CLI, focusing on how the app manages MCP servers, integration with chat/LLM toolkit, and potential bugs/legacy code.

## Executive Summary

The MCP integration in OLLM CLI is partially implemented but has critical gaps that prevent MCP tools from being available in chat conversations. While MCP servers can be managed through the UI, they do not contribute tools to the LLM's function calling capability. Several implementation inconsistencies and potential bugs were identified.

## Architecture Overview

### Core Components
- **MCPClient**: Manages server lifecycle, connections, and tool invocations
- **MCPTransport**: Handles communication (Stdio, SSE, HTTP)
- **MCPToolWrapper**: Converts MCP tools to internal tool format
- **MCPSchemaConverter**: Maps between MCP and internal schemas
- **ExtensionManager**: Loads extensions and starts MCP servers
- **ChatContext**: Manages chat conversations and tool registry

### Integration Flow
1. Extensions are loaded by ExtensionManager
2. MCP servers defined in extensions are started
3. MCP tools are discovered and wrapped
4. Tools should be registered in tool registry for LLM use

## Critical Issues

### 1. MCP Tools Not Available in Chat (CRITICAL BUG)

**Location:** `packages/core/src/extensions/extensionManager.ts:362`, `packages/cli/src/features/context/ChatContext.tsx:420`

**Issue:** MCP tools are registered to the ExtensionManager's tool registry, but the ChatContext creates a separate tool registry. Since the service container doesn't pass a shared tool registry to ExtensionManager, MCP tools exist in isolation and are never made available to the LLM during chat.

**Code Evidence:**
```typescript
// ExtensionManager registers to its own registry
this.toolRegistry.register(wrappedTool); // toolRegistry is undefined if not passed

// ChatContext creates separate registry
const toolRegistry = new ToolRegistry(settingsService);
toolRegistry.register(new HotSwapTool(...)); // Only built-in tools
```

**Impact:** Users can manage MCP servers in UI but cannot use MCP tools in conversations.

**Fix Required:** Implement shared tool registry or modify ChatContext to include MCP tools from ExtensionManager.

### 2. Incomplete Integration Status

**Location:** `packages/core/src/mcp/README.md` vs `.kiro/specs/stage-05-hooks-extensions-mcp/tasks.md`

**Issue:** README shows MCP integration tasks as pending (⏳), but tasks.md shows them as completed (✅). This inconsistency indicates potential documentation drift.

**Affected Tasks:**
- Task 15-20: Transport, Client, Schema Converter, Tool Wrapper, Extension Integration
- Task 28: Additional transports

### 3. Race Condition in StdioTransport

**Location:** `packages/core/src/mcp/mcpTransport.ts:110`

**Issue:** `connect()` marks transport as connected immediately after spawning the process, without waiting for the MCP server to signal readiness. This could lead to premature tool calls before the server is initialized.

**Code:**
```typescript
// Marks connected immediately after spawn
if (!errorOccurred) {
  this.connected = true;
  resolve();
}
```

**Risk:** Tool invocations may fail if server startup is slow.

### 4. Missing Request Timeouts

**Location:** `packages/core/src/mcp/mcpTransport.ts:165`

**Issue:** `sendRequest()` has no timeout mechanism. Requests could hang indefinitely if the MCP server becomes unresponsive.

**Code:**
```typescript
return new Promise((resolve, reject) => {
  // No timeout implemented
  this.pendingRequests.set(id, { resolve, reject });
  // ...
});
```

**Risk:** UI freezing on unresponsive MCP servers.

## Potential Bugs

### 5. OAuth Security Concerns

**Location:** `packages/core/src/mcp/mcpOAuth.ts`

**Issue:** OAuth flow uses local HTTP server for redirect URI, which may be vulnerable to:
- Port conflicts
- Local network attacks
- Improper token handling

**Recommendation:** Add validation and security hardening.

### 6. Buffer Overflow Protection

**Location:** `packages/core/src/mcp/mcpTransport.ts:75`

**Issue:** Output size limit of 10MB may be insufficient for some MCP servers or too permissive for others.

**Code:**
```typescript
private readonly MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
```

**Recommendation:** Make configurable or implement streaming for large responses.

### 7. Error Masking

**Location:** Multiple locations in `mcpTransport.ts` and `mcpClient.ts`

**Issue:** Some errors are logged but not propagated, potentially hiding issues.

**Example:**
```typescript
} catch (error) {
  // Log error but continue without compression
  console.error('Compression check failed:', error);
}
```

**Assessment:** Generally appropriate for non-critical errors, but some may need user notification.

## Legacy Code Issues

### 8. Outdated Documentation

**Location:** `packages/core/src/mcp/README.md`

**Issue:** Implementation status doesn't reflect actual completion state. Several components are fully implemented but marked as pending.

### 9. Incomplete Transport Implementations

**Location:** `packages/core/src/mcp/mcpTransport.ts`

**Issue:** SSE and HTTP transports are implemented but not fully tested or documented.

**Status:** Basic implementations exist but may have edge cases.

## Code Quality Assessment

### Strengths
- Comprehensive error handling in most components
- Good separation of concerns
- Extensive test coverage (property tests, unit tests)
- Proper TypeScript typing
- Environment variable substitution implemented

### Weaknesses
- Tool registry isolation prevents feature completion
- Inconsistent documentation
- Potential race conditions
- Missing timeouts in critical paths

## Recommendations

### Immediate Actions
1. **Fix tool registry sharing** - Implement shared tool registry between ExtensionManager and ChatContext
2. **Add request timeouts** - Implement configurable timeouts in MCPTransport
3. **Fix connection readiness** - Wait for MCP server handshake in StdioTransport
4. **Update documentation** - Sync README with actual implementation status

### Medium-term Improvements
1. **Security audit** - Review OAuth implementation
2. **Performance testing** - Test with various MCP servers
3. **Streaming support** - Implement proper streaming for large responses
4. **Health monitoring** - Add automatic restart for failed servers

### Long-term Considerations
1. **Plugin architecture** - Consider making MCP a plugin system
2. **Caching layer** - Add result caching for expensive operations
3. **Metrics collection** - Add performance monitoring

## Testing Coverage

**Good coverage areas:**
- Tool wrapping and execution
- Schema conversion
- Error translation
- Property-based testing for edge cases

**Missing test areas:**
- Integration between ExtensionManager and ChatContext
- Transport timeouts and error recovery
- OAuth flows
- Large payload handling

## Conclusion

The MCP integration shows solid foundational work but has a critical architectural flaw preventing the feature from working end-to-end. The separation of tool registries between extension management and chat execution needs immediate attention. Once fixed, the implementation appears robust enough for production use with some additional hardening.

**Priority:** HIGH - Core functionality is broken
**Effort:** MEDIUM - Architectural change required
**Risk:** LOW-MEDIUM - Well-isolated implementation