# Getting Started with Model Management

**Quick Start Guide**

This guide will help you get started with model management, routing, memory, templates, and project profiles in OLLM CLI.

---

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Basic Model Management](#basic-model-management)
5. [Using Model Routing](#using-model-routing)
6. [Working with Memory](#working-with-memory)
7. [Using Templates](#using-templates)
8. [Project Profiles](#project-profiles)
9. [Next Steps](#next-steps)

**See Also:**
- [Model Management Overview](README.md)
- [Model Commands](Models_commands.md)
- [Configuration Guide](Models_configuration.md)

---

## Introduction

OLLM CLI provides comprehensive model management capabilities that help you:

- **Manage models**: List, download, delete, and inspect models
- **Route intelligently**: Automatically select appropriate models for tasks
- **Remember context**: Store facts and preferences across sessions
- **Use templates**: Create reusable prompts with variables
- **Configure projects**: Auto-detect and apply project-specific settings

This guide covers the basics to get you started quickly.

---

## Prerequisites

**Required:**
- OLLM CLI installed and configured
- Ollama (or compatible provider) running
- At least one model installed

**Optional:**
- Project workspace for profile detection
- Custom templates directory

**Check your setup:**
```bash
# Verify OLLM CLI is installed
ollm --version

# Check provider connection
/model list
```

---

## Quick Start

### 1. List Available Models

See what models you have installed:

```bash
/model list
```

**Output:**
```
Available Models:
  ● llama3.1:8b (loaded)     4.7 GB   Modified 2 days ago
    mistral:7b               4.1 GB   Modified 1 week ago
    codellama:7b             3.8 GB   Modified 3 days ago
```

### 2. Download a Model

Pull a new model from the registry:

```bash
/model pull llama3.1:8b
```

**Progress display:**
```
Pulling llama3.1:8b...
[████████████████████████] 100% 4.7 GB @ 12.3 MB/s
Model llama3.1:8b ready.
```

### 3. View Model Details

Get detailed information about a model:

```bash
/model info llama3.1:8b
```

**Output:**
```
Model: llama3.1:8b
Size: 4.7 GB
Parameters: 8B
Context Length: 128,000 tokens
Quantization: Q4_K_M
Family: llama
Capabilities:
  ✓ Tool calling
  ✓ Streaming
  ✗ Vision
```

### 4. Use a Model

Switch to a specific model:

```bash
/model use llama3.1:8b
```

---

## Basic Model Management

### Listing Models

View all available models with details:

```bash
/model list
```

**Shows:**
- Model name and version
- Size on disk
- Last modified date
- Load status (loaded/unloaded)

### Pulling Models

Download models from the provider registry:

```bash
# Pull a specific model
/model pull llama3.1:8b

# Pull with tag
/model pull mistral:7b-instruct
```

**Features:**
- Real-time progress display
- Transfer rate monitoring
- Cancellable with Ctrl+C

### Deleting Models

Remove models to free disk space:

```bash
/model delete codellama:7b
```

**Safety features:**
- Confirmation prompt
- Shows space to be freed
- Automatic unload if currently loaded

### Keeping Models Loaded

Keep frequently-used models in memory for faster responses:

```bash
# Keep a model loaded
/model keep llama3.1:8b

# Unload a model
/model unload llama3.1:8b
```

**Benefits:**
- Eliminates model load time (2-5 seconds)
- Reduces latency for subsequent requests
- Useful for interactive sessions

---

## Using Model Routing

### What is Model Routing?

Model routing automatically selects appropriate models based on task type, eliminating the need for manual model selection.

### Enable Routing

Add to your configuration (`~/.ollm/config.yaml`):

```yaml
model:
  routing:
    enabled: true
    defaultProfile: general
```

### Routing Profiles

Four built-in profiles optimize for different use cases:

**Fast Profile** - Quick responses with smaller models:
```yaml
routing:
  defaultProfile: fast
```

**General Profile** - Balanced performance for most tasks:
```yaml
routing:
  defaultProfile: general
```

**Code Profile** - Optimized for code generation:
```yaml
routing:
  defaultProfile: code
```

**Creative Profile** - Creative writing and storytelling:
```yaml
routing:
  defaultProfile: creative
```

### Profile Overrides

Specify models for specific profiles:

```yaml
model:
  routing:
    enabled: true
    defaultProfile: general
    overrides:
      code: deepseek-coder:6.7b
      fast: phi3:mini
```

### Manual Override

You can always manually select a model:

```bash
/model use llama3.1:8b
```

This overrides routing for the current session.

---

## Working with Memory

### What is Memory?

The memory system stores facts, preferences, and context across sessions, so you don't have to repeat information.

### Adding Memories

Store information for future sessions:

```bash
# Add a simple memory
/memory add user_name Alice

# Add with category
/memory add preferred_language TypeScript --category preference
```

### Listing Memories

View all stored memories:

```bash
/memory list
```

**Output:**
```
Stored Memories:
  user_name: Alice (preference)
  preferred_language: TypeScript (preference)
  project_type: monorepo (context)
```

### Searching Memories

Find specific memories:

```bash
/memory search project
```

### Forgetting Memories

Remove memories you no longer need:

```bash
# Forget a specific memory
/memory forget old_preference

# Clear all memories
/memory clear
```

### LLM-Initiated Memory

The LLM can also store memories during conversation:

```
User: My name is Alice and I prefer TypeScript.
Assistant: I'll remember that. [Stores: user_name=Alice, preferred_language=TypeScript]
```

### How Memory Works

1. Memories are stored in `~/.ollm/memory.json`
2. At session start, memories are loaded
3. Memories are injected into the system prompt (within token budget)
4. Recently accessed memories are prioritized
5. Access count and timestamps are tracked

---

## Using Templates

### What are Templates?

Templates are reusable prompts with variable substitution, allowing you to quickly use common prompts with different inputs.

### Listing Templates

View available templates:

```bash
/template list
```

**Output:**
```
Available Templates:
  code_review - Review code for quality and security
  explain_code - Explain how code works
  write_tests - Generate unit tests for code
```

### Using Templates

Apply a template with variables:

```bash
# Use a template with variables
/template use code_review language=TypeScript code="function add(a, b) { return a + b; }"

# Variables with spaces
/template use explain_code language="Python" code="def factorial(n): return 1 if n <= 1 else n * factorial(n-1)"
```

### Creating Templates

Create a new template:

```bash
/template create my_template
```

**Template format (YAML):**
```yaml
name: code_review
description: Review code for quality and security
template: "Review this {language} code for {focus:bugs and security}:\n\n{code}"
variables:
  - name: language
    required: true
    description: Programming language
  - name: focus
    required: false
    default: "bugs and security"
    description: Review focus areas
  - name: code
    required: true
    description: Code to review
```

### Template Locations

Templates are loaded from:
- User templates: `~/.ollm/templates/`
- Workspace templates: `.ollm/templates/`

Workspace templates override user templates with the same name.

---

## Project Profiles

### What are Project Profiles?

Project profiles auto-detect your project type and apply appropriate settings automatically.

### Auto-Detection

OLLM CLI detects project type from characteristic files:

```bash
/project detect
```

**Detected types:**
- **TypeScript**: `package.json` with TypeScript dependencies
- **Python**: `requirements.txt`, `pyproject.toml`, `setup.py`
- **Rust**: `Cargo.toml`
- **Go**: `go.mod`

### Using a Profile

Manually select a profile:

```bash
/project use typescript
```

### Initializing a Project

Create a project configuration file:

```bash
/project init
```

This creates `.ollm/project.yaml` with the selected profile settings.

### Project Configuration

Example `.ollm/project.yaml`:

```yaml
# Project profile
profile: typescript

# Override global model
model: deepseek-coder:6.7b

# Project-specific routing
routing:
  defaultProfile: code

# Project-specific options
options:
  temperature: 0.3
  maxTokens: 4096
```

### Built-in Profiles

**TypeScript Profile:**
- Code-optimized model
- Code routing profile
- File and shell tools enabled

**Python Profile:**
- Code-optimized model
- Code routing profile
- Python-specific tools

**Rust Profile:**
- Code-optimized model
- Emphasis on memory safety

**Go Profile:**
- Code-optimized model
- Emphasis on concurrency

**Documentation Profile:**
- Writing-optimized model
- Creative routing profile

---

## Next Steps

### Learn More

**Model Management:**
- [Model Commands Reference](Models_commands.md)
- [Model Architecture](Models_architecture.md)
- [Configuration Guide](Models_configuration.md)

**Routing:**
- [Routing User Guide](routing/user-guide.md)
- [Routing Development Guide](routing/development-guide.md)
- [Profiles Reference](routing/profiles-reference.md)

**Memory:**
- [Memory User Guide](memory/user-guide.md)
- [Memory API Reference](memory/api-reference.md)

**Templates:**
- [Templates User Guide](templates/user-guide.md)
- [Template Reference](templates/template-reference.md)

**Profiles:**
- [Profiles User Guide](profiles/user-guide.md)
- [Built-in Profiles](profiles/built-in-profiles.md)

### Advanced Topics

- [Custom Routing Profiles](routing/development-guide.md)
- [Template Libraries](templates/template-reference.md)
- [API Reference](api/)

### Get Help

- [Troubleshooting Guide](../troubleshooting.md)
- GitHub Issues (https://github.com/ollm/ollm-cli/issues)
- [Community Forum](#)

---

**Last Updated:** 2026-01-16  
**Version:** 0.1.0

