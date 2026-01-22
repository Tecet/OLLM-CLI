# Model Routing - User Guide

**Using Intelligent Model Selection**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Choosing a Profile](#choosing-a-profile)
3. [Preferred Families](#preferred-families)
4. [Fallback Chains](#fallback-chains)
5. [Manual Override](#manual-override)
6. [Examples](#examples)

---

## Introduction

Model routing automatically selects the best model for your task. Instead of manually choosing models, you specify what you want to do, and the router picks the optimal model.

---

## Choosing a Profile

### Fast Profile

**When to use:**
- Quick questions
- Simple tasks
- Speed is priority

**Configuration:**
```yaml
routing:
  profile: fast
```

**Example:**
```bash
# Quick question
What is 2+2?
# Router selects: phi:3b or gemma:2b
```

### General Profile

**When to use:**
- Most tasks
- Balanced needs
- Default choice

**Configuration:**
```yaml
routing:
  profile: general
```

**Example:**
```bash
# General question
Explain quantum computing
# Router selects: llama3.1:8b or mistral:7b
```

### Code Profile

**When to use:**
- Programming tasks
- Code generation
- Code review

**Configuration:**
```yaml
routing:
  profile: code
```

**Example:**
```bash
# Code task
Write a TypeScript function to sort an array
# Router selects: codellama:13b or deepseek-coder:6.7b
```

### Creative Profile

**When to use:**
- Creative writing
- Long-form content
- Quality over speed

**Configuration:**
```yaml
routing:
  profile: creative
```

**Example:**
```bash
# Creative task
Write a short story about a robot
# Router selects: llama3.1:70b or mixtral:8x7b
```

---

## Preferred Families

Specify which model families to prefer:

```yaml
routing:
  profile: code
  preferred_families:
    - codellama      # First choice
    - deepseek-coder # Second choice
    - qwen           # Third choice
```

**How it works:**
1. Router filters models by profile requirements
2. Models from preferred families score higher
3. Highest scoring model is selected

**Example:**
```yaml
# Prefer Llama models
routing:
  preferred_families:
    - llama
    - mistral
```

---

## Fallback Chains

If no models match the primary profile, the router falls back to another profile:

```yaml
routing:
  profile: creative
  fallback_profile: general  # Fall back if no creative models
```

**Fallback order:**
1. Try primary profile (creative)
2. If no match, try fallback (general)
3. If still no match, try fast profile
4. If still no match, use any available model

---

## Manual Override

Force a specific model, bypassing routing:

```yaml
model: llama3.1:8b  # Always use this model
```

Or via command:
```bash
/model use codellama:13b
```

**When to override:**
- Testing specific models
- Benchmarking
- Known best model for task

---

## Examples

### Example 1: Fast Responses

```yaml
# ~/.ollm/config.yaml
routing:
  profile: fast
  preferred_families:
    - phi
    - gemma
```

**Result:** Quick responses with small models

### Example 2: Code Development

```yaml
# .ollm/config.yaml (project)
routing:
  profile: code
  preferred_families:
    - codellama
    - deepseek-coder
    - qwen
  fallback_profile: general
```

**Result:** Code-specialized models with fallback

### Example 3: Creative Writing

```yaml
# ~/.ollm/config.yaml
routing:
  profile: creative
  preferred_families:
    - llama
    - mixtral
  fallback_profile: general
```

**Result:** Large, high-quality models

### Example 4: Balanced Setup

```yaml
# ~/.ollm/config.yaml
routing:
  profile: general
  preferred_families:
    - llama
    - mistral
    - qwen
  fallback_profile: fast
```

**Result:** Good balance of speed and quality

---

## Troubleshooting

### Wrong Model Selected

**Problem:** Router selects unexpected model

**Solution 1:** Adjust preferred families
```yaml
routing:
  preferred_families:
    - your-preferred-family
```

**Solution 2:** Use manual override
```yaml
model: your-preferred-model
```

### No Models Available

**Problem:** Router can't find any models

**Solution:** Pull models for your profile
```bash
# For code profile
/model pull codellama:13b
/model pull deepseek-coder:6.7b

# For general profile
/model pull llama3.1:8b
/model pull mistral:7b
```

### Slow Responses

**Problem:** Selected models are too large

**Solution:** Use fast profile
```yaml
routing:
  profile: fast
```

---

## See Also

- [Profiles Reference](profiles-reference.md)
- [Development Guide](development-guide.md)
- [Configuration](../Models_configuration.md)
- [API Reference](../api/model-router.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
