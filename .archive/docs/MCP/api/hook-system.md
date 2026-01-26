# Hook System API Reference

**HookRegistry Class API Documentation**

---

## Overview

The `HookRegistry` class manages hook registration and execution.

---

## Getting Instance

```typescript
import { HookRegistry } from '@ollm/ollm-cli-core';

const registry = HookRegistry.getInstance();
```

---

## Methods

### register()

Register a new hook.

```typescript
async register(config: HookConfig): Promise<void>
```

**Parameters:**
```typescript
interface HookConfig {
  name: string;
  event: HookEvent;
  command: string;
  args?: string[];
  trustLevel: 'trusted' | 'workspace' | 'downloaded';
  enabled?: boolean;
}
```

**Example:**
```typescript
await registry.register({
  name: 'format-on-save',
  event: 'on-file-change',
  command: 'prettier',
  args: ['--write', '{file}'],
  trustLevel: 'workspace'
});
```

### executeHooks()

Execute hooks for an event.

```typescript
async executeHooks(event: HookEvent, context: any): Promise<HookResult[]>
```

**Returns:**
```typescript
interface HookResult {
  hook: string;
  allow: boolean;
  message?: string;
  metadata?: any;
}
```

**Example:**
```typescript
const results = await registry.executeHooks('pre-tool-call', {
  tool: 'read-file',
  args: { path: 'test.txt' }
});

for (const result of results) {
  if (!result.allow) {
    console.log(`Hook ${result.hook} blocked: ${result.message}`);
  }
}
```

### listHooks()

List all registered hooks.

```typescript
listHooks(): Hook[]
```

**Returns:**
```typescript
interface Hook {
  name: string;
  event: HookEvent;
  command: string;
  trustLevel: string;
  enabled: boolean;
}
```

### enable()

Enable a hook.

```typescript
enable(name: string): void
```

### disable()

Disable a hook.

```typescript
disable(name: string): void
```

### remove()

Remove a hook.

```typescript
remove(name: string): void
```

### trust()

Trust a hook.

```typescript
trust(name: string): void
```

### untrust()

Untrust a hook.

```typescript
untrust(name: string): void
```

---

## Events

```typescript
registry.on('hook-registered', (hook) => {
  console.log('Hook registered:', hook.name);
});

registry.on('hook-executed', (hook, result) => {
  console.log('Hook executed:', hook.name, result);
});

registry.on('hook-failed', (hook, error) => {
  console.error('Hook failed:', hook.name, error);
});
```

---

## Example Usage

```typescript
import { HookRegistry } from '@ollm/ollm-cli-core';

const registry = HookRegistry.getInstance();

// Register hook
await registry.register({
  name: 'safety-check',
  event: 'pre-tool-call',
  command: './hooks/safety-check.sh',
  trustLevel: 'workspace'
});

// Execute hooks
const results = await registry.executeHooks('pre-tool-call', {
  tool: 'shell',
  args: { command: 'ls -la' }
});

// Check results
const blocked = results.some(r => !r.allow);
if (blocked) {
  console.log('Operation blocked by hook');
}

// List hooks
const hooks = registry.listHooks();
console.log('Registered hooks:', hooks.length);
```

---

## Further Reading

- [API Overview](README.md)
- [MCP Client API](mcp-client.md)
- [Extension Manager API](extension-manager.md)
- [Hook System Overview](../hooks/README.md)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0
