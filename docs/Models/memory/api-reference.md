# Memory System - API Reference

**Memory Data Structures and Operations**

---

## Memory Structure

```typescript
interface Memory {
  key: string;
  value: string;
  category: 'fact' | 'preference' | 'context';
  source: 'user' | 'llm' | 'system';
  accessCount: number;
  createdAt: Date;
  lastAccessedAt: Date;
}
```

---

## Operations

### Add Memory

```typescript
await memory.remember(key, value, {
  category: 'fact',
  source: 'user'
});
```

### Recall Memory

```typescript
const value = await memory.recall(key);
```

### Search Memories

```typescript
const results = await memory.search(query);
```

### List All

```typescript
const all = await memory.listAll();
```

### Delete Memory

```typescript
await memory.forget(key);
```

### Clear All

```typescript
await memory.clear();
```

---

## Priority Algorithm

**Formula:**
```
priority = (accessCount * 0.7) + (recency * 0.3)

where:
  recency = 1 - (daysSinceAccess / maxDays)
```

**Example:**
```
Memory A: 10 accesses, 1 day ago
  priority = (10 * 0.7) + (0.99 * 0.3) = 7.297

Memory B: 5 accesses, 30 days ago
  priority = (5 * 0.7) + (0.0 * 0.3) = 3.5

Memory A has higher priority
```

---

## System Prompt Format

```
key1: value1
key2: value2
key3: value3
```

**Example:**
```
user_name: Alice
preferred_language: TypeScript
project_name: my-web-app
```

---

## Storage Format

**File:** `~/.ollm/memory.json`

```json
{
  "memories": [
    {
      "key": "user_name",
      "value": "Alice",
      "category": "fact",
      "source": "user",
      "accessCount": 5,
      "createdAt": "2026-01-15T10:00:00Z",
      "lastAccessedAt": "2026-01-16T14:30:00Z"
    }
  ]
}
```

---

## See Also

- [User Guide](user-guide.md)
- [Memory Service API](../api/memory-service.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
