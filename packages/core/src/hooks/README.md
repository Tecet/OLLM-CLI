# Hook System

The hook system provides event-driven customization for OLLM CLI. Hooks are executable scripts that run at specific lifecycle events, allowing users and extensions to modify behavior without changing core code.

## Architecture

```
hooks/
├── types.ts              # Core interfaces and types
├── hookRegistry.ts       # Hook registration and storage (TODO)
├── hookPlanner.ts        # Hook execution planning (TODO)
├── hookRunner.ts         # Hook execution with timeout (TODO)
├── hookTranslator.ts     # JSON protocol conversion (TODO)
├── trustedHooks.ts       # Trust model and approval (TODO)
├── index.ts              # Public exports
└── __tests__/            # Tests
    ├── types.test.ts
    ├── property-test-example.test.ts
    └── test-helpers.ts   # Property-based test generators
```

## Core Concepts

### Hook Events

Hooks can be registered for the following lifecycle events:

- `session_start` - When a new session begins
- `session_end` - When a session ends
- `before_agent` - Before agent processes user input
- `after_agent` - After agent generates response
- `before_model` - Before calling the LLM
- `after_model` - After receiving LLM response
- `before_tool_selection` - Before selecting tools to use
- `before_tool` - Before executing a tool
- `after_tool` - After tool execution completes

### Hook Protocol

Hooks communicate via JSON over stdin/stdout:

**Input (stdin):**
```json
{
  "event": "before_model",
  "data": {
    "sessionId": "abc123",
    "model": "llama2",
    "messages": [...]
  }
}
```

**Output (stdout):**
```json
{
  "continue": true,
  "systemMessage": "Optional context to add",
  "data": {
    "customField": "value"
  }
}
```

### Trust Model

Hooks are subject to trust verification based on their source:

- **builtin**: Trusted by default (shipped with CLI)
- **user**: Trusted by default (from `~/.ollm/`)
- **workspace**: Requires approval (from `.ollm/`)
- **downloaded**: Requires approval (from extensions)

Approved hooks are tracked by SHA-256 hash. If a hook's content changes, re-approval is required.

## Testing

The hook system uses both unit tests and property-based tests:

- **Unit tests**: Specific examples and edge cases
- **Property tests**: Universal properties across all inputs (using fast-check)

All property tests run with minimum 100 iterations and are tagged with:
```
Feature: stage-05-hooks-extensions-mcp, Property N: [property text]
```

## Implementation Status

- [x] Core types and interfaces
- [x] Test infrastructure with fast-check
- [ ] Hook registry
- [ ] Hook planner
- [ ] Hook runner
- [ ] Hook translator
- [ ] Trust model

## Usage (Future)

```typescript
import { HookRegistry, HookRunner } from '@ollm/ollm-cli-core/hooks';

// Register a hook
const registry = new HookRegistry();
registry.registerHook('before_model', {
  id: 'my-hook',
  name: 'My Hook',
  command: 'node',
  args: ['hook.js'],
  source: 'user',
});

// Execute hooks for an event
const runner = new HookRunner();
const hooks = registry.getHooksForEvent('before_model');
const results = await runner.executeHooks(hooks, input);
```

## Requirements

See `.kiro/specs/stage-05-hooks-extensions-mcp/requirements.md` for detailed requirements.
