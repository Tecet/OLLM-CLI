# Project Profiles

**Auto-Configure for Project Type**

---

## Overview

Project Profiles automatically detect your project type and apply appropriate settings. No manual configuration needed - the system recognizes TypeScript, Python, Rust, Go, and Documentation projects.

### Key Features

- **Auto-Detection:** Recognizes project type from files
- **5 Built-in Profiles:** TypeScript, Python, Rust, Go, Documentation
- **Automatic Configuration:** Model, system prompt, tools
- **Manual Override:** Force specific profile
- **Project Initialization:** Create `.ollm/project.yaml`

---

## Quick Start

### Auto-Detect Project

```bash
/project detect
# Detected: typescript
```

### Use Profile

```bash
/project use typescript
```

### Initialize Project

```bash
/project init
# Creates .ollm/project.yaml
```

---

## How It Works

```
1. Check for Detection Files
   - package.json → TypeScript
   - requirements.txt → Python
   - Cargo.toml → Rust
   - go.mod → Go
   - docs/ → Documentation
   ↓
2. Load Profile Settings
   - Model selection
   - System prompt
   - Tool restrictions
   ↓
3. Apply Configuration
   - Override global settings
   - Project-specific behavior
```

---

## Built-in Profiles

### TypeScript
- **Detection:** package.json with typescript
- **Model:** Code-specialized
- **Focus:** Type safety, modern patterns

### Python
- **Detection:** requirements.txt or setup.py
- **Model:** Python-specialized
- **Focus:** Pythonic code, best practices

### Rust
- **Detection:** Cargo.toml
- **Model:** Systems programming
- **Focus:** Safety, performance

### Go
- **Detection:** go.mod
- **Model:** Go-specialized
- **Focus:** Simplicity, concurrency

### Documentation
- **Detection:** docs/ directory
- **Model:** Writing-optimized
- **Focus:** Clarity, structure

---

## Documentation

- **[User Guide](user-guide.md)** - Using profiles
- **[Built-in Profiles](built-in-profiles.md)** - Profile reference
- **[Service API](../api/project-profile-service.md)** - Service documentation

---

## See Also

- [Getting Started](../getting-started.md)
- [Configuration](../Models_configuration.md)
- [Commands Reference](../Models_commands.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
