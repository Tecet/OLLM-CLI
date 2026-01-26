# Template System - User Guide

**Using Prompt Templates**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Using Templates](#using-templates)
3. [Creating Templates](#creating-templates)
4. [Variable Substitution](#variable-substitution)
5. [Template Locations](#template-locations)
6. [Examples](#examples)

---

## Introduction

Templates let you create reusable prompts with variables. Instead of typing the same prompt repeatedly, create a template once and reuse it with different inputs.

---

## Using Templates

### List Available Templates

```bash
/template list
```

**Output:**
```
code_review - Review code for issues
bug_report - Generate bug report
commit_message - Generate commit message
```

### Use Template

```bash
/template use template_name var1=value1 var2=value2
```

**Examples:**
```bash
/template use code_review language=TypeScript code="const x = 1;"
/template use bug_report title="Login fails" steps="1. Click login 2. Error"
```

---

## Creating Templates

### Step 1: Create YAML File

```yaml
# ~/.ollm/templates/my_template.yaml
name: my_template
description: My custom template
prompt: |
  Your prompt here with {variables}
variables:
  - name: variable_name
    description: Variable description
    required: true
```

### Step 2: Use Template

```bash
/template use my_template variable_name=value
```

---

## Variable Substitution

### Basic Variables

```yaml
prompt: |
  Hello {name}!
```

**Usage:**
```bash
/template use greeting name=Alice
# Result: Hello Alice!
```

### Variables with Defaults

```yaml
prompt: |
  Language: {language:TypeScript}
```

**Usage:**
```bash
/template use example
# Result: Language: TypeScript

/template use example language=Python
# Result: Language: Python
```

### Required Variables

```yaml
variables:
  - name: code
    required: true
```

**Usage:**
```bash
/template use example
# Error: Required variable 'code' not provided

/template use example code="..."
# Success
```

---

## Template Locations

### User Templates

**Location:** `~/.ollm/templates/`  
**Purpose:** Personal templates  
**Scope:** Available in all projects

### Workspace Templates

**Location:** `.ollm/templates/` (in project root)  
**Purpose:** Team/project templates  
**Scope:** Available in current project only  
**Priority:** Override user templates with same name

---

## Examples

### Example 1: Code Review Template

```yaml
# ~/.ollm/templates/code_review.yaml
name: code_review
description: Review code for issues
prompt: |
  Review this {language:TypeScript} code:
  
  ```{language}
  {code}
  ```
  
  Check for:
  - Bugs and errors
  - Performance issues
  - Security vulnerabilities
  - Best practices
  - Code style
  
  Provide specific suggestions for improvement.

variables:
  - name: language
    description: Programming language
    required: false
    default: TypeScript
  - name: code
    description: Code to review
    required: true
```

**Usage:**
```bash
/template use code_review code="const x = 1; console.log(x);"
```

### Example 2: Bug Report Template

```yaml
# ~/.ollm/templates/bug_report.yaml
name: bug_report
description: Generate structured bug report
prompt: |
  Create a bug report for: {title}
  
  Steps to reproduce:
  {steps}
  
  Expected behavior:
  {expected:Application should work correctly}
  
  Format as:
  - Title
  - Description
  - Steps to Reproduce
  - Expected Behavior
  - Actual Behavior
  - Severity
  - Suggested Fix

variables:
  - name: title
    description: Bug title
    required: true
  - name: steps
    description: Steps to reproduce
    required: true
  - name: expected
    description: Expected behavior
    required: false
    default: Application should work correctly
```

**Usage:**
```bash
/template use bug_report title="Login fails" steps="1. Go to login\n2. Enter credentials\n3. Click submit\n4. Error appears"
```

### Example 3: Commit Message Template

```yaml
# .ollm/templates/commit_message.yaml
name: commit_message
description: Generate semantic commit message
prompt: |
  Generate a semantic commit message for these changes:
  
  {changes}
  
  Type: {type:feat}
  Scope: {scope}
  
  Format as:
  {type}({scope}): <short description>
  
  <detailed description>
  
  <breaking changes if any>

variables:
  - name: changes
    description: Code changes
    required: true
  - name: type
    description: Commit type (feat, fix, docs, etc.)
    required: false
    default: feat
  - name: scope
    description: Commit scope
    required: false
```

**Usage:**
```bash
/template use commit_message changes="Added user authentication" type=feat scope=auth
```

---

## Best Practices

### 1. Use Descriptive Names

**Good:** `code_review`, `bug_report`, `api_documentation`  
**Bad:** `template1`, `temp`, `test`

### 2. Provide Defaults for Optional Variables

```yaml
variables:
  - name: language
    default: TypeScript  # Good
```

### 3. Document Variables

```yaml
variables:
  - name: code
    description: Code to review  # Helpful
    required: true
```

### 4. Keep Prompts Focused

**Good:** One clear purpose per template  
**Bad:** Template that tries to do everything

### 5. Use Workspace Templates for Team

```
.ollm/templates/
├── code_review.yaml      # Team standard
├── pr_description.yaml   # Team standard
└── api_docs.yaml         # Team standard
```

---

## Troubleshooting

### Template Not Found

**Problem:** Template doesn't appear in list

**Solution:** Check file location
```bash
# User templates
ls ~/.ollm/templates/

# Workspace templates
ls .ollm/templates/
```

### Variable Not Substituted

**Problem:** `{variable}` appears in output

**Solution:** Provide variable value
```bash
/template use my_template variable=value
```

### Required Variable Missing

**Problem:** Error about missing variable

**Solution:** Provide all required variables
```yaml
# Check template for required variables
variables:
  - name: code
    required: true  # Must provide
```

---

## See Also

- [Template Reference](template-reference.md)
- [Template Service API](../api/template-service.md)
- [Configuration](../Models_configuration.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-16
