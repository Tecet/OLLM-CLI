# Memory System

**Persistent Cross-Session Memory**

---

## Overview

The Memory System provides persistent key-value storage that survives across sessions. Memories are automatically injected into the system prompt, giving the model context about you and your projects.

### Key Features

- **Persistent Storage:** Memories saved to `~/.ollm/memory.json`
- **System Prompt Injection:** Automatically included in conversations
- **Categorization:** Organize by fact, preference, or context
- **Source Tracking:** Know where memories came from
- **LLM Integration:** Model can remember things for you
- **Search:** Find memories by key or value

---

## Quick Start

### Remember Something

```bash
/memory add user_name Alice
/memory add preferred_language TypeScript --category preference
```

### Recall Memory

```bash
/memory recall user_name
# Returns: Alice
```

### Search Memories

```bash
/memory search project
# Returns all memories containing "project"
```

### List All Memories

```bash
/memory list
```

### Forget Memory

```bash
/memory forget old_preference
```

---

## How It Works

```
1. Store Memories
   ↓
2. Load on Startup
   ↓
3. Sort by Priority
   - Access count (70%)
   - Recency (30%)
   ↓
4. Inject into System Prompt
   - Within token budget (500 tokens default)
   ↓
5. Model Has Context
```

---

## Memory Categories

### Fact
- Objective information
- User details
- Project information

### Preference
- User preferences
- Style choices
- Tool preferences

### Context
- Current work
- Active tasks
- Temporary information

---

## Documentation

- **[User Guide](user-guide.md)** - Using memory
- **[API Reference](api-reference.md)** - Memory API
- **[Service API](../api/memory-service.md)** - Service documentation

---

## See Also

- [Getting Started](../getting-started.md)
- [Configuration](../Models_configuration.md)
- [Commands Reference](../Models_commands.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
