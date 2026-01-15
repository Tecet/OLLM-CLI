# Memory System Guide

Complete guide to OLLM's cross-session memory system for persistent context.

## Table of Contents

- [Overview](#overview)
- [Memory Basics](#memory-basics)
- [Memory Operations](#memory-operations)
- [System Prompt Injection](#system-prompt-injection)
- [LLM-Initiated Memory](#llm-initiated-memory)
- [Memory Categories](#memory-categories)
- [Storage and Persistence](#storage-and-persistence)
- [Best Practices](#best-practices)

## Overview

OLLM's memory system allows you to store facts, preferences, and context that persist across sessions. This eliminates the need to repeat information and helps the LLM maintain continuity.

**Key features**:
- **Persistent storage**: Memories survive session restarts
- **Automatic injection**: Memories added to system prompt
- **Smart prioritization**: Recent and frequently-accessed memories prioritized
- **LLM integration**: LLM can store memories via tool calls
- **Categorization**: Organize memories by type (fact, preference, context)
- **Search**: Find memories by content

## Memory Basics

### What is a Memory?

A memory is a key-value pair with metadata:

```typescript
{
  key: "user_name",
  value: "Alice",
  category: "preference",
  createdAt: "2026-01-12T10:00:00Z",
  updatedAt: "2026-01-12T10:00:00Z",
  accessCount: 5,
  source: "user"
}
```

**Fields**:
- `key`: Unique identifier for the memory
- `value`: The stored information
- `category`: Type of memory (fact, preference, context)
- `createdAt`: When the memory was first created
- `updatedAt`: When the memory was last modified
- `accessCount`: How many times the memory has been accessed
- `source`: Who created the memory (user, llm, system)

### When to Use Memory

**Good use cases**:
- User preferences (coding style, language preferences)
- Project facts (database type, architecture decisions)
- Recurring context (team members, project goals)
- Important decisions and their rationale

**Not recommended**:
- Temporary session data (use regular context)
- Frequently changing information
- Large amounts of data (use files instead)

## Memory Operations

### Adding Memories

Store a new memory or update an existing one:

```bash
/memory add user_name Alice
/memory add preferred_language TypeScript
/memory add db_type "PostgreSQL with Prisma ORM"
```

**With categories**:
```bash
/memory add --preference code_style "Use arrow functions"
/memory add --fact project_auth "JWT-based authentication"
/memory add --context current_task "Refactoring auth module"
```

**Behavior**:
- Creates new memory if key doesn't exist
- Updates value if key already exists
- Default category is `fact`
- Source is marked as `user`

### Listing Memories

View all stored memories:

```bash
/memory list
```

**Example output**:
```
Memories (5):
  [preference] preferred_language: TypeScript
  [fact] project_db: PostgreSQL with Prisma ORM
  [fact] auth_method: JWT-based authentication
  [preference] code_style: Use arrow functions
  [context] current_task: Refactoring auth module
```

**Grouped by category**:
```
Preferences (2):
  preferred_language: TypeScript
  code_style: Use arrow functions

Facts (2):
  project_db: PostgreSQL with Prisma ORM
  auth_method: JWT-based authentication

Context (1):
  current_task: Refactoring auth module
```

### Recalling Memories

Retrieve a specific memory:

```bash
/memory recall user_name
```

**Output**:
```
user_name: Alice
Category: preference
Created: 2 days ago
Last accessed: 5 minutes ago
Access count: 12
```

**Behavior**:
- Returns the memory if it exists
- Increments access count
- Updates last accessed timestamp
- Returns null if memory doesn't exist

### Searching Memories

Find memories by content:

```bash
/memory search database
```

**Output**:
```
Found 2 memories matching "database":
  [fact] project_db: PostgreSQL with Prisma ORM
  [fact] db_migrations: Using Prisma Migrate
```

**Search behavior**:
- Searches both keys and values
- Case-insensitive
- Partial matches included
- Returns all matching memories

### Forgetting Memories

Remove a specific memory:

```bash
/memory forget db_type
```

**Output**:
```
Forgot memory: db_type
```

**Behavior**:
- Permanently removes the memory
- No confirmation prompt (use carefully)
- Cannot be undone

### Clearing All Memories

Remove all stored memories:

```bash
/memory clear
```

**Output**:
```
Clear all memories? This cannot be undone. [y/N] y
Cleared 5 memories.
```

**Behavior**:
- Prompts for confirmation
- Removes all memories permanently
- Cannot be undone

## System Prompt Injection

Memories are automatically injected into the system prompt at the start of each session.

### How It Works

1. **Session start**: Memory service loads all memories from disk
2. **Prioritization**: Memories sorted by access count and recency
3. **Budget check**: Memories added until token budget reached
4. **Formatting**: Memories formatted as key-value pairs
5. **Injection**: Added to system prompt as "Remembered Context" section

### Token Budget

Default budget: **500 tokens**

Configure in settings:

```yaml
memory:
  enabled: true
  tokenBudget: 500
```

**Budget behavior**:
- Memories added in priority order until budget exhausted
- Frequently accessed memories prioritized
- Recently accessed memories prioritized
- Older, rarely-used memories may be excluded

### Injection Format

Memories appear in the system prompt as:

```
## Remembered Context
- user_name: Alice
- preferred_language: TypeScript
- project_db: PostgreSQL with Prisma ORM
- auth_method: JWT-based authentication
- code_style: Use arrow functions
```

### Prioritization Algorithm

Memories are scored by:

1. **Access count** (weight: 0.7): More frequently accessed = higher priority
2. **Recency** (weight: 0.3): More recently accessed = higher priority

**Formula**:
```
score = (accessCount * 0.7) + (recencyScore * 0.3)
```

Where `recencyScore` is based on time since last access:
- Last hour: 1.0
- Last day: 0.8
- Last week: 0.6
- Last month: 0.4
- Older: 0.2

### Disabling Injection

Disable memory injection in settings:

```yaml
memory:
  enabled: false
```

Memories are still stored and accessible via commands, but not injected into system prompt.

## LLM-Initiated Memory

The LLM can store memories using the `remember` tool.

### How It Works

The LLM has access to a `remember` tool:

```typescript
{
  name: "remember",
  description: "Store important information for future sessions",
  parameters: {
    key: "string",
    value: "string",
    category: "fact | preference | context"
  }
}
```

### When LLMs Use Memory

The LLM may choose to remember:
- Important facts learned during conversation
- User preferences expressed in chat
- Decisions made and their rationale
- Project-specific information

**Example conversation**:
```
User: I prefer using async/await over .then() chains.