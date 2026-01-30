# Context Orchestrator Property Tests

## Overview

This directory contains property-based tests for the Context Orchestrator, which is the main coordinator for the context compression system refactor.

## Test File

### `contextOrchestrator.property.test.ts`

**Property 20: Orchestrator Coordination**

This test validates that the orchestrator properly coordinates all subsystems:

- Active Context Manager (FR-1)
- Snapshot Lifecycle (FR-3)
- Session History Manager (FR-4)
- Compression Pipeline (FR-5)
- Checkpoint Lifecycle (FR-2)

## Test Structure

The test file contains **10 main property tests** and **5 integration scenario tests**:

### Main Property Tests

1. **Maintains consistency across all subsystems during operations**
   - Validates: FR-1, FR-2, FR-3, FR-4, FR-5
   - Tests arbitrary sequences of operations (addMessage, compress, createSnapshot, ageCheckpoints)
   - Verifies 10 key invariants

2. **Keeps active context and session history synchronized**
   - Validates: FR-1, FR-4
   - Ensures messages are never lost
   - Verifies synchronization after compression

3. **Creates snapshots that capture complete conversation state**
   - Validates: FR-3
   - Tests snapshot creation and restoration
   - Verifies complete state capture

4. **Integrates compression pipeline while maintaining data integrity**
   - Validates: FR-5
   - Tests compression integration
   - Verifies token count reduction

5. **Integrates checkpoint lifecycle to free tokens**
   - Validates: FR-2
   - Tests checkpoint aging and merging
   - Verifies token reduction

6. **Maintains consistent token counts across all subsystems**
   - Validates: FR-1, FR-5
   - Tests token count accuracy
   - Verifies calculations

7. **Preserves message ordering across all operations**
   - Validates: FR-1, FR-4
   - Tests chronological ordering
   - Verifies order preservation

8. **Maintains system integrity when errors occur**
   - Validates: FR-7
   - Tests error handling
   - Verifies recovery mechanisms

9. **Remains stable during long conversations with multiple compressions**
   - Validates: FR-1, FR-2, FR-3, FR-4, FR-5
   - Tests 50-100 message conversations
   - Verifies stability and performance

10. **Manages subsystem lifecycle correctly**
    - Validates: FR-1, FR-2, FR-3, FR-4, FR-5
    - Tests initialization and cleanup
    - Verifies no resource leaks

### Integration Scenario Tests

1. **Triggers compression when context fills up**
2. **Handles multiple compressions with checkpoint aging**
3. **Executes emergency actions when context is critical**
4. **Creates snapshots and restores conversation state**
5. **Recovers from errors using snapshots**

## Current Status

**Status:** ✅ Test structure complete, awaiting ContextOrchestrator implementation

The test file is currently implemented with **placeholder tests** that:

- Document the expected behavior
- Define all invariants that must hold
- Provide the test structure
- Pass with placeholder assertions

## Next Steps

When implementing **Task 15: Implement Context Orchestrator**, the developer should:

1. Import the `ContextOrchestrator` class
2. Replace placeholder implementations with actual tests
3. Instantiate the orchestrator in each test
4. Execute operations and verify invariants
5. Ensure all requirements (FR-1 through FR-5) are validated

## Example Implementation Pattern

```typescript
it('maintains consistency across all subsystems during operations', async () => {
  await fc.assert(
    fc.asyncProperty(
      messageSequenceArbitrary,
      fc.array(orchestratorOperationArbitrary, { minLength: 5, maxLength: 20 }),
      async (initialMessages, operations) => {
        // 1. Create orchestrator
        const orchestrator = new ContextOrchestrator({
          systemPrompt,
          ollamaLimit: 10000,
          tokenCounter,
          provider: mockProvider,
          model: 'test-model',
          sessionId: 'test-session',
          storagePath: '/tmp/test',
        });

        // 2. Add initial messages
        for (const message of initialMessages) {
          await orchestrator.addMessage(message);
        }

        // 3. Execute operations
        for (const op of operations) {
          if (op.type === 'addMessage') {
            await orchestrator.addMessage(op.message);
          } else if (op.type === 'compress') {
            await orchestrator.compress();
          } else if (op.type === 'createSnapshot') {
            await orchestrator.createSnapshot(op.purpose);
          } else if (op.type === 'ageCheckpoints') {
            await orchestrator.ageCheckpoints();
          }

          // 4. Verify invariants after each operation
          const state = orchestrator.getState();

          // Invariant 1: Token count never exceeds limit
          expect(state.activeContext.tokenCount.total).toBeLessThanOrEqual(
            10000 - 1000 // limit - safety margin
          );

          // Invariant 2: Session history contains all messages
          expect(state.sessionHistory.messages.length).toBeGreaterThanOrEqual(
            initialMessages.length
          );

          // ... more invariant checks
        }
      }
    ),
    { numRuns: 50 }
  );
});
```

## Key Invariants to Verify

### Token Count Invariants

- Total tokens = system + checkpoints + recent messages
- Total tokens ≤ ollamaLimit - safetyMargin
- Token counts are always non-negative

### Data Integrity Invariants

- Session history contains all messages ever added
- Active context messages exist in session history
- Compression doesn't lose messages from session history
- Message IDs are unique and traceable

### Snapshot Invariants

- Snapshots contain complete conversation state
- Snapshots can restore exact state
- Snapshots are created before risky operations

### Compression Invariants

- Compression reduces active context token count
- Compressed messages are replaced by checkpoint
- Checkpoint is added to active context
- Session history remains complete

### Checkpoint Lifecycle Invariants

- Aging checkpoints reduces token count
- Merging checkpoints reduces checkpoint count
- Checkpoint metadata is updated correctly
- Session history tracks checkpoint changes

### Ordering Invariants

- Messages maintain chronological order
- Compression doesn't reorder messages
- Checkpoints are inserted in correct position
- Timestamps are monotonic

### Error Handling Invariants

- Errors don't corrupt active context
- Errors don't lose session history
- Snapshots enable recovery from errors
- System remains in valid state after errors

## Test Configuration

- **Property tests:** 50 runs each (except long conversations: 10 runs)
- **Message sequences:** 10-50 messages for most tests, 50-100 for long conversation tests
- **Operations:** 5-20 operations per test
- **Fast-check:** Used for property-based testing with arbitrary data generation

## Requirements Coverage

| Requirement | Description              | Tests                   |
| ----------- | ------------------------ | ----------------------- |
| FR-1        | Storage Layer Separation | Tests 1, 2, 6, 7, 9, 10 |
| FR-2        | Checkpoint Lifecycle     | Tests 1, 5, 9, 10       |
| FR-3        | Snapshot Management      | Tests 1, 3, 9, 10       |
| FR-4        | Session History          | Tests 1, 2, 7, 9, 10    |
| FR-5        | Compression Pipeline     | Tests 1, 4, 6, 9, 10    |
| FR-7        | Error Handling           | Test 8                  |

## Running the Tests

```bash
# Run all orchestrator property tests
npm test -- packages/core/src/context/orchestration/__tests__/contextOrchestrator.property.test.ts --run

# Run with coverage
npm test -- packages/core/src/context/orchestration/__tests__/contextOrchestrator.property.test.ts --run --coverage

# Run specific test
npm test -- packages/core/src/context/orchestration/__tests__/contextOrchestrator.property.test.ts --run -t "maintains consistency"
```

## Notes

- Tests use `fast-check` for property-based testing
- Mock provider is used for LLM calls
- Tests are designed to be deterministic and reproducible
- Placeholder implementations currently pass - real implementations will be added with Task 15
- All tests include detailed comments explaining what they validate

## Related Files

- `../contextOrchestrator.ts` - Implementation (to be created in Task 15)
- `../../storage/activeContextManager.ts` - Active context management
- `../../compression/compressionPipeline.ts` - Compression pipeline
- `../../checkpoints/checkpointLifecycle.ts` - Checkpoint lifecycle
- `../../storage/snapshotLifecycle.ts` - Snapshot management
- `../../storage/sessionHistoryManager.ts` - Session history

## References

- Requirements: `.kiro/specs/v0.1.1 Context Compression Refactor/requirements.md`
- Design: `.kiro/specs/v0.1.1 Context Compression Refactor/design.md`
- Tasks: `.kiro/specs/v0.1.1 Context Compression Refactor/tasks.md`
