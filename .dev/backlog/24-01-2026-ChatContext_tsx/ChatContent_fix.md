# Design Guide: React Context Refactoring Pattern

## Purpose

This document captures the design principles and patterns used to refactor large React context providers into maintainable, testable modules.

## Problem Pattern

Large context providers (>1000 lines) that mix multiple concerns become unmaintainable:

- Hard to understand data flow
- Difficult to test
- Prone to bugs
- Slow to modify
- Circular dependency risks

## Solution Pattern: Modular Context Architecture

### Core Principle

**Single Responsibility Per Module** - Each file should have one clear purpose.

### Architecture Layers

```
┌─────────────────────────────────────┐
│         Public API (index.ts)       │
│  - Clean exports                    │
│  - Hide implementation              │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      Provider (ChatProvider.tsx)    │
│  - Orchestration only               │
│  - Combines hooks                   │
│  - Provides context value           │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│         Hooks Layer                 │
│  - State management                 │
│  - Side effects                     │
│  - Business logic                   │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│       Utilities Layer               │
│  - Pure functions                   │
│  - Helpers                          │
│  - No state                         │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│        Types Layer                  │
│  - Interfaces                       │
│  - Type definitions                 │
│  - No implementation                │
└─────────────────────────────────────┘
```

## File Organization Pattern

### 1. Types File (types.ts)

**Purpose:** All TypeScript definitions
**Rules:**

- No implementation code
- Only interfaces, types, enums
- Export everything
- No imports except from external types

**Example:**

```typescript
// types.ts
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ChatState {
  messages: Message[];
  streaming: boolean;
  statusMessage?: string;
}

export interface ChatContextValue {
  // ... context value shape
}
```

### 2. Provider File (Provider.tsx)

**Purpose:** Orchestrate hooks and provide context
**Rules:**

- Import all hooks
- Combine hook results
- Create context value
- No business logic
- Only composition

**Example:**

```typescript
// ChatProvider.tsx
export function ChatProvider({ children }: Props) {
  // Combine all hooks
  const chatState = useChatState();
  const menuSystem = useMenuSystem();
  const scrollManager = useScrollManager();
  const sessionRecording = useSessionRecording(chatState.messages);
  const contextEvents = useContextEvents({ /* ... */ });
  const chatNetwork = useChatNetwork({ /* ... */ });

  // Compose context value
  const value: ChatContextValue = {
    ...chatState,
    ...menuSystem,
    ...scrollManager,
    ...sessionRecording,
    ...contextEvents,
    ...chatNetwork,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}
```

### 3. Hook Files (hooks/\*.ts)

**Purpose:** Encapsulate specific concerns
**Rules:**

- One concern per hook
- Return only what's needed
- Accept dependencies as parameters
- No global state access
- Testable in isolation

**Example:**

```typescript
// hooks/useChatState.ts
export function useChatState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>();

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  return {
    messages,
    streaming,
    statusMessage,
    addMessage,
    setStreaming,
    setStatusMessage,
  };
}
```

### 4. Utility Files (utils/\*.ts)

**Purpose:** Pure helper functions
**Rules:**

- No React hooks
- No state
- Pure functions only
- Easy to test
- Reusable

**Example:**

```typescript
// utils/promptUtils.ts
export function processPrompt(prompt: string, context: string): string {
  return `${context}\n\n${prompt}`;
}

export function formatMessage(message: Message): string {
  return `[${message.role}] ${message.content}`;
}
```

### 5. Index File (index.ts)

**Purpose:** Public API definition
**Rules:**

- Export only public interface
- Hide implementation details
- Re-export from modules
- Clean, minimal

**Example:**

```typescript
// index.ts
export { ChatProvider, useChat } from './ChatProvider';
export type { Message, ChatState, ChatContextValue } from './types';
```

## Hook Design Patterns

### Pattern 1: State Hook

**When:** Managing local state
**Structure:**

```typescript
export function useFeatureState() {
  const [state, setState] = useState(initialState);

  const operations = useMemo(
    () => ({
      update: (value) => setState(value),
      reset: () => setState(initialState),
    }),
    []
  );

  return { state, ...operations };
}
```

### Pattern 2: Effect Hook

**When:** Side effects and subscriptions
**Structure:**

```typescript
export function useFeatureEffects(dependencies) {
  useEffect(() => {
    // Setup
    const subscription = subscribe();

    // Cleanup
    return () => subscription.unsubscribe();
  }, [dependencies]);
}
```

### Pattern 3: Event Handler Hook

**When:** Event listeners and callbacks
**Structure:**

```typescript
export function useFeatureEvents({ onEvent, dependency }) {
  useEffect(() => {
    const handler = (data) => {
      // Process event
      onEvent(data);
    };

    eventEmitter.on('event', handler);
    return () => eventEmitter.off('event', handler);
  }, [onEvent, dependency]);
}
```

### Pattern 4: Network Hook

**When:** API calls and async operations
**Structure:**

```typescript
export function useFeatureNetwork({ onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (params) => {
      setLoading(true);
      try {
        const result = await api.call(params);
        onSuccess(result);
      } catch (error) {
        onError(error);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, onError]
  );

  return { execute, loading };
}
```

## Dependency Management

### Rule 1: Explicit Dependencies

Pass dependencies as parameters, don't access globals:

```typescript
// ❌ Bad - accesses global context
function useFeature() {
  const context = useContext(SomeContext);
  // ...
}

// ✅ Good - receives dependencies
function useFeature(contextValue: ContextValue) {
  // ...
}
```

### Rule 2: Dependency Injection

Provider injects dependencies into hooks:

```typescript
// Provider.tsx
const chatState = useChatState();
const network = useChatNetwork({
  addMessage: chatState.addMessage, // Inject dependency
  setStreaming: chatState.setStreaming,
});
```

### Rule 3: Avoid Circular Dependencies

```
✅ Allowed:
Provider → Hook A → Utility
Provider → Hook B → Utility

❌ Forbidden:
Hook A → Hook B → Hook A
```

## Testing Strategy

### Unit Test Hooks

```typescript
// useChatState.test.ts
import { renderHook, act } from '@testing-library/react';
import { useChatState } from './useChatState';

test('adds message', () => {
  const { result } = renderHook(() => useChatState());

  act(() => {
    result.current.addMessage({
      role: 'user',
      content: 'Hello',
    });
  });

  expect(result.current.messages).toHaveLength(1);
  expect(result.current.messages[0].content).toBe('Hello');
});
```

### Integration Test Provider

```typescript
// ChatProvider.test.tsx
import { render, screen } from '@testing-library/react';
import { ChatProvider, useChat } from './';

function TestComponent() {
  const { messages, addMessage } = useChat();
  return (
    <div>
      <button onClick={() => addMessage({ role: 'user', content: 'Test' })}>
        Add
      </button>
      <div>{messages.length} messages</div>
    </div>
  );
}

test('provider works', () => {
  render(
    <ChatProvider>
      <TestComponent />
    </ChatProvider>
  );

  fireEvent.click(screen.getByText('Add'));
  expect(screen.getByText('1 messages')).toBeInTheDocument();
});
```

## Migration Checklist

When refactoring a large context:

### Phase 1: Analysis

- [ ] Identify all concerns in the file
- [ ] Map dependencies between concerns
- [ ] List all exports (public API)
- [ ] Document current behavior

### Phase 2: Extraction

- [ ] Create types.ts with all interfaces
- [ ] Extract pure utilities to utils/
- [ ] Create hook files for each concern
- [ ] Keep original file as backup

### Phase 3: Integration

- [ ] Create new Provider component
- [ ] Wire up all hooks
- [ ] Verify context value shape matches
- [ ] Update imports in consuming components

### Phase 4: Verification

- [ ] Run TypeScript compiler
- [ ] Run linter
- [ ] Run all tests
- [ ] Manual testing
- [ ] Performance check

### Phase 5: Cleanup

- [ ] Remove old file
- [ ] Update documentation
- [ ] Add new tests
- [ ] Code review

## Common Pitfalls

### ❌ Pitfall 1: Too Many Small Files

Don't create a file for every function. Group related functionality.

### ❌ Pitfall 2: Shared State Between Hooks

Hooks should not share state directly. Pass through provider.

### ❌ Pitfall 3: Circular Dependencies

Always maintain unidirectional data flow.

### ❌ Pitfall 4: Breaking Public API

Keep the same exports and context value shape.

### ❌ Pitfall 5: Over-Engineering

Don't split if the file is <300 lines and has single responsibility.

## When to Apply This Pattern

### ✅ Apply When:

- File >500 lines
- Multiple concerns mixed
- Hard to test
- Frequent merge conflicts
- Difficult to understand

### ❌ Don't Apply When:

- File <300 lines
- Single clear responsibility
- Already well-tested
- No maintenance issues
- Simple, linear logic

## Success Metrics

### Code Quality

- Cyclomatic complexity <10 per module
- Maintainability index >70
- Test coverage >80%

### Developer Experience

- File loads <1s in editor
- Easy to locate functionality
- Clear dependencies
- Fast to modify

### Maintenance

- Fewer bugs
- Faster feature additions
- Easier code reviews
- Better onboarding

## Related Patterns

- **Custom Hooks Pattern** - React documentation
- **Composition Pattern** - React patterns
- **Dependency Injection** - Design patterns
- **Single Responsibility Principle** - SOLID principles

## References

- React Hooks Documentation
- Clean Code by Robert Martin
- Refactoring by Martin Fowler
- React Patterns by Kent C. Dodds
