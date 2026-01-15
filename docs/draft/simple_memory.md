# Simple Memory System

OLLM CLI includes a lightweight memory system that persists facts, preferences, and context across chat sessions without requiring a full RAG setup.

---

## Overview

Simple Memory allows the LLM to "remember" things between sessions:

- **User preferences** — "I prefer TypeScript over JavaScript"
- **Project facts** — "This project uses PostgreSQL for the database"
- **Context** — "We decided to use the repository pattern"

Memories are stored locally in `~/.ollm/memory.json` and automatically injected into the system prompt.

---

## Storage Location

```
~/.ollm/
├── memory.json           # All memories
├── session-data/         # Chat sessions
└── config.yaml           # Configuration
```

---

## Memory Entry Structure

```json
{
  "memories": [
    {
      "key": "preferred-language",
      "value": "User prefers TypeScript over JavaScript",
      "category": "preference",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "accessCount": 5,
      "source": "user"
    },
    {
      "key": "project-database",
      "value": "This project uses PostgreSQL 15 with Prisma ORM",
      "category": "fact",
      "createdAt": "2024-01-14T09:00:00Z",
      "updatedAt": "2024-01-14T09:00:00Z",
      "accessCount": 12,
      "source": "llm"
    }
  ]
}
```

---

## Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `preference` | User preferences and style choices | Language, formatting, verbosity |
| `fact` | Project or codebase facts | Tech stack, architecture decisions |
| `context` | Conversation context to carry forward | Current task, recent decisions |

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/memory list` | Show all stored memories |
| `/memory add <key> <value>` | Add or update a memory |
| `/memory forget <key>` | Remove a specific memory |
| `/memory clear` | Clear all memories |
| `/memory search <query>` | Search memories |

### Examples

```
/memory add db-type We use PostgreSQL with Prisma
/memory add code-style Prefer functional components in React
/memory list
/memory forget db-type
```

---

## LLM Memory Tool

The LLM can store memories using the built-in `remember` tool:

```typescript
interface RememberParams {
  key: string;
  value: string;
  category: 'fact' | 'preference' | 'context';
}
```

**Example conversation:**

```
User: I always want you to use async/await instead of .then()
LLM: Got it! I'll remember that preference.
     [Calling remember tool: { key: "async-preference", value: "User prefers async/await over .then() chains", category: "preference" }]
     I've saved that preference and will use async/await in all future code.
```

---

## System Prompt Integration

Relevant memories are automatically injected into the system prompt:

```
## User Context (from memory)

- User prefers TypeScript over JavaScript
- This project uses PostgreSQL 15 with Prisma ORM
- User prefers async/await over .then() chains
```

### Token Budget

Memories are included up to a configurable token limit (default: 500 tokens). Most recent and frequently accessed memories are prioritized.

---

## Configuration

```yaml
# ~/.ollm/config.yaml

memory:
  enabled: true
  maxEntries: 100           # Maximum memories to store
  tokenBudget: 500          # Max tokens for system prompt injection
  autoCleanup: true         # Remove stale memories
  staleAfterDays: 30        # Consider memory stale after N days without access
```

---

## API Reference

### MemoryService

```typescript
interface MemoryService {
  // Add or update a memory
  remember(key: string, value: string, options?: RememberOptions): void;
  
  // Get a specific memory
  recall(key: string): MemoryEntry | null;
  
  // Search memories by query
  search(query: string): MemoryEntry[];
  
  // Remove a memory
  forget(key: string): void;
  
  // Get all memories
  listAll(): MemoryEntry[];
  
  // Clear all memories
  clearAll(): void;
  
  // Get memories for system prompt (respects token budget)
  getSystemPromptAddition(): string;
}

interface RememberOptions {
  category?: 'fact' | 'preference' | 'context';
  source?: 'user' | 'llm' | 'system';
}

interface MemoryEntry {
  key: string;
  value: string;
  category: 'fact' | 'preference' | 'context';
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  source: 'user' | 'llm' | 'system';
}
```

---

## Best Practices

1. **Use descriptive keys** — `preferred-test-framework` not `pref1`
2. **Keep values concise** — One fact per memory
3. **Use categories correctly** — Facts for project info, preferences for user choices
4. **Review periodically** — Use `/memory list` to audit stored memories
5. **Don't store secrets** — Never store API keys or passwords

---

## Limitations

- **Not a database** — For large knowledge bases, use codebase indexing (Stage 11)
- **No semantic search** — Basic text matching only
- **Local only** — Memories don't sync across machines
- **Token limited** — Only most relevant memories included in prompts

---

## Cross-References

- [Stage 07: Model Management](.dev/stages/stage-07-model-management.md#s07-t05-simple-memory-cross-session-context) — Implementation task
- [Stage 11: Intelligence Layer](.dev/stages/z_future_dev-12-intelligence-layer.md) — Codebase RAG for larger knowledge
