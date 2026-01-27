# ChatContext.tsx Refactoring Plan

**Current Size:** 1404 lines
**Target:** < 500 lines (main handler only)

## Current Structure Analysis

### Helper Functions (Lines 33-115) - ~82 lines
Can be extracted to separate utility files:

1. **`resolveTierForSize()`** - Tier resolution logic
2. **`toOperationalMode()`** - Mode conversion
3. **`tierToKey()`** - Tier to key mapping
4. **`loadTierPromptWithFallback()`** - Prompt loading
5. **`stripSection()`** - String manipulation

**Action:** Extract to `packages/cli/src/features/context/utils/promptUtils.ts`

---

### Type Definitions (Lines 118-274) - ~156 lines
Can be extracted to separate type files:

1. **`ToolCall`** - Tool call interface
2. **`ReasoningBlock`** - Reasoning interface
3. **`InferenceMetrics`** - Metrics interface
4. **`Message`** - Message interface
5. **`ChatState`** - State interface
6. **`MenuOption`** - Menu option interface
7. **`MenuState`** - Menu state interface
8. **`ChatContextValue`** - Context value interface
9. **`ChatProviderProps`** - Provider props interface

**Action:** Extract to `packages/cli/src/features/context/types/chatTypes.ts`

---

### Event Handlers (Inside ChatProvider) - ~200 lines
Large event handler functions that can be extracted:

1. **`handleMemoryWarning`** - Memory warning handler
2. **`handleCompressed`** - Compression handler
3. **`handleSummarizing`** - Summarizing handler
4. **`handleAutoSummary`** - Auto-summary handler
5. **`handleAutoSummaryFailed`** - Failed summary handler
6. **`handleContextWarningLow`** - Low context warning handler
7. **`handleSessionSaved`** - Session saved handler

**Action:** Extract to `packages/cli/src/features/context/handlers/contextEventHandlers.ts`

---

### Message Recording (Inside sendMessage) - ~50 lines
Session recording logic:

1. **`recordSessionMessage()`** - Already a callback, but could be simplified

**Action:** Keep as callback, but simplify usage

---

### Command Handling (Inside sendMessage) - ~80 lines
Command registry integration:

```typescript
if (commandRegistry.isCommand(content)) {
  // ~80 lines of command handling
}
```

**Action:** Extract to `packages/cli/src/features/context/handlers/commandHandler.ts`

---

### System Prompt Building (Inside sendMessage) - ~50 lines
Complex prompt construction logic:

```typescript
// Get system prompt and add tool support note if needed
let systemPrompt = contextActions.getSystemPrompt();
// ... 50 lines of prompt building
```

**Action:** Extract to `packages/cli/src/features/context/utils/systemPromptBuilder.ts`

---

### Agent Loop (Inside sendMessage) - ~400 lines
The massive agent loop with tool execution:

```typescript
// Agent Loop
const maxTurns = 5;
let turnCount = 0;
let stopLoop = false;

while (turnCount < maxTurns && !stopLoop) {
  // ~400 lines of agent logic
}
```

**Action:** Extract to `packages/cli/src/features/context/handlers/agentLoopHandler.ts`

---

### Tool Execution (Inside agent loop) - ~150 lines
Tool call handling and execution:

```typescript
if (toolCallReceived) {
  // ~150 lines of tool execution
}
```

**Action:** Extract to `packages/cli/src/features/context/handlers/toolExecutionHandler.ts`

---

## Proposed File Structure

```
packages/cli/src/features/context/
├── ChatContext.tsx                    # Main handler (< 500 lines)
├── types/
│   └── chatTypes.ts                   # All type definitions
├── utils/
│   ├── promptUtils.ts                 # Prompt helper functions
│   └── systemPromptBuilder.ts         # System prompt construction
└── handlers/
    ├── contextEventHandlers.ts        # Context manager event handlers
    ├── commandHandler.ts              # Command execution
    ├── agentLoopHandler.ts            # Agent loop logic
    └── toolExecutionHandler.ts        # Tool execution logic
```

---

## Refactoring Steps

### Phase 1: Extract Types (Low Risk)
1. Create `types/chatTypes.ts`
2. Move all interfaces
3. Update imports in ChatContext.tsx
4. Test build

**Estimated reduction:** ~156 lines

---

### Phase 2: Extract Utilities (Low Risk)
1. Create `utils/promptUtils.ts`
2. Move helper functions
3. Update imports
4. Test build

**Estimated reduction:** ~82 lines

---

### Phase 3: Extract Event Handlers (Medium Risk)
1. Create `handlers/contextEventHandlers.ts`
2. Move event handler functions
3. Create factory function that returns handlers with closures
4. Update ChatProvider to use factory
5. Test all context events

**Estimated reduction:** ~200 lines

---

### Phase 4: Extract System Prompt Builder (Medium Risk)
1. Create `utils/systemPromptBuilder.ts`
2. Move prompt building logic
3. Create `buildSystemPrompt()` function
4. Update sendMessage to use builder
5. Test with reasoning and non-reasoning models

**Estimated reduction:** ~50 lines

---

### Phase 5: Extract Command Handler (Medium Risk)
1. Create `handlers/commandHandler.ts`
2. Move command handling logic
3. Create `handleCommand()` function
4. Update sendMessage to use handler
5. Test all slash commands

**Estimated reduction:** ~80 lines

---

### Phase 6: Extract Agent Loop (High Risk)
1. Create `handlers/agentLoopHandler.ts`
2. Move agent loop logic
3. Create `runAgentLoop()` function with all dependencies
4. Update sendMessage to use handler
5. Extensive testing of multi-turn conversations

**Estimated reduction:** ~400 lines

---

### Phase 7: Extract Tool Execution (High Risk)
1. Create `handlers/toolExecutionHandler.ts`
2. Move tool execution logic
3. Create `executeToolCall()` function
4. Update agent loop to use handler
5. Test all tool calls

**Estimated reduction:** ~150 lines

---

## Total Estimated Reduction

- **Current:** 1404 lines
- **After refactoring:** ~286 lines (main handler)
- **Reduction:** ~1118 lines (80%)

---

## Testing Strategy

After each phase:
1. Run `npm run build` - ensure no build errors
2. Run `npm test` - ensure all 502 tests pass
3. Manual testing of affected features
4. Git commit with clear message

---

## Risks & Mitigation

### High Risk Areas:
1. **Agent Loop** - Complex state management, many dependencies
2. **Tool Execution** - Critical for functionality
3. **Event Handlers** - Closure dependencies

### Mitigation:
1. Extract in small, testable chunks
2. Keep comprehensive tests
3. Use TypeScript to catch errors early
4. Test manually after each phase
5. Git commit after each successful phase

---

## Priority Order

1. **Phase 1 (Types)** - Immediate, low risk
2. **Phase 2 (Utilities)** - Immediate, low risk
3. **Phase 3 (Event Handlers)** - High value, medium risk
4. **Phase 4 (System Prompt)** - Medium value, medium risk
5. **Phase 5 (Commands)** - Medium value, medium risk
6. **Phase 6 (Agent Loop)** - High value, high risk
7. **Phase 7 (Tool Execution)** - High value, high risk

---

## Notes

- Keep main ChatContext.tsx as the orchestrator
- All extracted modules should be pure functions or factories
- Maintain clear separation of concerns
- Document all extracted functions
- Keep backward compatibility
