# Model Routing

**Intelligent Model Selection**

---

## Overview

The Model Routing system automatically selects the best model for your task based on profiles, capabilities, and preferences.

### Key Features

- **4 Built-in Profiles:** Fast, General, Code, Creative
- **Automatic Selection:** Choose best model based on task
- **Preferred Families:** Prioritize specific model families
- **Fallback Chains:** Graceful degradation if preferred unavailable
- **Manual Override:** Force specific model when needed

---

## Quick Start

### Enable Routing

```yaml
# ~/.ollm/config.yaml
routing:
  profile: general
  preferred_families:
    - llama
    - mistral
```

### Use Routing

```bash
# Routing happens automatically
# Model selected based on profile and preferences
```

### Override Routing

```bash
# Force specific model
/model use llama3.1:8b
```

---

## Profiles

### Fast Profile
- **Purpose:** Quick responses
- **Models:** Smaller, faster models (< 7B parameters)
- **Use Cases:** Simple queries, quick answers

### General Profile
- **Purpose:** Balanced performance
- **Models:** Medium-sized models (7B-13B parameters)
- **Use Cases:** Most tasks, default choice

### Code Profile
- **Purpose:** Programming tasks
- **Models:** Code-specialized models
- **Use Cases:** Code generation, review, debugging

### Creative Profile
- **Purpose:** Creative writing
- **Models:** Larger models (13B+ parameters)
- **Use Cases:** Stories, articles, creative content

---

## How It Works

```
1. Determine Task Profile
   ↓
2. Query Available Models
   ↓
3. Filter by Requirements
   - Context window
   - Capabilities
   ↓
4. Score by Preferences
   - Preferred families
   - Model size
   ↓
5. Select Highest Scoring
   ↓
6. Fall Back if Unavailable
```

---

## Documentation

- **[User Guide](user-guide.md)** - Using routing
- **[Development Guide](development-guide.md)** - Creating custom profiles
- **[Profiles Reference](profiles-reference.md)** - Built-in profiles
- **[API Reference](../api/model-router.md)** - Router API

---

## See Also

- [Getting Started](../getting-started.md)
- [Configuration](../Models_configuration.md)
- [Commands Reference](../Models_commands.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
