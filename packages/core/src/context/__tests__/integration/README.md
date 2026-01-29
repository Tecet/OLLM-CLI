# Context Compression System - Integration Tests

This directory contains comprehensive integration tests for the context compression system. These tests verify that all subsystems work together correctly in real-world scenarios.

## Test Suites

### 1. Long Conversation Test (`longConversation.test.ts`)

Tests the system's ability to handle extended conversations with 10+ compressions.

**Coverage:**
- ✅ Handles 10+ compressions without crashing
- ✅ Maintains conversation continuity across compressions
- ✅ Keeps token usage within limits throughout conversation
- ✅ Saves and exports session history correctly
- ✅ Handles rapid message additions without errors

**Requirements:** All FR (FR-1 through FR-16)

**Key Scenarios:**
- 30+ message conversation triggering 10+ compressions
- Verification of checkpoint creation and management
- Token usage monitoring throughout conversation
- Session history persistence and export
- Concurrent message additions

### 2. Checkpoint Aging Test (`checkpointAging.test.ts`)

Tests the checkpoint aging system to ensure checkpoints compress over time.

**Coverage:**
- ✅ Ages checkpoints from Level 3 to Level 2 after 5 compressions
- ✅ Ages checkpoints from Level 2 to Level 1 after 10 compressions
- ✅ Reduces token usage through aging
- ✅ Maintains checkpoint summaries after aging
- ✅ Handles aging with no checkpoints gracefully
- ✅ Ages multiple checkpoints in one pass

**Requirements:** FR-2, FR-6

**Key Scenarios:**
- Checkpoint aging at different compression counts
- Token reduction verification
- Summary preservation validation
- Edge cases (no checkpoints, single checkpoint)
- Batch aging operations

### 3. Emergency Scenarios Test (`emergencyScenarios.test.ts`)

Tests emergency actions when normal compression fails.

**Coverage:**
- ✅ Handles context overflow gracefully
- ✅ Creates snapshots before emergency actions
- ✅ Recovers from LLM failures during compression
- ✅ Maintains system health under stress
- ✅ Handles very large messages gracefully
- ✅ Prevents context overflow with validation
- ✅ Handles concurrent compression attempts
- ✅ Cleans up old snapshots

**Requirements:** FR-8, FR-9

**Key Scenarios:**
- Context near capacity situations
- LLM failure recovery
- Stress testing with rapid additions
- Large message handling
- Snapshot management
- Concurrent operation safety

### 4. Error Handling Test (`errorHandling.test.ts`)

Tests comprehensive error handling throughout the system.

**Coverage:**
- ✅ Handles LLM errors during compression gracefully
- ✅ Handles provider timeouts
- ✅ Handles invalid LLM responses
- ✅ Handles invalid message objects
- ✅ Recovers from file system errors
- ✅ Handles rapid error recovery
- ✅ Provides clear error messages
- ✅ Maintains state consistency after errors
- ✅ Handles missing snapshot files gracefully
- ✅ Handles concurrent operations safely

**Requirements:** FR-6, FR-7

**Key Scenarios:**
- Provider failures (connection, timeout, invalid response)
- Invalid input handling
- File system errors
- Error recovery patterns
- State consistency verification
- Concurrent operation safety

## Running the Tests

### Run All Integration Tests

```bash
npm test -- packages/core/src/context/__tests__/integration
```

### Run Specific Test Suite

```bash
# Long conversation test
npm test -- packages/core/src/context/__tests__/integration/longConversation.test.ts

# Checkpoint aging test
npm test -- packages/core/src/context/__tests__/integration/checkpointAging.test.ts

# Emergency scenarios test
npm test -- packages/core/src/context/__tests__/integration/emergencyScenarios.test.ts

# Error handling test
npm test -- packages/core/src/context/__tests__/integration/errorHandling.test.ts
```

### Run with Coverage

```bash
npm test -- --coverage packages/core/src/context/__tests__/integration
```

### Run in Watch Mode

```bash
npm test -- --watch packages/core/src/context/__tests__/integration
```

## Test Configuration

### Timeouts

Integration tests have extended timeouts due to their comprehensive nature:
- Long conversation test: 60 seconds
- Checkpoint aging test: 60 seconds
- Emergency scenarios test: 60 seconds
- Error handling test: 30 seconds

### Mock Providers

All tests use mock providers that simulate LLM behavior:
- **MockProvider**: Basic provider for normal operations
- **ErrorMockProvider**: Configurable provider for error scenarios

### Temporary Storage

Tests create temporary storage directories for:
- Session history files
- Snapshot files
- Test isolation

All temporary files are cleaned up after each test.

## Test Patterns

### Setup Pattern

```typescript
beforeEach(async () => {
  // Create temporary storage
  storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));
  sessionId = `test_session_${Date.now()}`;
  
  // Initialize components
  tokenCounter = new TokenCounterService();
  mockProvider = new MockProvider();
  
  // Create orchestrator
  orchestrator = new ContextOrchestrator({
    systemPrompt,
    ollamaLimit: 2000,
    tokenCounter,
    provider: mockProvider,
    model: 'test-model',
    sessionId,
    storagePath,
  });
});
```

### Cleanup Pattern

```typescript
afterEach(async () => {
  // Cleanup temporary storage
  try {
    await fs.rm(storagePath, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});
```

### Message Creation Pattern

```typescript
const message: Message = {
  role: 'user',
  content: 'Message content',
  id: 'msg_1',
  timestamp: new Date(),
  parts: [{ type: 'text', text: 'Message content' }],
};
```

## Success Criteria

All integration tests must pass before the context compression system is considered complete:

- ✅ Long conversation test: All scenarios pass
- ✅ Checkpoint aging test: All scenarios pass
- ✅ Emergency scenarios test: All scenarios pass
- ✅ Error handling test: All scenarios pass

## Debugging

### Enable Verbose Logging

Set environment variable:
```bash
DEBUG=ollm:context npm test
```

### Inspect Test Artifacts

Tests create temporary directories. To inspect:
```bash
# Find temp directories
ls -la /tmp/ollm-test-*

# View session history
cat /tmp/ollm-test-*/test_session_*.json

# View snapshots
ls -la /tmp/ollm-test-*/snapshots/
```

### Common Issues

**Issue: Tests timeout**
- Increase timeout in test configuration
- Check for infinite loops in compression logic
- Verify mock provider responses

**Issue: File system errors**
- Check permissions on temp directory
- Verify cleanup is working correctly
- Check for file locks

**Issue: Inconsistent results**
- Check for race conditions
- Verify proper async/await usage
- Check for shared state between tests

## Maintenance

### Adding New Tests

1. Create new test file in this directory
2. Follow existing patterns for setup/cleanup
3. Use descriptive test names
4. Document requirements covered
5. Update this README

### Updating Tests

1. Maintain backward compatibility
2. Update documentation
3. Verify all tests still pass
4. Check coverage hasn't decreased

### Removing Tests

1. Document reason for removal
2. Ensure coverage is maintained elsewhere
3. Update this README

## Related Documentation

- [Requirements](../../../.kiro/specs/v0.1.1 Context Compression Refactor/requirements.md)
- [Design](../../../.kiro/specs/v0.1.1 Context Compression Refactor/design.md)
- [Tasks](../../../.kiro/specs/v0.1.1 Context Compression Refactor/tasks.md)
- [Context Compression Docs](../../../.dev/docs/knowledgeDB/dev_ContextCompression.md)

## Contact

For questions or issues with integration tests, refer to the main project documentation or create an issue.
