# Memory Service API

**Persistent Key-Value Storage**

---

## Overview

The Memory Service provides persistent storage with system prompt injection.

**File:** `packages/core/src/services/memoryService.ts`

---

## Constructor

```typescript
constructor(options?: MemoryOptions)
```

**Options:**
```typescript
interface MemoryOptions {
  file?: string;                    // Storage file path
  systemPromptBudget?: number;      // Token budget (default: 500)
  enabled?: boolean;                // Enable/disable (default: true)
}
```

---

## Methods

### remember()

Store a memory.

```typescript
async remember(
  key: string,
  value: string,
  options?: RememberOptions
): Promise<void>
```

**Options:**
```typescript
interface RememberOptions {
  category?: 'fact' | 'preference' | 'context';
  source?: 'user' | 'llm' | 'system';
}
```

**Example:**
```typescript
await memory.remember('user_name', 'Alice', {
  category: 'fact',
  source: 'user'
});
```

---

### recall()

Retrieve a memory.

```typescript
async recall(key: string): Promise<string | undefined>
```

**Example:**
```typescript
const name = await memory.recall('user_name');
console.log(`User name: ${name}`);
```

---

### search()

Search memories.

```typescript
async search(query: string): Promise<Memory[]>
```

**Example:**
```typescript
const results = await memory.search('project');
```

---

### forget()

Delete a memory.

```typescript
async forget(key: string): Promise<boolean>
```

---

### listAll()

List all memories.

```typescript
async listAll(): Promise<Memory[]>
```

---

### getSystemPromptAddition()

Get formatted memories for system prompt.

```typescript
async getSystemPromptAddition(budget: number): Promise<string>
```

**Example:**
```typescript
const addition = await memory.getSystemPromptAddition(500);
// Returns: "user_name: Alice\nproject: my-app\n..."
```

---

## See Also

- [Memory Guide](../memory/user-guide.md)
- [Configuration](../Models_configuration.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
