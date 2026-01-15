# Model Management Guide

Complete guide to managing models, routing, and configuration in OLLM CLI.

## Table of Contents

- [Overview](#overview)
- [Model Lifecycle](#model-lifecycle)
- [Model Routing](#model-routing)
- [Keep-Alive Management](#keep-alive-management)
- [Configuration](#configuration)
- [Model Database](#model-database)
- [Best Practices](#best-practices)

## Overview

OLLM CLI provides comprehensive model management capabilities:

- **Lifecycle Management**: List, pull, delete, and inspect models
- **Intelligent Routing**: Automatic model selection based on task profiles
- **Keep-Alive**: Keep frequently-used models loaded for faster responses
- **Multi-Provider**: Support for Ollama, vLLM, and OpenAI-compatible providers
- **Context Awareness**: Per-model token limits and capability detection

## Model Lifecycle

### Listing Models

View all available models from your current provider:

```bash
/model list
```

**Output includes**:
- Model name and version
- Size on disk
- Last modified date
- Load status (loaded/unloaded)

**Example**:
```
Available Models:
  ● llama3.1:8b (loaded)     4.7 GB   Modified 2 days ago
    mistral:7b               4.1 GB   Modified 1 week ago
    codellama:7b             3.8 GB   Modified 3 days ago
    phi3:mini                2.3 GB   Modified 1 month ago
```

### Pulling Models

Download models from the provider registry:

```bash
/model pull llama3.1:8b
```

**Features**:
- Real-time progress display
- Transfer rate monitoring
- Cancellable with Ctrl+C
- Automatic cache invalidation

**Progress display**:
```
Pulling llama3.1:8b...
[████████████████████████] 100% 4.7 GB @ 12.3 MB/s
Model llama3.1:8b ready.
```

### Deleting Models

Remove models to free disk space:

```bash
/model delete codellama:7b
```

**Safety features**:
- Confirmation prompt
- Automatic unload if currently loaded
- Cannot delete active model (switch first)
- Shows space to be freed

**Example**:
```
Delete codellama:7b? This will free 3.8 GB. [y/N] y
Unloading model...
Deleting model files...
Model codellama:7b removed successfully.
```

### Model Information

View detailed model metadata:

```bash
/model info llama3.1:8b
```

**Information displayed**:
- Context window size
- Parameter count
- Quantization method
- Model family
- Capabilities (tool calling, vision, streaming)
- License information

**Example**:
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
License: Llama 3.1 Community License
```

## Model Routing

OLLM CLI can automatically select appropriate models based on task profiles.

### Routing Profiles

Four built-in profiles optimize for different use cases:

#### Fast Profile
- **Purpose**: Quick responses with smaller models
- **Preferred families**: phi, gemma, mistral
- **Min context**: 4,096 tokens
- **Use cases**: Simple queries, quick iterations, testing

#### General Profile
- **Purpose**: Balanced performance for most tasks
- **Preferred families**: llama, mistral, qwen
- **Min context**: 8,192 tokens
- **Use cases**: General conversation, mixed tasks

#### Code Profile
- **Purpose**: Optimized for code generation
- **Preferred families**: codellama, deepseek-coder, starcoder, qwen
- **Min context**: 16,384 tokens
- **Use cases**: Code review, generation, debugging

#### Creative Profile
- **Purpose**: Creative writing and storytelling
- **Preferred families**: llama, mistral
- **Min context**: 8,192 tokens
- **Use cases**: Writing, brainstorming, content creation

### Enabling Routing

Configure routing in your settings:

```yaml
model:
  routing:
    enabled: true
    defaultProfile: general
    overrides:
      code: deepseek-coder:6.7b
      fast: phi3:mini
```

### Selection Algorithm

When routing is enabled, OLLM:

1. **Filters** models by minimum context window
2. **Filters** models by required capabilities
3. **Scores** models by preferred family match
4. **Selects** highest-scoring model
5. **Falls back** to fallback profile if no match
6. **Uses override** if configured for the profile

### Manual Override

You can always manually select a model:

```bash
/model use llama3.1:8b
```

This overrides routing for the current session.

## Keep-Alive Management

Keep frequently-used models loaded in VRAM for faster response times.

### Keeping Models Loaded

```bash
/model keep llama3.1:8b
```

**Benefits**:
- Eliminates model load time (typically 2-5 seconds)
- Reduces latency for subsequent requests
- Useful for interactive sessions

**How it works**:
- Sends periodic keep-alive requests to provider
- Prevents automatic unloading due to inactivity
- Continues until manual unload or timeout

### Unloading Models

```bash
/model unload llama3.1:8b
```

**When to unload**:
- Switching to a different model
- Freeing VRAM for other applications
- Reducing power consumption

### Automatic Keep-Alive

Configure models to always stay loaded:

```yaml
model:
  keepAlive:
    enabled: true
    models:
      - llama3.1:8b
      - codellama:7b
    timeout: 300  # seconds of inactivity before unload
```

### Viewing Loaded Models

Check which models are currently in memory:

```bash
/context
```

Shows loaded models in the context status display.

## Configuration

### Global Configuration

User-level settings (`~/.ollm/config.yaml`):

```yaml
model:
  # Default model
  default: llama3.1:8b
  
  # Routing configuration
  routing:
    enabled: true
    defaultProfile: general
    overrides:
      code: deepseek-coder:6.7b
      fast: phi3:mini
  
  # Keep-alive settings
  keepAlive:
    enabled: true
    models:
      - llama3.1:8b
    timeout: 300
  
# Generation options
options:
  temperature: 0.7
  maxTokens: 4096
  topP: 0.9
  numCtx: 8192
```

### Project Configuration

Workspace-level settings (`.ollm/project.yaml`):

```yaml
# Override global model for this project
model: deepseek-coder:6.7b

# Project-specific routing
routing:
  defaultProfile: code

# Project-specific options
options:
  temperature: 0.3
  maxTokens: 4096
```

**Precedence**: Project settings override global settings.

### Environment Variables

Override configuration via environment variables:

```bash
# Model selection
export OLLM_MODEL=llama3.1:8b

# Generation parameters
export OLLM_TEMPERATURE=0.7
export OLLM_MAX_TOKENS=4096
export OLLM_CONTEXT_SIZE=8192

# Provider URL
export OLLAMA_HOST=http://localhost:11434
```

**Precedence**: Environment variables > Project config > Global config

### Options Validation

All options are validated against a JSON schema:

**Supported options**:
- `temperature` (0.0 - 2.0): Controls randomness
- `maxTokens` (1 - model limit): Maximum generation length
- `topP` (0.0 - 1.0): Nucleus sampling threshold
- `topK` (1 - 100): Top-K sampling
- `numCtx`: Context window size
- `repeatPenalty` (0.0 - 2.0): Repetition penalty
- `seed`: Random seed for reproducibility

**Invalid options** are rejected with clear error messages:

```
Invalid temperature value: 2.5. Temperature must be between 0.0 and 2.0.
```

## Model Database

OLLM maintains a database of known model capabilities for intelligent routing.

### Supported Model Families

| Family | Context Window | Tool Calling | Vision | Profiles |
|--------|----------------|--------------|--------|----------|
| llama3.1 | 128,000 | ✓ | ✗ | general, code |
| codellama | 16,384 | ✗ | ✗ | code |
| mistral | 32,768 | ✓ | ✗ | general, fast |
| phi3 | 4,096 | ✗ | ✗ | fast |
| gemma | 8,192 | ✗ | ✗ | fast, general |
| deepseek-coder | 16,384 | ✗ | ✗ | code |
| qwen | 32,768 | ✓ | ✗ | general, code |

### Pattern Matching

The database uses glob patterns for flexible matching:

- `llama3.1:*` matches `llama3.1:8b`, `llama3.1:70b`, etc.
- `codellama:*` matches all CodeLlama variants
- `*:mini` matches any model with `:mini` suffix

### Unknown Models

For models not in the database, OLLM uses safe defaults:

- **Context window**: 4,096 tokens
- **Capabilities**: Streaming only (no tools, no vision)
- **Profiles**: General

This ensures OLLM works with any model, even if not explicitly supported.

## Best Practices

### Model Selection

**For code tasks**:
- Use code-optimized models: `codellama`, `deepseek-coder`, `qwen`
- Enable code routing profile
- Increase context window for large files

**For general chat**:
- Use balanced models: `llama3.1`, `mistral`
- General routing profile
- Standard context window (8K-32K)

**For quick iterations**:
- Use smaller models: `phi3`, `gemma`
- Fast routing profile
- Reduced context window

### Memory Management

**Keep-alive strategy**:
- Keep 1-2 frequently-used models loaded
- Unload models when switching contexts
- Monitor VRAM usage with `/context`

**Disk space**:
- Remove unused models regularly
- Keep only necessary quantization levels
- Use `/model list` to audit installed models

### Performance Optimization

**Context sizing**:
- Use `/context auto` for automatic VRAM-based sizing
- Manually set context with `/context size` for specific needs
- Monitor token usage to avoid hitting limits

**Routing**:
- Enable routing for automatic optimization
- Set profile overrides for consistent behavior
- Use manual selection for specific requirements

### Multi-Provider Setup

**Ollama** (Tier 1 - Local):
- Best for privacy and offline use
- Supports all model management features
- Recommended for development

**vLLM** (Tier 2 - High Performance):
- Best for production workloads
- Optimized for throughput
- Requires more setup

**OpenAI-Compatible** (Tier 3 - Universal):
- Best for cloud providers
- Widest compatibility
- May have limited management features

## Troubleshooting

### Model Not Found

```
Error: Model 'llama3.1:8b' not found.
```

**Solution**: Pull the model first:
```bash
/model pull llama3.1:8b
```

### Out of Memory

```
Error: Insufficient VRAM to load model.
```

**Solutions**:
- Unload other models: `/model unload <name>`
- Use a smaller model or quantization
- Enable automatic context sizing: `/context auto`
- Reduce context window: `/context size 4096`

### Slow Response Times

**Possible causes**:
- Model not kept alive (reload time)
- Context window too large
- System resource constraints

**Solutions**:
- Enable keep-alive: `/model keep <name>`
- Reduce context: `/context size 8192`
- Use fast routing profile
- Switch to smaller model

### Provider Connection Failed

```
Error: Failed to connect to Ollama at http://localhost:11434
```

**Solutions**:
- Check provider is running: `ollama serve`
- Verify URL in configuration
- Check firewall settings
- Try different provider

## See Also

- [Commands Reference](commands.md) - All available commands
- [Configuration Guide](configuration.md) - Detailed configuration options
- [Provider Systems](provider-systems.md) - Provider setup and configuration
- [Context Management](context-management-plan.md) - Context and memory management
