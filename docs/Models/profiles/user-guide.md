# Project Profiles - User Guide

**Using Auto-Configuration**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Auto-Detection](#auto-detection)
3. [Manual Selection](#manual-selection)
4. [Project Initialization](#project-initialization)
5. [Customization](#customization)
6. [Examples](#examples)

---

## Introduction

Project Profiles automatically configure OLLM for your project type. The system detects what you're working on and applies appropriate settings.

---

## Auto-Detection

### Enable Auto-Detection

```yaml
# ~/.ollm/config.yaml
project:
  auto_detect: true
```

### Detection Rules

**TypeScript:**
- File: `package.json`
- Contains: `"typescript"` dependency

**Python:**
- File: `requirements.txt` or `setup.py`

**Rust:**
- File: `Cargo.toml`

**Go:**
- File: `go.mod`

**Documentation:**
- Directory: `docs/`

### Check Detection

```bash
/project detect
# Output: Detected project type: typescript
```

---

## Manual Selection

### Force Profile

```yaml
# .ollm/config.yaml
project:
  profile: typescript
```

Or via command:
```bash
/project use typescript
```

### When to Use Manual

- Detection fails
- Multiple project types
- Custom requirements

---

## Project Initialization

### Create Project Config

```bash
/project init
```

**Creates:** `.ollm/project.yaml`

**Example:**
```yaml
name: my-project
type: typescript
version: 1.0.0

model: llama3.1:8b
system_prompt: |
  You are a TypeScript expert.
  Follow best practices.

tools:
  allowed:
    - read_file
    - write_file
    - shell
```

### Edit Project Config

```yaml
# .ollm/project.yaml
name: my-web-app
type: typescript

# Override model
model: codellama:13b

# Custom system prompt
system_prompt: |
  You are a React + TypeScript expert.
  Use functional components and hooks.
  Prioritize type safety.

# Tool restrictions
tools:
  allowed:
    - read_file
    - write_file
    - grep
    - glob
  denied:
    - web_fetch
```

---

## Customization

### Override Model

```yaml
# .ollm/project.yaml
model: your-preferred-model
```

### Custom System Prompt

```yaml
system_prompt: |
  Your custom instructions here.
  Multiple lines supported.
```

### Tool Restrictions

```yaml
tools:
  allowed:
    - read_file
    - write_file
  denied:
    - shell
    - web_fetch
```

### Routing Configuration

```yaml
routing:
  profile: code
  preferred_families:
    - codellama
    - qwen
```

---

## Examples

### Example 1: TypeScript Project

```yaml
# .ollm/project.yaml
name: my-web-app
type: typescript

model: llama3.1:8b
system_prompt: |
  You are a TypeScript + React expert.
  Use functional components with hooks.
  Follow TypeScript best practices.
  Prioritize type safety.

routing:
  profile: code
  preferred_families:
    - llama
    - qwen

tools:
  allowed:
    - read_file
    - write_file
    - shell
    - grep
    - glob
```

### Example 2: Python Project

```yaml
# .ollm/project.yaml
name: data-analysis
type: python

model: codellama:13b
system_prompt: |
  You are a Python expert specializing in data analysis.
  Use pandas, numpy, and matplotlib.
  Follow PEP 8 style guide.
  Write type hints.

routing:
  profile: code
  preferred_families:
    - codellama
    - deepseek-coder

tools:
  allowed:
    - read_file
    - write_file
    - shell
```

### Example 3: Documentation Project

```yaml
# .ollm/project.yaml
name: project-docs
type: documentation

model: llama3.1:70b
system_prompt: |
  You are a technical writer.
  Write clear, concise documentation.
  Use proper markdown formatting.
  Include examples.

routing:
  profile: creative
  preferred_families:
    - llama
    - mixtral

tools:
  allowed:
    - read_file
    - write_file
    - grep
  denied:
    - shell
```

---

## Best Practices

### 1. Let Auto-Detection Work

Most projects are detected correctly. Only override if needed.

### 2. Customize System Prompt

Tailor the prompt to your specific project:
```yaml
system_prompt: |
  Project: E-commerce platform
  Stack: React + TypeScript + Node.js
  Focus: Performance and security
```

### 3. Restrict Tools Appropriately

```yaml
# Development project
tools:
  allowed:
    - read_file
    - write_file
    - shell

# Documentation project
tools:
  allowed:
    - read_file
    - write_file
  denied:
    - shell
```

### 4. Version Control Project Config

```bash
# Add to git
git add .ollm/project.yaml
git commit -m "Add OLLM project configuration"
```

---

## Troubleshooting

### Wrong Project Type Detected

**Solution:** Manual override
```yaml
project:
  profile: correct-type
```

### Profile Not Applied

**Solution:** Check auto-detect enabled
```yaml
project:
  auto_detect: true
```

### Custom Settings Ignored

**Solution:** Check precedence
1. Environment variables (highest)
2. Project config
3. User config
4. Profile defaults (lowest)

---

## See Also

- [Built-in Profiles](built-in-profiles.md)
- [Project Profile Service API](../api/project-profile-service.md)
- [Configuration](../Models_configuration.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
