# Hook System

The hook system provides event-driven customization for OLLM CLI. Hooks are executable scripts that run at specific lifecycle events, allowing users and extensions to modify behavior without changing core code.

## Table of Contents

- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Hook Protocol](#hook-protocol)
- [Trust Model & Security](#trust-model--security)
- [Hook Development Guide](#hook-development-guide)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Examples](#examples)

## Architecture

```
hooks/
├── types.ts              # Core interfaces and types
├── hookRegistry.ts       # Hook registration and storage
├── hookPlanner.ts        # Hook execution planning
├── hookRunner.ts         # Hook execution with timeout
├── hookTranslator.ts     # JSON protocol conversion
├── trustedHooks.ts       # Trust model and approval
├── config.ts             # Configuration and validation
├── hookDebugger.ts       # Debugging and tracing
├── hookEventHandler.ts   # Event-to-hook bridge
├── messageBus.ts         # Event bus implementation
├── index.ts              # Public exports
└── __tests__/            # Tests
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Hook System                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │  MessageBus  │─────▶│ EventHandler │                     │
│  └──────────────┘      └──────┬───────┘                     │
│                               │                              │
│                               ▼                              │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │   Registry   │◀─────│   Planner    │                     │
│  └──────────────┘      └──────┬───────┘                     │
│                               │                              │
│                               ▼                              │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │ TrustedHooks │◀─────│    Runner    │                     │
│  └──────────────┘      └──────┬───────┘                     │
│                               │                              │
│                               ▼                              │
│                        ┌──────────────┐                     │
│                        │  Translator  │                     │
│                        └──────────────┘                     │
│                               │                              │
│                               ▼                              │
│                        [Hook Process]                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Event Emission**: `MessageBus.emit('before_model', data)`
2. **Event Handling**: EventHandler receives event → queries Registry
3. **Planning**: Planner orders hooks by source priority
4. **Trust Verification**: TrustedHooks checks approval status
5. **Execution**: Runner spawns process → Translator formats I/O
6. **Result Aggregation**: Runner collects outputs → returns summary

## Core Concepts

### Hook Events

Hooks can be registered for the following lifecycle events:

#### Session Events
- `session_start` - When a new session begins
- `session_end` - When a session ends

#### Agent Events
- `before_agent` - Before agent processes user input
- `after_agent` - After agent generates response

#### Model Events
- `before_model` - Before calling the LLM
- `after_model` - After receiving LLM response

#### Tool Events
- `before_tool_selection` - Before selecting tools to use
- `before_tool` - Before executing a tool
- `after_tool` - After tool execution completes

#### Context Events
- `pre_compress` - Before context compression
- `post_compress` - After context compression

#### General Events
- `notification` - General notification event

### Hook Sources

Hooks have different trust levels based on their source:

| Source | Location | Trust Level | Approval Required |
|--------|----------|-------------|-------------------|
| `builtin` | Shipped with CLI | Always trusted | No |
| `user` | `~/.ollm/hooks/` | Always trusted | No |
| `workspace` | `.ollm/hooks/` | Requires approval | Yes (unless `trustWorkspace` enabled) |
| `downloaded` | Extensions | Requires approval | Yes |
| `extension` | Extensions | Requires approval | Yes |

## Hook Protocol

Hooks communicate via JSON over stdin/stdout.

### Input Format (stdin)

```json
{
  "event": "before_model",
  "data": {
    "sessionId": "abc123",
    "model": "llama2",
    "messages": [
      { "role": "user", "content": "Hello" }
    ]
  }
}
```

### Output Format (stdout)

```json
{
  "continue": true,
  "systemMessage": "Optional context to add",
  "data": {
    "customField": "value"
  }
}
```

### Output Fields

- **continue** (required, boolean): Whether to continue with the operation
  - `true`: Proceed normally
  - `false`: Abort operation (no further hooks execute)
- **systemMessage** (optional, string): Message to add to conversation context
- **data** (optional, object): Additional data to pass to subsequent hooks
- **error** (optional, string): Error message if hook failed

### Event-Specific Data

Each event provides specific data fields:

#### session_start
```json
{
  "event": "session_start",
  "data": {
    "session_id": "abc123"
  }
}
```

#### before_model
```json
{
  "event": "before_model",
  "data": {
    "messages": [...],
    "model": "llama2"
  }
}
```

#### before_tool
```json
{
  "event": "before_tool",
  "data": {
    "tool_name": "read_file",
    "args": { "path": "file.txt" }
  }
}
```

## Trust Model & Security

### Trust Verification

The trust model ensures that only approved hooks can execute:

1. **Built-in hooks**: Always trusted (shipped with CLI)
2. **User hooks**: Always trusted (from `~/.ollm/`)
3. **Workspace hooks**: Require approval (unless `trustWorkspace` enabled)
4. **Downloaded hooks**: Always require approval

### Approval Process

1. Hook attempts to execute
2. TrustedHooks checks if hook is approved
3. If not approved, approval callback is invoked
4. User reviews hook and approves/denies
5. Approval is stored with SHA-256 hash
6. On subsequent executions, hash is verified
7. If hash doesn't match, re-approval is required

### Security Features

#### Command Validation
- Commands are validated to prevent shell injection
- Shell metacharacters are blocked: `; & | \` $ ( ) { } [ ] < >`
- Commands must be absolute paths or whitelisted

#### Whitelisted Commands
- `node` - Node.js runtime
- `python`, `python3` - Python interpreters
- `bash`, `sh` - Shell interpreters (use with caution)
- `npx` - Node package executor
- `uvx` - UV package executor

#### Execution Limits
- **Timeout**: 30 seconds (configurable)
- **Output size**: 1MB maximum
- **No shell execution**: Hooks run directly (no shell parsing)
- **Process isolation**: Each hook runs in separate process

#### Hash Verification
- SHA-256 hash computed from script content
- Hash stored with approval
- Hash verified on each execution
- Re-approval required if hash changes

### Security Best Practices

1. **Review workspace hooks carefully** before approving
2. **Never enable `trustWorkspace`** for untrusted workspaces
3. **Inspect hook scripts** before approval
4. **Monitor hook execution** for suspicious behavior
5. **Use absolute paths** for custom commands
6. **Avoid bash/sh hooks** unless necessary
7. **Limit hook permissions** to minimum required

## Hook Development Guide

### Creating a Hook

#### 1. Choose a Language

Hooks can be written in any language that can:
- Read JSON from stdin
- Write JSON to stdout
- Execute as a command

Common choices: Node.js, Python, Bash

#### 2. Implement Hook Protocol

**Node.js Example:**

```javascript
#!/usr/bin/env node

// Read input from stdin
let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse input
    const { event, data } = JSON.parse(input);
    
    // Process event
    if (event === 'before_model') {
      // Add custom logic here
      console.log('Model call intercepted:', data.model);
      
      // Return output
      const output = {
        continue: true,
        systemMessage: `Hook executed for model: ${data.model}`,
        data: {
          hookExecuted: true,
        },
      };
      
      process.stdout.write(JSON.stringify(output));
    } else {
      // Unknown event, continue
      process.stdout.write(JSON.stringify({ continue: true }));
    }
  } catch (error) {
    // Error handling
    process.stdout.write(JSON.stringify({
      continue: true,
      error: error.message,
    }));
  }
});
```

**Python Example:**

```python
#!/usr/bin/env python3

import sys
import json

def main():
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        event = input_data['event']
        data = input_data['data']
        
        # Process event
        if event == 'before_model':
            # Add custom logic here
            print(f"Model call intercepted: {data['model']}", file=sys.stderr)
            
            # Return output
            output = {
                'continue': True,
                'systemMessage': f"Hook executed for model: {data['model']}",
                'data': {
                    'hookExecuted': True,
                },
            }
            
            json.dump(output, sys.stdout)
        else:
            # Unknown event, continue
            json.dump({'continue': True}, sys.stdout)
    
    except Exception as e:
        # Error handling
        json.dump({
            'continue': True,
            'error': str(e),
        }, sys.stdout)

if __name__ == '__main__':
    main()
```

#### 3. Register the Hook

```typescript
import { HookRegistry } from '@ollm/ollm-cli-core/hooks';

const registry = new HookRegistry();

registry.registerHook('before_model', {
  id: 'log-model-calls',
  name: 'Log Model Calls',
  command: 'node',
  args: ['/path/to/hook.js'],
  source: 'user',
  sourcePath: '/path/to/hook.js',
});
```

#### 4. Test the Hook

```bash
# Test hook manually
echo '{"event":"before_model","data":{"model":"llama2"}}' | node hook.js
```

### Hook Templates

#### Logging Hook

```javascript
#!/usr/bin/env node

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const { event, data } = JSON.parse(input);
  
  // Log to file
  const fs = require('fs');
  fs.appendFileSync('/tmp/hook.log', `${event}: ${JSON.stringify(data)}\n`);
  
  // Continue
  process.stdout.write(JSON.stringify({ continue: true }));
});
```

#### Validation Hook

```javascript
#!/usr/bin/env node

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const { event, data } = JSON.parse(input);
  
  if (event === 'before_tool' && data.tool_name === 'shell') {
    // Block dangerous shell commands
    const command = data.args.command;
    if (command.includes('rm -rf')) {
      process.stdout.write(JSON.stringify({
        continue: false,
        systemMessage: 'Blocked dangerous command',
      }));
      return;
    }
  }
  
  // Allow
  process.stdout.write(JSON.stringify({ continue: true }));
});
```

#### Context Enhancement Hook

```javascript
#!/usr/bin/env node

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const { event, data } = JSON.parse(input);
  
  if (event === 'before_model') {
    // Add custom context
    process.stdout.write(JSON.stringify({
      continue: true,
      systemMessage: 'Current time: ' + new Date().toISOString(),
    }));
  } else {
    process.stdout.write(JSON.stringify({ continue: true }));
  }
});
```

## API Reference

### HookRegistry

```typescript
class HookRegistry {
  registerHook(event: HookEvent, hook: Hook): void;
  getHooksForEvent(event: HookEvent): Hook[];
  unregisterHook(hookId: string): boolean;
  getAllHooks(): Map<HookEvent, Hook[]>;
  clearEvent(event: HookEvent): void;
  clear(): void;
  getHookCount(): number;
  hasHook(hookId: string): boolean;
  getHook(hookId: string): Hook | undefined;
}
```

### HookRunner

```typescript
class HookRunner {
  constructor(timeout?: number, trustedHooks?: TrustedHooks, config?: Partial<HooksConfig>);
  setTimeout(ms: number): void;
  executeHook(hook: Hook, input: HookInput): Promise<HookOutput>;
  executeHooks(hooks: Hook[], input: HookInput): Promise<HookOutput[]>;
  executeHooksWithSummary(hooks: Hook[], input: HookInput): Promise<HookExecutionSummary>;
  executeHookWithMetadata(hook: Hook, input: HookInput): Promise<HookExecutionResult>;
}
```

### TrustedHooks

```typescript
class TrustedHooks {
  constructor(config: TrustedHooksConfig);
  isTrusted(hook: Hook): Promise<boolean>;
  requestApproval(hook: Hook): Promise<boolean>;
  storeApproval(hook: Hook, hash: string): Promise<void>;
  computeHash(hook: Hook): Promise<string>;
  load(): Promise<void>;
  save(): Promise<void>;
  getApprovals(): HookApproval[];
  removeApproval(sourcePath: string): Promise<boolean>;
  clearApprovals(): Promise<void>;
}
```

### HookPlanner

```typescript
class HookPlanner {
  constructor(registry: HookRegistry);
  planExecution(event: HookEvent, context: HookContext): HookExecutionPlan;
}
```

## Testing

### Unit Tests

```typescript
import { HookRegistry } from '@ollm/ollm-cli-core/hooks';

describe('HookRegistry', () => {
  it('should register hooks by event', () => {
    const registry = new HookRegistry();
    const hook = {
      id: 'test-hook',
      name: 'Test Hook',
      command: 'node',
      args: ['hook.js'],
      source: 'user' as const,
    };
    
    registry.registerHook('before_model', hook);
    
    const hooks = registry.getHooksForEvent('before_model');
    expect(hooks).toHaveLength(1);
    expect(hooks[0]).toEqual(hook);
  });
});
```

### Integration Tests

```typescript
import { HookRegistry, HookRunner, HookTranslator } from '@ollm/ollm-cli-core/hooks';

describe('Hook Execution Flow', () => {
  it('should execute hooks for emitted events', async () => {
    const registry = new HookRegistry();
    const runner = new HookRunner();
    const translator = new HookTranslator();
    
    // Register hook
    registry.registerHook('before_model', {
      id: 'test-hook',
      name: 'Test Hook',
      command: 'node',
      args: ['test-hook.js'],
      source: 'user',
    });
    
    // Execute hooks
    const hooks = registry.getHooksForEvent('before_model');
    const input = translator.toHookInput('before_model', { model: 'llama2' });
    const results = await runner.executeHooks(hooks, input);
    
    expect(results).toHaveLength(1);
    expect(results[0].continue).toBe(true);
  });
});
```

## Examples

### Example 1: Logging All Model Calls

```javascript
#!/usr/bin/env node
// Save as: ~/.ollm/hooks/log-model-calls.js

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const { event, data } = JSON.parse(input);
    
    if (event === 'before_model') {
      const logFile = path.join(process.env.HOME, '.ollm', 'model-calls.log');
      const logEntry = `${new Date().toISOString()} - Model: ${data.model}\n`;
      fs.appendFileSync(logFile, logEntry);
    }
    
    process.stdout.write(JSON.stringify({ continue: true }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      continue: true,
      error: error.message,
    }));
  }
});
```

### Example 2: Blocking Dangerous Commands

```javascript
#!/usr/bin/env node
// Save as: ~/.ollm/hooks/block-dangerous.js

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const { event, data } = JSON.parse(input);
    
    if (event === 'before_tool' && data.tool_name === 'shell') {
      const command = data.args.command;
      const dangerous = ['rm -rf /', 'dd if=', 'mkfs', ':(){:|:&};:'];
      
      for (const pattern of dangerous) {
        if (command.includes(pattern)) {
          process.stdout.write(JSON.stringify({
            continue: false,
            systemMessage: `Blocked dangerous command: ${pattern}`,
          }));
          return;
        }
      }
    }
    
    process.stdout.write(JSON.stringify({ continue: true }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      continue: true,
      error: error.message,
    }));
  }
});
```

### Example 3: Adding Custom Context

```python
#!/usr/bin/env python3
# Save as: ~/.ollm/hooks/add-context.py

import sys
import json
import os
from datetime import datetime

def main():
    try:
        input_data = json.load(sys.stdin)
        event = input_data['event']
        
        if event == 'before_model':
            # Add custom context
            context = f"""
Current time: {datetime.now().isoformat()}
Working directory: {os.getcwd()}
User: {os.environ.get('USER', 'unknown')}
"""
            
            output = {
                'continue': True,
                'systemMessage': context.strip(),
            }
            json.dump(output, sys.stdout)
        else:
            json.dump({'continue': True}, sys.stdout)
    
    except Exception as e:
        json.dump({
            'continue': True,
            'error': str(e),
        }, sys.stdout)

if __name__ == '__main__':
    main()
```

## Implementation Status

- [x] Core types and interfaces
- [x] Test infrastructure with fast-check
- [x] Hook registry
- [x] Hook planner
- [x] Hook runner
- [x] Hook translator
- [x] Trust model
- [x] Configuration management
- [x] Validation utilities
- [x] Debugging and tracing
- [x] Event bus
- [x] Event handler

## Future Enhancements

- [ ] Parallel hook execution
- [ ] Hook output caching
- [ ] Hook dependencies
- [ ] Hook priorities
- [ ] Hook marketplace
- [ ] Hook sandboxing
- [ ] Resource limits (CPU, memory)
- [ ] Hook metrics and monitoring
- [ ] Hook versioning
- [ ] Hook composition

## References

- Hook System Spec: `.kiro/specs/stage-05-hooks-extensions-mcp/`
- Security Audit: `.dev/audits/hook-system-audit.md`
- Hook Types: `packages/core/src/hooks/types.ts`
- Hook Configuration: `packages/core/src/hooks/config.ts`
