# ChatContext - React Context Provider

**Last Updated:** January 27, 2026
**Status:** ✅ Production Ready
**Location:** `packages/cli/src/features/context/`

---

## Overview

ChatContext is the main React context provider for chat functionality in the OLLM CLI. It manages chat state, message handling, and orchestrates communication between the UI and core business logic.

**Current Size:** 578 lines (reduced from 1404 lines)

---

## Architecture

### File Structure
```
packages/cli/src/features/context/
├── ChatContext.tsx (578 lines) - Main provider
├── types/
│   └── chatTypes.ts - Type definitions
├── utils/
│   ├── promptUtils.ts - Helper functions
│   └── systemPromptBuilder.ts - Prompt building
└── handlers/
    ├── contextEventHandlers.ts - Event handling
    ├── commandHandler.ts - Command execution
    └── agentLoopHandler.ts - Agent loop logic
```

### Separation of Concerns

**ChatContext.tsx (React Orchestration)**
- React component structure
- State management (useState, useRef, useEffect)
- Context provider setup
- UI integration
- Callback coordination

**handlers/ (Business Logic)**
- Event handling (compression, summarization, warnings)
- Command execution (slash commands, exit handling)
- Agent loop (multi-turn conversations, tool execution)

**utils/ (Pure Functions)**
- Prompt utilities (tier resolution, mode conversion)
- System prompt building (reasoning models, tool support)

**types/ (Type Definitions)**
- All TypeScript interfaces
- Maintained backward compatibility

---

## Key Responsibilities

### What ChatContext DOES:
✅ Manage chat messages (add, update, display)
✅ Handle user input and commands
✅ Coordinate with context manager
✅ Manage UI state (streaming, waiting, menus)
✅ Integrate with service container
✅ Provide chat API to components

### What ChatContext DOES NOT Do:
❌ Calculate context sizes (ContextSizeCalculator)
❌ Manage VRAM (GPUProvider)
❌ Build prompts (PromptOrchestrator)
❌ Execute tools directly (ToolRegistry)
❌ Persist settings (SettingsService)

---

## State Management

### Messages
```typescript
const [messages, setMessages] = useState<Message[]>([]);
```
- Stores all chat messages
- Includes user, assistant, system, and tool messages
- Each message has: id, role, content, timestamp, optional metadata

### UI State
```typescript
const [streaming, setStreaming] = useState(false);
const [waitingForResponse, setWaitingForResponse] = useState(false);
const [currentInput, setCurrentInput] = useState('');
const [statusMessage, setStatusMessage] = useState<string | undefined>();
```

### Refs (Persistent State)
```typescript
assistantMessageIdRef - Current assistant message ID
recordingSessionIdRef - Session recording ID
compressionOccurredRef - Compression flag for retry
compressionRetryCountRef - Retry counter
lastUserMessageRef - Last user message for retry
inflightTokenAccumulatorRef - Token tracking
inflightFlushTimerRef - Token flush timer
```

---

## Event Handlers

### Context Manager Events
Handled by `contextEventHandlers.ts`:

- **memory-warning** - Shows warning when context is filling up
- **compressed** - Displays summary after compression
- **summarizing** - Shows progress during summarization
- **auto-summary-created** - Displays completed summary
- **auto-summary-failed** - Shows error message
- **context-warning-low** - Warning at 70% capacity
- **session_saved** - Confirmation when session saved

### Factory Pattern
```typescript
const handlers = createContextEventHandlers({
  addMessage,
  setStatusMessage,
  contextActions,
  contextManagerState,
  compressionOccurredRef,
  compressionRetryCountRef,
  waitingForResumeRef,
});

const cleanup = registerContextEventHandlers(contextActions, handlers);
```

---

## Command Handling

### Slash Commands
Handled by `commandHandler.ts`:

```typescript
if (commandRegistry.isCommand(content)) {
  await handleCommand(content, {
    addMessage,
    setLaunchScreenVisible,
    clearChat,
    provider,
    currentModel,
  });
  return;
}
```

### Special Actions
- **show-launch-screen** - Opens model selection
- **clear-chat** - Clears all messages
- **exit** - Unloads model and exits

---

## Agent Loop

### Multi-Turn Conversations
Handled by `agentLoopHandler.ts`:

```typescript
const loopResult = await runAgentLoop({
  addMessage,
  setMessages,
  contextActions,
  sendToLLM,
  cancelRequest,
  currentModel,
  provider,
  serviceContainer,
  toolSchemas,
  systemPrompt,
  recordSessionMessage,
  // ... refs and other dependencies
});
```

### Loop Components
1. **History Preparation** - Converts context to LLM format
2. **Model Change Detection** - Handles mid-loop model switches
3. **LLM Streaming** - Callbacks for text, errors, completion
4. **Reasoning Parser** - Fallback for `<think>` tags
5. **Token Tracking** - Inflight token reporting
6. **Compression Retry** - Handles mid-generation compression
7. **Tool Execution** - Executes tool calls
8. **Hook Events** - Emits before/after events

### Streaming Callbacks
- **onText** - Updates message content, parses reasoning
- **onError** - Displays error, stops loop
- **onComplete** - Updates metrics, collapses reasoning
- **onToolCall** - Receives tool call from LLM
- **onThinking** - Native thinking events (primary method)

---

## Reasoning Support

### Reasoning Models
Models with `thinking_enabled: true` get simplified prompts:

```typescript
if (isReasoningModel) {
  systemPrompt = `You are a helpful AI assistant for developers...
  
  Focus your thinking on the user's actual question, not on these instructions.`;
}
```

### Reasoning Display
- **Primary:** Native `thinking` events from Ollama
- **Fallback:** Parse `<think>` tags from text stream
- **Auto-collapse:** Reasoning box collapses when complete
- **Manual expand:** User can expand with keyboard navigation

### Thinking in Context
By default, thinking is **excluded** from context:
- Saves context space
- Only final response goes to context
- Optional: `includeThinkingInContext` setting adds brief summary

---

## Tool Execution

### Tool Schema Preparation
```typescript
const supportsTools = modelSupportsTools(currentModel);

if (supportsTools) {
  const toolRegistry = serviceContainer?.getToolRegistry();
  const modeManager = contextActions.getModeManager();
  
  // Combined filtering (user prefs + mode permissions)
  toolSchemas = toolRegistry.getFunctionSchemasForMode(
    currentMode, 
    modeManager
  );
}
```

### Tool Call Flow
1. LLM emits tool call via `onToolCall` callback
2. Agent loop receives tool call
3. Verify tool permission (prevent hallucinated calls)
4. Execute tool via registry
5. Add result to context
6. Continue loop for next turn

---

## System Prompt Building

### Prompt Construction
```typescript
const systemPrompt = buildSystemPrompt({
  basePrompt: contextActions.getSystemPrompt(),
  tierPrompt: loadTierPromptWithFallback(mode, tier),
  modelProfile: profileManager.findProfile(currentModel),
  supportsTools,
  injectFocusedFiles: injectFocusedFilesIntoPrompt,
});
```

### Components
- **Base Prompt** - From PromptOrchestrator
- **Tier Prompt** - Context-size specific instructions
- **Model Profile** - Reasoning model detection
- **Tool Support** - Notes about function calling
- **Focused Files** - Injected file context

---

## Message Recording

### Session Recording
```typescript
const recordSessionMessage = useCallback(async (role, text) => {
  const recordingService = serviceContainer.getChatRecordingService();
  
  if (!recordingSessionIdRef.current) {
    recordingSessionIdRef.current = await recordingService.createSession(
      currentModel,
      provider?.name
    );
  }
  
  await recordingService.recordMessage(recordingSessionIdRef.current, {
    role,
    parts: [{ type: 'text', text }],
    timestamp: new Date().toISOString()
  });
}, [serviceContainer, currentModel, provider]);
```

---

## Context API

### Exposed Methods
```typescript
interface ChatContextValue {
  state: ChatState;
  sendMessage: (content: string) => Promise<void>;
  cancelGeneration: () => void;
  clearChat: () => void;
  editMessage: (id: string, content: string) => void;
  setCurrentInput: (input: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setStreaming: (streaming: boolean) => void;
  setWaitingForResponse: (waiting: boolean) => void;
  setStatusMessage: (message: string | undefined) => void;
  contextUsage: { currentTokens: number; maxTokens: number };
  // ... menu and scroll methods
}
```

### Usage
```typescript
const { sendMessage, clearChat, state } = useChat();
```

---

## Design Patterns

### 1. Factory Pattern
Event handlers created with dependency injection:
```typescript
const handlers = createContextEventHandlers(dependencies);
```

### 2. Dependency Injection
All handlers accept dependencies as parameters:
```typescript
await handleCommand(content, { addMessage, clearChat, ... });
```

### 3. Single Responsibility
Each module has one clear purpose:
- `contextEventHandlers.ts` - Event handling only
- `commandHandler.ts` - Command execution only
- `agentLoopHandler.ts` - Agent loop only

### 4. Separation of Concerns
- UI logic in ChatContext
- Business logic in handlers
- Utilities in utils
- Types in types

---

## Testing

### Test Coverage
- ✅ All 502 tests passing
- ✅ No regressions after refactoring
- ✅ Build successful
- ✅ No TypeScript errors

### Manual Testing
- ✅ Message sending and receiving
- ✅ Tool execution
- ✅ Reasoning display
- ✅ Command handling
- ✅ Context compression
- ✅ Session recording

---

## Performance

### Metrics
- **Build Time:** ~5.5s (no change)
- **Test Time:** ~5.7s (no change)
- **Bundle Size:** Minimal impact
- **Runtime:** No measurable difference

### Optimizations
- Batch token reporting (500ms intervals)
- Lazy loading of handlers
- Memoized callbacks
- Efficient state updates

---

## Known Issues

None. All functionality working as expected.

---

## Future Improvements

### Optional Enhancements
1. **Extract Mode Switching** (~50 lines)
   - Create `handlers/modeSwitchingHandler.ts`
   - Handle mode analysis and switching

2. **Extract Tool Schema Preparation** (~30 lines)
   - Create `utils/toolSchemaBuilder.ts`
   - Handle tool registry and filtering

3. **Extract Menu State** (~20 lines)
   - Create `hooks/useMenuState.ts`
   - Custom hook for menu logic

**Recommendation:** Current state is optimal. Further extraction has diminishing returns.

---

## Related Documentation

- [Context Management](./dev_ContextManagement.md)
- [Tool Execution](./dev_ToolExecution.md)
- [Model Reasoning](./dev_ModelReasoning.md)
- [Prompt System](./dev_PromptSystem.md)

---

## Refactoring History

**January 27, 2026** - Major refactoring
- Reduced from 1404 to 578 lines (58.8% reduction)
- Extracted types, utilities, and handlers
- Improved maintainability and testability
- No functionality changes
- All tests passing

See: `.dev/backlog/27-01-2026-Refactoring/ChatContext_Refactor/AUDIT.md`

---

**Status:** ✅ Production Ready
**Maintainability:** High
**Test Coverage:** Complete
**Documentation:** Up to date
