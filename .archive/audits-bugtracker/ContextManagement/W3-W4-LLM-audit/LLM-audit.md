# LLM Integration Comprehensive Audit

**Date:** January 19, 2026  
**Status:** Consolidated from 3 previous audits + fresh analysis  
**Scope:** Complete LLM integration including Ollama provider, model management, streaming, tool support detection, and UI integration

---

## Executive Summary

The LLM integration in OLLM CLI is functionally operational but suffers from **critical reliability issues** stemming from:

1. **Brittle heuristic-based detection** for tool support and error handling
2. **Inaccurate token counting** affecting context management decisions
3. **Complex warmup logic** with multiple retry mechanisms that can confuse users
4. **Tool support override system** with 4 different precedence levels creating confusion
5. **Silent failures** in multiple code paths hiding debugging information

**Impact:** Users experience unpredictable tool availability, context management issues, and confusing model switching behavior. The system works in happy-path scenarios but degrades poorly under edge cases.

**Recommendation:** Prioritize fixing token counting accuracy, simplifying tool detection, and improving error visibility before adding new features.

---

## Architecture Overview

### Data Flow
```
UI (ModelContext) 
  → Provider Adapter (LocalProvider)
    → Ollama HTTP API (/api/chat, /api/tags, /api/pull, etc.)
      → NDJSON Streaming Response
        → Event Mapping (text, tool_call, thinking, finish, error)
          → UI Callbacks (onText, onToolCall, onError, onComplete)
```

### Key Components
- **LocalProvider** (`packages/ollm-bridge/src/provider/localProvider.ts`) - Ollama adapter, message mapping, streaming parser
- **ModelContext** (`packages/cli/src/features/context/ModelContext.tsx`) - React context for model state, warmup, tool support detection
- **ModelManagementService** (`packages/core/src/services/modelManagementService.ts`) - Model lifecycle (list, pull, delete, info)
- **ProfileManager** (`packages/cli/src/features/profiles/ProfileManager.ts`) - Model metadata and capabilities

---

## Critical Issues

### 1. Token Counting Inaccuracy (CRITICAL)
**Location:** `packages/ollm-bridge/src/provider/localProvider.ts:570-585`

**Issue:** Rough character-based estimation (chars/4) instead of actual token counting

```typescript
async countTokens(request: ProviderRequest): Promise<number> {
  let totalChars = 0;
  if (request.systemPrompt) {
    totalChars += request.systemPrompt.length;
  }
  for (const msg of request.messages) {
    for (const part of msg.parts) {
      if (part.type === 'text') {
        totalChars += part.text.length;
      }
    }
  }
  return Math.ceil(totalChars / 4);
}
```

**Impact:**
- Inaccurate context window management
- Premature or delayed compression triggers
- Incorrect cost tracking
- Memory guard may fail to prevent OOM

**Evidence:** Used in 15+ locations across context management, compression services, and memory guard

**Severity:** CRITICAL - Affects core functionality

**Recommendation:**
- Implement provider-specific token counting (Ollama doesn't expose this, need to use tiktoken or similar)
- Add configuration for token estimation multiplier per model family
- Document estimation accuracy in user-facing messages

---

### 2. Brittle Tool Support Detection (CRITICAL)
**Location:** `packages/cli/src/features/context/ModelContext.tsx:150-160`

**Issue:** Regex-based error detection for tool unsupported errors

```typescript
const isToolUnsupportedError = useCallback((message: string): boolean => {
  return /tools?|tool_calls?|unknown field/i.test(message);
}, []);
```

**Problems:**
- Different Ollama versions may return different error messages
- False positives on legitimate errors containing "tool" keyword
- False negatives if error format changes
- No structured error codes from provider

**Impact:**
- Incorrect tool support metadata persisted to `user_models.json`
- Users prompted unnecessarily or not prompted when needed
- Tool calls fail silently or with confusing errors

**Severity:** CRITICAL - Breaks tool functionality

**Recommendation:**
- Use structured error codes from provider (check if Ollama supports this)
- Broaden regex patterns and add integration tests with real Ollama error responses
- Add explicit `TOOL_UNSUPPORTED` error code in provider adapter
- Consider capability detection during model listing instead of runtime errors

---

### 3. Complex Tool Support Override System (HIGH)
**Location:** `packages/cli/src/features/context/ModelContext.tsx:40-50`

**Issue:** 4-level precedence system for tool support overrides

```typescript
toolSupportOverridesRef.current.set(model, {
  supported: boolean,
  source: 'profile' | 'runtime_error' | 'user_confirmed' | 'auto_detected',
  timestamp: number,
});
```

**Precedence:** `user_confirmed` > `auto_detected` > `runtime_error` > `profile`

**Problems:**
- Complex logic spread across multiple functions
- Difficult to debug which source is active
- No UI visibility into override source
- Timestamps not used for expiration or staleness detection

**Impact:**
- Users confused about why tools are/aren't available
- Overrides can become stale (e.g., model updated to support tools)
- No way to reset overrides without editing JSON files

**Severity:** HIGH - Usability issue

**Recommendation:**
- Simplify to 2 levels: user_confirmed (permanent) and auto_detected (session-only)
- Add UI to show and reset tool support overrides
- Add expiration/staleness detection for auto_detected overrides
- Log override source in system messages for transparency

---

### 4. Warmup Logic Complexity (HIGH)
**Location:** `packages/cli/src/features/context/ModelContext.tsx:530-600`

**Issue:** Complex retry logic with multiple delays and timeout handling

```typescript
const retryDelaysMs = [1000, 2000, 4000];
const warmupTimeout = profile?.warmup_timeout ?? 30000;
```

**Problems:**
- 3 retry attempts with exponential backoff
- Different timeouts for reasoning models (120s) vs regular (30s)
- Warmup status not clearly communicated to user
- Retry logic can cause 7+ seconds of delay on model switch

**Impact:**
- Users wait without clear feedback
- Timeout errors confused with actual model errors
- Model switching feels slow and unresponsive

**Severity:** HIGH - UX issue

**Recommendation:**
- Show warmup progress in UI (attempt X of 3, elapsed time)
- Make warmup optional or configurable
- Consider background warmup without blocking UI
- Add "Skip warmup" button for impatient users

---

### 5. Message Part Concatenation Without Separator (MEDIUM)
**Location:** `packages/ollm-bridge/src/provider/localProvider.ts:214-240`

**Issue:** Message parts joined without delimiter

```typescript
const content = msg.parts
  .map((part: MessagePart) => (part.type === 'text' ? part.text : '[image]'))
  .join('');  // No separator!
```

**Impact:**
- Words from different parts may be glued together
- Multimodal messages (text + image) lose structure
- Potential parsing issues for models expecting structured input

**Severity:** MEDIUM - Data integrity issue

**Recommendation:**
- Add configurable separator (default: '\n\n')
- Preserve part metadata in message structure
- Test with multimodal inputs

---

### 6. JSON-in-Content Tool Call Detection (MEDIUM)
**Location:** `packages/ollm-bridge/src/provider/localProvider.ts:480-495`

**Issue:** "Healer" logic detects tool calls embedded as JSON in content

```typescript
// Healer: Detect if small model outputted tool call as a JSON string in content
if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
  try {
    const possibleToolCall = JSON.parse(content.trim());
    if (possibleToolCall.name && (possibleToolCall.parameters || possibleToolCall.args)) {
      yield { type: 'tool_call', value: { ... } };
      return; // Skip yielding as text
    }
  } catch {
    // Not a valid tool call JSON, fall through to normal text
  }
}
```

**Problems:**
- False positives on legitimate JSON text responses
- Only detects single-line JSON (fails on multi-line)
- Inconsistent with `message.tool_calls` parsing
- Hack for model limitations, not a robust solution

**Impact:**
- Legitimate JSON responses misinterpreted as tool calls
- Multi-line JSON tool calls missed
- Inconsistent tool call handling

**Severity:** MEDIUM - Correctness issue

**Recommendation:**
- Make heuristic more conservative (check for function-like structure)
- Add configuration to disable heuristic detection
- Document as workaround for specific models
- Add tests for false positive scenarios

---

### 7. Silent JSON Parsing Failures (MEDIUM)
**Location:** `packages/ollm-bridge/src/provider/localProvider.ts:160-180`

**Issue:** Malformed NDJSON lines skipped silently

```typescript
try {
  const chunk = JSON.parse(line);
  yield* this.mapChunkToEvents(chunk);
} catch (_error) {
  // Skip malformed JSON
}
```

**Impact:**
- Streaming errors hidden from users and developers
- Difficult to debug provider issues
- Partial responses may be lost

**Severity:** MEDIUM - Debugging issue

**Recommendation:**
- Log malformed JSON in debug mode
- Emit error events for parse failures
- Add metrics for parse failure rate
- Consider retry logic for transient network issues

---

### 8. Tool Schema Validation Strictness (LOW)
**Location:** `packages/ollm-bridge/src/provider/localProvider.ts:245-430`

**Issue:** Extensive validation may reject valid schemas

```typescript
if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(tool.name)) {
  throw new Error(`Tool name "${tool.name}" is invalid...`);
}
```

**Problems:**
- Rejects tool names with dots, slashes (common in namespaced tools)
- Circular reference detection may be overly strict
- Validation errors thrown during mapping, not registration

**Impact:**
- External tools (MCP, extensions) may fail to register
- Error messages appear during LLM calls, not tool registration
- No way to bypass validation for trusted tools

**Severity:** LOW - Compatibility issue

**Recommendation:**
- Relax name validation or add escape mechanism
- Move validation to tool registration time
- Add validation bypass for trusted sources
- Document validation rules clearly

---

### 9. Global Callbacks for UI Integration (LOW)
**Location:** `packages/cli/src/features/context/ModelContext.tsx:100-120`

**Issue:** Uses `globalThis` for UI callbacks

```typescript
const promptUser = globalThis.__ollmPromptUser;
const addSystemMessage = globalThis.__ollmAddSystemMessage;
const clearContext = globalThis.__ollmClearContext;
```

**Problems:**
- Fragile integration pattern
- No type safety
- Difficult to test
- Callbacks may be undefined in some contexts

**Impact:**
- Features degrade silently when callbacks missing
- Testing requires global mocks
- Refactoring difficult

**Severity:** LOW - Architecture issue

**Recommendation:**
- Use dependency injection or React context
- Add type-safe callback interfaces
- Provide default no-op implementations
- Document callback contracts

---

### 10. Context Clearing on Model Switch (LOW)
**Location:** `packages/cli/src/features/context/ModelContext.tsx:470`

**Issue:** Context cleared on every model switch

```typescript
// Clear context on model switch (Fix for Issue #1)
const clearContext = globalThis.__ollmClearContext;
if (clearContext) {
  clearContext();
}
```

**Problems:**
- Loses conversation history
- No user confirmation
- Comment references "Issue #1" with no context
- May not be desired behavior for all users

**Impact:**
- Users lose context when switching models
- Unexpected behavior
- No way to disable

**Severity:** LOW - UX issue

**Recommendation:**
- Make context clearing optional
- Prompt user for confirmation
- Document why this is necessary
- Consider context migration instead of clearing

---

## Additional Findings

### 11. Model Management Service Caching
**Location:** `packages/core/src/services/modelManagementService.ts:80-100`

**Issue:** 5-minute cache for model list

**Impact:**
- Stale model list after pulling/deleting models
- Cache invalidation not always triggered
- Fallback to stale cache on provider errors

**Severity:** LOW

**Recommendation:**
- Reduce cache TTL or make configurable
- Add manual cache refresh option
- Emit events on model changes

---

### 12. Keep-Alive Implementation
**Location:** `packages/core/src/services/modelManagementService.ts:200-250`

**Issue:** Keep-alive logic exists but is mostly no-op

```typescript
private async sendKeepAlive(name: string): Promise<void> {
  // Update last-used timestamp
  this.loadedModels.set(name, new Date());
  // In a real implementation, this would send a keep-alive request
  // to the provider. For Ollama, this is handled automatically.
}
```

**Impact:**
- Dead code
- Confusing for developers
- May not work as expected

**Severity:** LOW

**Recommendation:**
- Remove or implement properly
- Document Ollama's automatic keep-alive
- Consider removing keep-alive feature entirely

---

## Test Coverage Analysis

### Passing Tests
- LocalProvider unit tests (31 tests) - message mapping, tool schemas, streaming
- ModelContext tests - warmup, tool detection, error handling
- Integration tests - NDJSON streaming, fragmented JSON, options passing

### Failing Tests
- `memoryGuard.enforce-compress-signature.test.ts` - Compression API mismatch (separate issue)

### Missing Tests
- Tool support override precedence logic
- Warmup retry behavior under various error conditions
- Token counting accuracy across different message types
- JSON-in-content false positive scenarios
- Multi-line JSON tool call detection
- Timeout handling edge cases

---

## Performance Concerns

### 1. Warmup Overhead
- Every model switch triggers warmup request
- 3 retry attempts with delays (1s, 2s, 4s)
- Total delay: up to 7+ seconds
- Blocks UI during warmup

### 2. Profile Loading
- Loads entire `LLM_profiles.json` on startup
- No lazy loading or pagination
- Memory overhead for large profile files

### 3. Token Estimation Performance
- Character counting on every message
- No caching of token counts
- Repeated calculations for same content

---

## Security Concerns

### 1. Error Message Sanitization
- Error messages may contain sensitive information
- No redaction of API keys or tokens in error logs
- Stack traces exposed to users

### 2. Network Timeouts
- Hardcoded timeouts (5s, 30s, 120s)
- No centralized timeout configuration
- Potential for DoS if timeouts too long

### 3. Abort Handling
- AbortController used inconsistently
- Some code paths pass Error as abort reason
- May cause unexpected behavior

---

## Recommendations by Priority

### P0 (Critical - Fix Immediately)
1. **Improve token counting accuracy**
   - Implement tiktoken or similar library
   - Add per-model token estimation configuration
   - Document estimation accuracy
   - **Effort:** 3-5 days
   - **Impact:** Fixes context management, compression, memory guard

2. **Harden tool support detection**
   - Use structured error codes
   - Broaden regex patterns
   - Add integration tests with real Ollama errors
   - **Effort:** 2-3 days
   - **Impact:** Fixes tool functionality reliability

### P1 (High - Fix Soon)
3. **Simplify tool support override system**
   - Reduce to 2 levels (user_confirmed, auto_detected)
   - Add UI for override management
   - Add staleness detection
   - **Effort:** 3-4 days
   - **Impact:** Improves usability and debuggability

4. **Improve warmup UX**
   - Show progress in UI
   - Make warmup optional
   - Add skip button
   - **Effort:** 2-3 days
   - **Impact:** Improves perceived performance

5. **Add logging for silent failures**
   - Log malformed JSON in debug mode
   - Emit error events for parse failures
   - Add metrics
   - **Effort:** 1-2 days
   - **Impact:** Improves debuggability

### P2 (Medium - Schedule for Next Sprint)
6. **Fix message part concatenation**
   - Add configurable separator
   - Test with multimodal inputs
   - **Effort:** 1 day
   - **Impact:** Fixes data integrity

7. **Improve JSON-in-content detection**
   - Make heuristic more conservative
   - Add configuration to disable
   - Add tests for false positives
   - **Effort:** 2 days
   - **Impact:** Reduces false positives

8. **Replace global callbacks with DI**
   - Use React context or props
   - Add type-safe interfaces
   - **Effort:** 3-4 days
   - **Impact:** Improves architecture and testability

### P3 (Low - Nice to Have)
9. **Relax tool schema validation**
   - Allow dots/slashes in names
   - Move validation to registration time
   - **Effort:** 1 day
   - **Impact:** Improves compatibility

10. **Make context clearing optional**
    - Add user confirmation
    - Make configurable
    - **Effort:** 1 day
    - **Impact:** Improves UX

11. **Clean up keep-alive implementation**
    - Remove or implement properly
    - Document behavior
    - **Effort:** 1 day
    - **Impact:** Reduces confusion

---

## Testing Strategy

### Unit Tests to Add
- Token counting accuracy tests with known inputs
- Tool support override precedence tests
- Warmup retry behavior tests
- JSON-in-content false positive tests
- Message part concatenation tests

### Integration Tests to Add
- End-to-end tool support detection flow
- Model switching with context preservation
- Streaming with various error conditions
- Timeout handling under load

### Property-Based Tests to Add
- Token counting consistency across message variations
- Tool schema validation with random inputs
- NDJSON parsing with malformed inputs

---

## Migration Path

### Phase 1 (Week 1-2): Critical Fixes
- Implement better token counting
- Harden tool support detection
- Add logging for silent failures

### Phase 2 (Week 3-4): High Priority
- Simplify tool support overrides
- Improve warmup UX
- Fix message concatenation

### Phase 3 (Week 5-6): Medium Priority
- Improve JSON-in-content detection
- Replace global callbacks
- Add comprehensive tests

### Phase 4 (Week 7+): Low Priority
- Relax tool schema validation
- Make context clearing optional
- Clean up keep-alive

---

## Conclusion

The LLM integration is **functionally operational** but suffers from **reliability and usability issues** that degrade the user experience. The core architecture is sound, but implementation details need refinement.

**Key Takeaways:**
- Token counting inaccuracy affects multiple subsystems
- Tool support detection is too brittle
- Silent failures hide important debugging information
- Warmup logic needs better UX
- Test coverage is good but missing edge cases

**Next Steps:**
1. Fix token counting (P0)
2. Harden tool detection (P0)
3. Add logging (P1)
4. Improve warmup UX (P1)
5. Add missing tests

**Estimated Effort:** 4-6 weeks for all priorities, 2-3 weeks for P0/P1 only

---

**Audit Completed:** January 19, 2026  
**Auditor:** AI Assistant (Consolidated from 3 previous audits + fresh code analysis)
