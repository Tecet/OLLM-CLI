# Project Profiles Guide

Complete guide to project-specific configuration and automatic profile detection in OLLM CLI.

## Table of Contents

- [Overview](#overview)
- [Profile Detection](#profile-detection)
- [Built-in Profiles](#built-in-profiles)
- [Using Profiles](#using-profiles)
- [Custom Profiles](#custom-profiles)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

## Overview

Project profiles allow OLLM to automatically adapt its behavior based on your project type. This includes:

- **Model selection**: Use code-optimized models for code projects
- **System prompts**: Inject project-specific instructions
- **Tool availability**: Enable/disable tools based on project needs
- **Routing profiles**: Optimize model selection for task types
- **Generation options**: Adjust temperature, context size, etc.

**Benefits**:
- Consistent behavior across team members
- Optimized settings for project type
- No manual configuration needed
- Easy to share via version control

## Profile Detection

OLLM can automatically detect your project type by scanning for characteristic files.

### Detection Rules

| Project Type | Detection Files | Profile |
|--------------|----------------|---------|
| TypeScript | `package.json` with TypeScript dependency | `typescript` |
| Python | `requirements.txt`, `pyproject.toml`, `setup.py` | `python` |
| Rust | `Cargo.toml` | `rust` |
| Go | `go.mod` | `go` |
| Documentation | `README.md`, `docs/` directory | `documentation` |

### Auto-Detection

Detect project type automatically:

```bash
/project detect
```

**Example output**:
```
Detected project type: TypeScript

Recommended profile: typescript
  Model: deepseek-coder:6.7b
  Routing: code profile
  Tools: file operations, shell, git
  System prompt: Code-focused with TypeScript best practices

Apply this profile? [y/N]
```

**Behavior**:
- Scans workspace root for characteristic files
- Identifies most likely project type
- Shows recommended settings
- Prompts for confirmation before applying

### Manual Detection

Check detection without applying:

```bash
/project detect --dry-run
```

Shows detected profile without prompting to apply.

## Built-in Profiles

OLLM includes five built-in profiles optimized for common project types.

### TypeScript Profile

**Optimized for**: TypeScript/JavaScript projects

**Settings**:
```yaml
profile: typescript
model: deepseek-coder:6.7b
routing:
  defaultProfile: code
systemPrompt: |
  You are a TypeScript expert. Focus on:
  - Type safety and strict mode
  - Modern ES2022+ features
  - Async/await over promises
  - Functional programming patterns
tools:
  enabled:
    - file
    - shell
    - git
    - search
options:
  temperature: 0.3
  maxTokens: 4096
```

**Best for**:
- React/Vue/Angular applications
- Node.js backends
- TypeScript libraries
- Full-stack projects

### Python Profile

**Optimized for**: Python projects

**Settings**:
```yaml
profile: python
model: deepseek-coder:6.7b
routing:
  defaultProfile: code
systemPrompt: |
  You are a Python expert. Focus on:
  - PEP 8 style guidelines
  - Type hints (Python 3.10+)
  - Modern Python features
  - Pythonic idioms
tools:
  enabled:
    - file
    - shell
    - git
    - search
    - execute
options:
  temperature: 0.3
  maxTokens: 4096
```

**Best for**:
- Django/Flask applications
- Data science projects
- Python libraries
- CLI tools

### Rust Profile

**Optimized for**: Rust projects

**Settings**:
```yaml
profile: rust
model: deepseek-coder:6.7b
routing:
  defaultProfile: code
systemPrompt: |
  You are a Rust expert. Focus on:
  - Memory safety and ownership
  - Zero-cost abstractions
  - Error handling with Result
  - Idiomatic Rust patterns
tools:
  enabled:
    - file
    - shell
    - git
    - search
options:
  temperature: 0.3
  maxTokens: 4096
```

**Best for**:
- Systems programming
- CLI tools
- WebAssembly projects
- Performance-critical code

### Go Profile

**Optimized for**: Go projects

**Settings**:
```yaml
profile: go
model: deepseek-coder:6.7b
routing:
  defaultProfile: code
systemPrompt: |
  You are a Go expert. Focus on:
  - Simplicity and readability
  - Effective Go guidelines
  - Concurrency patterns
  - Error handling
tools:
  enabled:
    - file
    - shell
    - git
    - search
options:
  temperature: 0.3
  maxTokens: 4096
```

**Best for**:
- Microservices
- CLI tools
- Cloud-native applications
- Backend services

### Documentation Profile

**Optimized for**: Documentation writing

**Settings**:
```yaml
profile: documentation
model: llama3.1:8b
routing:
  defaultProfile: creative
systemPrompt: |
  You are a technical writer. Focus on:
  - Clear, concise explanations
  - Proper markdown formatting
  - Code examples with context
  - Audience-appropriate language
tools:
  enabled:
    - file
    - search
    - web-fetch
options:
  temperature: 0.7
  maxTokens: 4096
```

**Best for**:
- README files
- API documentation
- User guides
- Technical blog posts

## Using Profiles

### Applying a Profile

Apply a profile to your project:

```bash
/project use typescript
```

**Behavior**:
- Loads profile settings
- Overrides global configuration
- Updates model, system prompt, tools
- Settings persist for workspace

**Example output**:
```
Applied profile: typescript
  Model: deepseek-coder:6.7b
  Routing: code profile
  System prompt updated
  Enabled tools: file, shell, git, search
```

### Initializing Project Config

Create a project configuration file:

```bash
/project init
```

**Interactive prompts**:
```
Select project profile:
  [1] typescript - TypeScript/JavaScript projects
  [2] python - Python projects
  [3] rust - Rust projects
  [4] go - Go projects
  [5] documentation - Documentation writing
  [6] custom - Start from scratch

Choice: 1

Created .ollm/project.yaml with typescript profile.
You can customize settings by editing the file.
```

**Generated file** (`.ollm/project.yaml`):
```yaml
# OLLM Project Configuration
# This file configures OLLM behavior for this workspace

profile: typescript

# Model selection
model: deepseek-coder:6.7b

# Routing profile for automatic model selection
routing:
  defaultProfile: code

# System prompt customization
systemPrompt: |
  You are a TypeScript expert assistant.

# Tool availability
tools:
  enabled:
    - file
    - shell
    - git
    - search

# Generation options
options:
  temperature: 0.3
  maxTokens: 4096
```

### Switching Profiles

Change profile for current session:

```bash
/project use python
```

Updates settings immediately without modifying config file.

### Disabling Profile

Use global settings instead of project profile:

```bash
/project use none
```

Reverts to global configuration.

## Custom Profiles

Create custom profiles for specific needs.

### Creating Custom Profile

**File**: `.ollm/project.yaml`
```yaml
profile: custom

# Custom model selection
model: llama3.1:8b

# Custom routing
routing:
  defaultProfile: general
  overrides:
    code: codellama:7b
    fast: phi3:mini

# Custom system prompt
systemPrompt: |
  You are an AI assistant for the Acme Corp project.
  
  Project context:
  - Monorepo with TypeScript and Python services
  - Uses PostgreSQL database
  - Deployed on AWS
  
  Guidelines:
  - Follow company coding standards
  - Consider security implications
  - Optimize for maintainability

# Tool configuration
tools:
  enabled:
    - file
    - shell
    - git
    - search
    - web-fetch
  disabled:
    - execute  # Disable code execution for security

# Custom options
options:
  temperature: 0.5
  maxTokens: 8192
  topP: 0.9

# Memory configuration
memory:
  enabled: true
  tokenBudget: 1000

# Keep-alive configuration
keepAlive:
  enabled: true
  models:
    - llama3.1:8b
    - codellama:7b
  timeout: 600
```

### Profile Inheritance

Extend built-in profiles:

```yaml
# Start with TypeScript profile
profile: typescript

# Override specific settings
model: llama3.1:8b

# Add to system prompt
systemPrompt: |
  {{typescript.systemPrompt}}
  
  Additional context:
  - This is a React Native mobile app
  - Uses Expo framework
  - Targets iOS and Android

# Add more tools
tools:
  enabled:
    - file
    - shell
    - git
    - search
    - image-analyze  # For mobile UI work
```

### Team Profiles

Share profiles with your team:

1. Create `.ollm/project.yaml` in repo root
2. Commit to version control
3. Team members get profile automatically

**Example team profile**:
```yaml
profile: team

# Standardized model
model: deepseek-coder:6.7b

# Team coding standards
systemPrompt: |
  You are an AI assistant for the Engineering team.
  
  Coding standards:
  - Use TypeScript strict mode
  - Write tests for all features
  - Follow ESLint configuration
  - Use conventional commits
  
  Architecture:
  - Microservices with NestJS
  - PostgreSQL with Prisma
  - Redis for caching
  - AWS deployment

# Consistent tool set
tools:
  enabled:
    - file
    - shell
    - git
    - search

# Team preferences
options:
  temperature: 0.3
  maxTokens: 4096
```

## Configuration

### Configuration Precedence

Settings are applied in this order (later overrides earlier):

1. **Global config** (`~/.ollm/config.yaml`)
2. **Project config** (`.ollm/project.yaml`)
3. **Environment variables** (`OLLM_*`)
4. **Command-line flags** (`--model`, `--temperature`)

### Global Configuration

User-level defaults (`~/.ollm/config.yaml`):

```yaml
# Default model
model:
  default: llama3.1:8b

# Default options
options:
  temperature: 0.7
  maxTokens: 4096

# Project profile settings
project:
  autoDetect: true  # Auto-detect on startup
  applyOnDetect: false  # Prompt before applying
```

### Project Configuration

Workspace-level settings (`.ollm/project.yaml`):

```yaml
# Profile selection
profile: typescript

# Override global model
model: deepseek-coder:6.7b

# Project-specific settings
routing:
  defaultProfile: code

systemPrompt: |
  Custom prompt for this project

tools:
  enabled:
    - file
    - shell
    - git

options:
  temperature: 0.3
```

### Environment Variables

Override via environment:

```bash
# Override model
export OLLM_MODEL=codellama:7b

# Override options
export OLLM_TEMPERATURE=0.5
export OLLM_MAX_TOKENS=8192

# Disable auto-detection
export OLLM_PROJECT_AUTO_DETECT=false
```

## Best Practices

### Profile Selection

**Choose the right profile**:
- Use code profiles for development work
- Use documentation profile for writing
- Use general profile for mixed tasks
- Create custom profiles for specific needs

**When to customize**:
- Team has specific standards
- Project has unique requirements
- Need specialized tools
- Want consistent behavior

### System Prompts

**Keep prompts focused**:
```yaml
# Good - specific and actionable
systemPrompt: |
  You are a TypeScript expert for this React project.
  - Use functional components with hooks
  - Prefer composition over inheritance
  - Write tests with Vitest

# Bad - too generic
systemPrompt: |
  You are a helpful assistant.
```

**Include project context**:
```yaml
systemPrompt: |
  Project: E-commerce platform
  Stack: Next.js, Prisma, PostgreSQL
  Architecture: Monorepo with Turborepo
  
  Guidelines:
  - Follow Next.js 14 app router patterns
  - Use server components by default
  - Optimize for performance
```

### Tool Configuration

**Enable only needed tools**:
```yaml
# Development project
tools:
  enabled:
    - file
    - shell
    - git
    - search

# Documentation project
tools:
  enabled:
    - file
    - search
    - web-fetch
```

**Disable risky tools**:
```yaml
tools:
  disabled:
    - execute  # No code execution
    - shell    # No shell access
```

### Version Control

**Commit project config**:
```bash
git add .ollm/project.yaml
git commit -m "Add OLLM project configuration"
```

**Document in README**:
```markdown
## AI Assistant Setup

This project uses OLLM CLI with a TypeScript profile.

1. Install OLLM: `npm install -g @ollm/cli`
2. Pull model: `ollm model pull deepseek-coder:6.7b`
3. Start OLLM: `ollm`

The project profile will be applied automatically.
```

### Maintenance

**Review regularly**:
- Update model as better ones become available
- Refine system prompt based on usage
- Adjust tool availability as needed
- Update options for optimal performance

**Keep profiles simple**:
- Start with built-in profiles
- Only customize what's necessary
- Document customizations
- Share improvements with team

## Troubleshooting

### Profile Not Detected

```
No project profile detected.
```

**Solutions**:
- Check for characteristic files (package.json, Cargo.toml, etc.)
- Run `/project detect` manually
- Create `.ollm/project.yaml` manually
- Use `/project init` to create config

### Profile Not Applied

```
Profile settings not taking effect.
```

**Solutions**:
- Check file location (`.ollm/project.yaml` in workspace root)
- Verify YAML syntax
- Check for environment variable overrides
- Restart OLLM session

### Model Not Available

```
Error: Model 'deepseek-coder:6.7b' not found.
```

**Solutions**:
- Pull the model: `/model pull deepseek-coder:6.7b`
- Use different model in profile
- Enable model routing to use available models

### Tool Not Available

```
Error: Tool 'execute' is disabled.
```

**Solutions**:
- Enable tool in project config
- Check global tool settings
- Verify tool is installed
- Use alternative tool

## See Also

- [Model Management](model-management.md) - Model selection and routing
- [Configuration Guide](configuration.md) - Detailed configuration options
- [Commands Reference](commands.md) - All project commands
- [Templates Guide](templates-guide.md) - Prompt templates
