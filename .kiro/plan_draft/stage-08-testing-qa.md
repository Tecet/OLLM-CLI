# Stage 08: Testing and QA

## Overview
Ensure core behavior is reliable across models. Validate tool calling and streaming correctness. Create comprehensive test coverage.

## Prerequisites
- Stage 07 complete (Model Management)

## Estimated Effort
3-4 days

## Testing Stack
- Vitest for unit and integration tests
- ink-testing-library for UI tests

---

## Tasks

### S08-T01: Unit Tests

**Steps**:
1. Add tests for provider adapters:
   - Message format conversion
   - Stream event parsing
   - Error handling
2. Add tests for tool schema mapping:
   - Schema validation
   - Parameter conversion
   - Result formatting
3. Add tests for ReAct parser:
   - Output parsing
   - JSON extraction
   - Error cases
4. Add tests for token estimation:
   - Estimation accuracy
   - Limit enforcement
5. Add tests for routing:
   - Profile matching
   - Fallback logic

**Deliverables**:
- `packages/core/src/**/__tests__/*`
- `packages/ollm-bridge/src/**/__tests__/*`

**Acceptance Criteria**:
- Unit tests pass in CI
- Coverage meets minimum threshold (80%)
- All public APIs have tests

---

### S08-T02: Integration Tests

**Steps**:
1. Create integration test infrastructure:
   - Test fixtures
   - Mock server (optional)
   - Real server detection
2. Add streaming tests:
   - Text streaming
   - Tool call streaming
   - Error streaming
3. Add tool call tests:
   - Single tool call
   - Multiple tool calls
   - Tool call with errors
4. Add model management tests:
   - List models
   - Pull model (if server available)
   - Delete model
5. Handle server availability:
   - Skip gracefully when unavailable
   - Clear skip messages

**Deliverables**:
- `integration-tests/`
- `integration-tests/setup.ts`
- `integration-tests/streaming.test.ts`
- `integration-tests/tools.test.ts`
- `integration-tests/models.test.ts`

**Acceptance Criteria**:
- Tests pass when server is available
- Tests skip gracefully when server unavailable
- Clear output indicates skip reason

---

### S08-T03: UI Tests

**Steps**:
1. Set up ink-testing-library
2. Add rendering tests:
   - ChatHistory renders messages
   - InputBox accepts input
   - StatusBar shows status
3. Add interaction tests:
   - Keyboard navigation
   - Slash command parsing
   - Tool confirmation flow
4. Add streaming tests:
   - Incremental rendering
   - Progress indicators

**Deliverables**:
- `packages/cli/src/ui/__tests__/*`

**Acceptance Criteria**:
- UI tests cover key workflows
- Streaming rendering works
- Tool confirmations work

---

### S08-T04: Compatibility Matrix

**Steps**:
1. Define representative models:
   - General: llama3.1:8b
   - Code: codellama:7b or deepseek-coder
   - Small: phi3:mini or gemma:2b
2. Test each model for:
   - Basic chat
   - Tool calling (native or ReAct)
   - Streaming
   - Context handling
3. Document results:
   - Pass/fail for each capability
   - Known issues
   - Workarounds

**Deliverables**:
- `docs/compatibility.md`

**Acceptance Criteria**:
- At least 3 models tested
- Results documented clearly
- Known issues listed

---

## File Structure After Stage 08

```
packages/core/src/
├── provider/__tests__/
│   ├── registry.test.ts
│   └── types.test.ts
├── core/__tests__/
│   ├── chatClient.test.ts
│   ├── turn.test.ts
│   ├── reactToolHandler.test.ts
│   └── tokenLimits.test.ts
├── tools/__tests__/
│   ├── tool-registry.test.ts
│   ├── read-file.test.ts
│   └── shell.test.ts
├── services/__tests__/
│   ├── chatRecordingService.test.ts
│   └── loopDetectionService.test.ts
└── routing/__tests__/
    └── modelRouter.test.ts

packages/cli/src/ui/__tests__/
├── ChatHistory.test.tsx
├── InputBox.test.tsx
├── ToolConfirmation.test.tsx
└── StatusBar.test.tsx

integration-tests/
├── setup.ts
├── streaming.test.ts
├── tools.test.ts
└── models.test.ts

docs/
└── compatibility.md
```

---

## Test Configuration

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/__tests__/**']
    },
    testTimeout: 30000,
    hookTimeout: 10000
  }
});
```

---

## Integration Test Setup

```typescript
// integration-tests/setup.ts
import { beforeAll, afterAll } from 'vitest';

export const SERVER_URL = process.env.OLLM_TEST_SERVER || 'http://localhost:11434';

export async function isServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

export function skipIfNoServer() {
  return async () => {
    if (!(await isServerAvailable())) {
      console.log('⚠️ Skipping: Local LLM server not available');
      return true;
    }
    return false;
  };
}
```

---

## Compatibility Matrix Template

```markdown
# Model Compatibility Matrix

## Test Environment
- OLLM CLI Version: x.x.x
- Test Date: YYYY-MM-DD
- Server: Ollama vX.X.X

## Models Tested

### llama3.1:8b (General)
| Feature | Status | Notes |
|---------|--------|-------|
| Basic Chat | ✅ Pass | |
| Streaming | ✅ Pass | |
| Native Tool Calling | ✅ Pass | |
| ReAct Fallback | ✅ Pass | |
| Context 8K | ✅ Pass | |
| Context 32K | ✅ Pass | |
| Context 128K | ⚠️ Partial | Slow with large context |

### codellama:7b (Code)
| Feature | Status | Notes |
|---------|--------|-------|
| Basic Chat | ✅ Pass | |
| Streaming | ✅ Pass | |
| Native Tool Calling | ❌ Fail | Not supported |
| ReAct Fallback | ✅ Pass | |
| Context 8K | ✅ Pass | |
| Context 16K | ✅ Pass | |

### phi3:mini (Small/Fast)
| Feature | Status | Notes |
|---------|--------|-------|
| Basic Chat | ✅ Pass | |
| Streaming | ✅ Pass | |
| Native Tool Calling | ❌ Fail | Not supported |
| ReAct Fallback | ⚠️ Partial | Sometimes fails to follow format |
| Context 4K | ✅ Pass | |

## Known Issues

1. **codellama**: No native tool calling support, must use ReAct
2. **phi3:mini**: ReAct format compliance is inconsistent
3. **Large contexts**: Performance degrades significantly above 64K tokens

## Recommendations

- Use llama3.1 for general tasks with tool calling
- Use codellama with ReAct for code tasks
- Use phi3:mini for quick, simple queries only
```

---

## Test Categories

### Unit Tests
- Pure function tests
- No external dependencies
- Fast execution (<100ms each)
- High coverage target (80%+)

### Integration Tests
- Real server interaction
- Slower execution
- Skip when server unavailable
- Focus on critical paths

### UI Tests
- Component rendering
- User interactions
- Keyboard handling
- Streaming display

---

## Verification Checklist

- [ ] Unit tests pass locally
- [ ] Unit tests pass in CI
- [ ] Coverage meets threshold
- [ ] Integration tests pass with server
- [ ] Integration tests skip gracefully without server
- [ ] UI tests cover key components
- [ ] UI tests cover interactions
- [ ] Compatibility matrix completed
- [ ] At least 3 models tested
- [ ] Known issues documented
